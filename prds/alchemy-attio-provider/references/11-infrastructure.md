# Reference: Infrastructure Modules

## Config (`src/attio/config.ts`)

```typescript
/**
 * Attio stage configuration for alchemy-effect.
 *
 * Unlike PostHog, Attio does not require a project/workspace ID —
 * the API key is workspace-scoped and implicitly provides context.
 */
export interface AttioStageConfig {
  /**
   * Attio API key. Falls back to ATTIO_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Attio API endpoint. Defaults to https://api.attio.com.
   */
  endpoint?: string;
}

declare module "alchemy-effect" {
  interface StageConfig {
    attio?: AttioStageConfig;
  }
}
```

## Credentials (`src/attio/credentials.ts`)

```typescript
import { Credentials } from "@packages/attio/Credentials";
import { App } from "alchemy-effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

export const fromStageConfig = () =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      const app = yield* App;
      if (app.config.attio?.apiKey) {
        return { apiKey: Redacted.make(app.config.attio.apiKey) };
      }
      const apiKey = yield* Config.redacted("ATTIO_API_KEY");
      return { apiKey };
    }),
  );
```

## Endpoint (`src/attio/endpoint.ts`)

```typescript
import { Endpoint } from "@packages/attio";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const fromStageConfig = () =>
  Layer.effect(
    Endpoint,
    Effect.gen(function* () {
      const app = yield* App;
      return app.config.attio?.endpoint ?? "https://api.attio.com";
    }),
  );
```

## Retry Policy (`src/attio/retry.ts`)

```typescript
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

function isRetryable(error: { readonly _tag: string }): boolean {
  switch (error._tag) {
    case "RateLimitError":
    case "ServerError":
    case "UnknownAttioError":
      return true;
    default:
      return false;
  }
}

/**
 * Centralized retry policy for all Attio API operations.
 * Exponential backoff: 200ms base, max 5 retries.
 * Only retries transient errors (429, 5xx, unknown).
 */
export const retryPolicy = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.retry({
      while: isRetryable,
      schedule: Schedule.intersect(
        Schedule.recurs(5),
        Schedule.exponential("200 millis"),
      ),
    }),
  );
```

## Main Index (`src/attio/index.ts`)

```typescript
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import "./config";
import * as Credentials from "./credentials";
import * as Endpoint from "./endpoint";

// Import all resource modules
import * as Object from "./object/index";
import * as Attribute from "./attribute/index";
import * as SelectOption from "./select-option/index";
import * as Status from "./status/index";
import * as List from "./list/index";
import * as Record from "./record/index";
import * as Entry from "./entry/index";
import * as Webhook from "./webhook/index";
import * as Note from "./note/index";
import * as Task from "./task/index";

// Re-export all resource modules
export {
  Object,
  Attribute,
  SelectOption,
  Status,
  List,
  Record,
  Entry,
  Webhook,
  Note,
  Task,
};

/**
 * Read the stage config from the App context.
 */
export const stageConfig = () =>
  Effect.gen(function* () {
    const app = yield* App;
    return app.config.attio;
  });

/**
 * Compose a Layer with stage config layers (Credentials, Endpoint).
 * No Project layer needed — Attio API key is workspace-scoped.
 */
export const config = <L extends Layer.Layer<any, any, any>>(layer: L) =>
  layer.pipe(
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
  );

/**
 * All resource providers merged into a single Layer.
 */
export const resources = () =>
  Layer.mergeAll(
    Object.objectProvider(),
    Attribute.attributeProvider(),
    SelectOption.selectOptionProvider(),
    Status.statusProvider(),
    List.listProvider(),
    Record.recordProvider(),
    Entry.entryProvider(),
    Webhook.webhookProvider(),
    Note.noteProvider(),
    Task.taskProvider(),
  );

/**
 * Providers with stage config but WITHOUT HttpClient.
 */
export const bareProviders = () => config(resources());

/**
 * Providers with stage config AND FetchHttpClient.
 * Use this in tests and alchemy.run.ts.
 */
export const providers = () =>
  bareProviders().pipe(Layer.provideMerge(FetchHttpClient.layer));
```

## Key Differences from PostHog Infrastructure

1. **No Project/Workspace context tag** — Attio's API key implicitly scopes to a workspace.
   PostHog requires `project_id` on every API call; Attio does not.

2. **Simpler config** — Only `apiKey?` and `endpoint?`, no `projectId`.

3. **Retry error tags** — Uses `UnknownAttioError` instead of `UnknownPostHogError`.

4. **Same composition pattern** — `config()`, `resources()`, `bareProviders()`, `providers()`
   follow identical patterns to PostHog.
