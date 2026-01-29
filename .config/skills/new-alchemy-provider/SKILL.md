---
name: new-alchemy-provider
description: "Create new alchemy-effect provider packages for SaaS services. An alchemy provider wraps a REST API with typed Effect-based SDK client and alchemy-effect resource definitions implementing infrastructure-as-code lifecycle operations (diff, read, create, update, delete). Use this skill when creating a new @packages/alchemy-<service> provider library, following the patterns established by @packages/alchemy-posthog. Covers package scaffolding, resource definitions, provider lifecycle, test harness, retry policies, and monorepo integration."
---

# New Alchemy Provider — Implementation Guide

Create a new alchemy-effect provider for a SaaS service, following the patterns established by `@packages/alchemy-posthog`.

## Reference Implementation

The canonical reference is **`@packages/alchemy-posthog`** (provider) backed by **`@packages/posthog`** (SDK client). This skill folder includes complete reference files from the PostHog implementation:

- `ref-resource.md` — FeatureFlag resource definition (Props, Attrs, Resource)
- `ref-provider.md` — FeatureFlag provider (full CRUD lifecycle with hard DELETE)
- `ref-resource-index.md` — Resource barrel export
- `ref-config.md` — StageConfig module augmentation
- `ref-project.md` — Project Context.Tag
- `ref-credentials.md` — Credentials layer from stage config
- `ref-endpoint.md` — Endpoint layer from stage config
- `ref-retry.md` — Centralized retry policy
- `ref-index.md` — Main provider composition index
- `ref-test-utils.md` — Test utilities (assertDeleted, test helper)
- `ref-test.md` — FeatureFlag provider test (create, update, delete, replace)
- `ref-survey-resource.md` — Survey resource showing `Input<T>` cross-references + string UUID IDs
- `ref-soft-delete-provider.md` — Experiment provider showing soft-delete via archive pattern
- `ref-smoke-test.md` — Multi-resource integration test (apply + destroy multiple resources)
- `ref-alchemy-run.md` — Stack definition with `defineStages` and `defineStack`

---

# Architecture Overview

An alchemy provider has two packages:

1. **SDK Client** (`packages/<service>`) — typed Effect-based API client wrapping the service's REST API. Provides CRUD operations, error types, pagination, credentials, and retry logic. See the `distilled-client` skill for creating the SDK client.
2. **Alchemy Provider** (`packages/alchemy-<service>`) — alchemy-effect resource definitions and providers that use the SDK client to implement infrastructure-as-code lifecycle operations (diff, read, create, update, delete).

This skill covers **package 2** (the alchemy provider). Use the `distilled-client` skill first to create the SDK client.

---

# PHASE 1: Package Structure

```
packages/alchemy-<service>/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── alchemy.run.ts                    # Example stack definition
├── .env                              # API keys (gitignored)
├── src/<service>/
│   ├── index.ts                      # Barrel export + provider composition
│   ├── config.ts                     # StageConfig module augmentation
│   ├── project.ts                    # Project/Account Context.Tag
│   ├── credentials.ts                # Credentials layer from stage config
│   ├── endpoint.ts                   # Endpoint layer from stage config
│   ├── retry.ts                      # Centralized retry policy
│   ├── <resource-a>/
│   │   ├── index.ts                  # Barrel: export * from resource + provider
│   │   ├── <resource-a>.ts           # Resource definition (Props, Attrs, Resource)
│   │   └── <resource-a>.provider.ts  # Provider implementation (CRUD lifecycle)
│   └── <resource-b>/
│       ├── index.ts
│       ├── <resource-b>.ts
│       └── <resource-b>.provider.ts
└── test/<service>/
    ├── test.ts                       # Test utilities (assertDeleted, test helper)
    ├── <resource-a>/
    │   └── <resource-a>.provider.test.ts
    ├── <resource-b>/
    │   └── <resource-b>.provider.test.ts
    └── <service>.smoke.test.ts       # Multi-resource integration test
```

## 1.1 package.json

```json
{
  "name": "@packages/alchemy-<service>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "@packages/source": "./src/<service>/index.ts",
        "types": "./dist/src/<service>/index.d.ts",
        "default": "./dist/src/<service>/index.js"
      }
    },
    "./<service>/<resource-a>": {
      "import": {
        "@packages/source": "./src/<service>/<resource-a>/index.ts",
        "types": "./dist/src/<service>/<resource-a>/index.d.ts",
        "default": "./dist/src/<service>/<resource-a>/index.js"
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "check-types": "tsc --noEmit",
    "test": "bun --env-file=.env vitest run",
    "alchemy": "bun --conditions @packages/source node_modules/.bin/alchemy-effect"
  },
  "dependencies": {
    "@packages/<service>": "workspace:*",
    "alchemy-effect": "0.6.0"
  },
  "peerDependencies": {
    "effect": "^3.16.0",
    "@effect/platform": "^0.82.0"
  },
  "devDependencies": {
    "@effect/platform": "^0.82.0",
    "@effect/platform-node": "^0.74.0",
    "@effect/vitest": "^0.27.0",
    "effect": "^3.16.0",
    "typescript": "catalog:typescript",
    "vitest": "^3.2.4"
  }
}
```

**Key details:**
- `"test"` uses `bun --env-file=.env` to inject credentials
- `"alchemy"` script for running alchemy-effect CLI
- Conditional `@packages/source` exports for dev resolution

## 1.2 tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,
    "declarationMap": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 1.3 vitest.config.ts

```typescript
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
  resolve: {
    conditions: ["@packages/source", "import", "default"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Map each SDK export to its source file for test resolution
      "@packages/<service>/<resource>": path.resolve(
        __dirname,
        "../<service>/src/services/<resource>.ts"
      ),
      "@packages/<service>/Credentials": path.resolve(
        __dirname,
        "../<service>/src/credentials.ts"
      ),
      "@packages/<service>": path.resolve(
        __dirname,
        "../<service>/src/index.ts"
      ),
    },
  },
});
```

---

# PHASE 2: Resource Definition

Every resource follows this exact structure. Use `<Service>.<Resource>` naming (e.g. `PostHog.FeatureFlag`).

See `ref-resource.md` for a complete example.

## 2.1 Resource File (`<resource>.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a <Service> <Resource>.
 */
export interface <Resource>Props {
  /**
   * Human-readable description of the property.
   * @example "example-value"
   */
  name: string;

  /**
   * Optional property with default behavior described.
   */
  description?: string | null;

  /**
   * Cross-resource reference — wrap in Input<T> ONLY when the value
   * may come from another resource's output attribute.
   */
  linkedId?: Input<number | null>;

  /**
   * Complex nested configuration. Use `unknown` for opaque API objects
   * unless you need type safety on the caller side.
   */
  filters?: Record<string, unknown>;
}

/**
 * Output attributes for a <Service> <Resource> resource.
 */
export interface <Resource>Attrs<
  _Props extends Input.Resolve<<Resource>Props> = Input.Resolve<<Resource>Props>
> {
  /** Server-generated ID (stable). */
  id: number;

  /** Resource name. */
  name: string;

  /** ISO creation timestamp. */
  createdAt: string | undefined;
}

/**
 * A <Service> <Resource> for <one-line purpose description>.
 *
 * @section Creating <Resource>s
 * @example Basic <Resource>
 * ```typescript
 * class My<Resource> extends <Resource>("My<Resource>", {
 *   name: "Example",
 * }) {}
 * ```
 *
 * @section Updating <Resource>s
 * @example Update Name
 * ```typescript
 * class Updated<Resource> extends <Resource>("My<Resource>", {
 *   name: "Updated Example",
 * }) {}
 * ```
 */
export interface <Resource><
  ID extends string = string,
  Props extends <Resource>Props = <Resource>Props,
> extends Resource<
  "<Service>.<Resource>",
  ID,
  Props,
  <Resource>Attrs<Input.Resolve<Props>>,
  <Resource>
> {}

export const <Resource> = Resource<{
  <const ID extends string, const Props extends <Resource>Props>(
    id: ID,
    props: Props
  ): <Resource><ID, Props>;
}>("<Service>.<Resource>");
```

### Critical Rules for Resource Definitions

1. **`Input<T>` usage**: ONLY wrap properties that may reference another resource's output. NEVER wrap identifiers (`key`, `name`) that must be statically known in `diff`.
2. **`Input.Resolve<Props>`**: Use on the Attrs interface generic parameter so attrs see resolved (non-lazy) types.
3. **Attrs `_Props` generic**: Prefixed with `_` when not used in the body (TypeScript convention).
4. **Resource type name**: Two-level convention: `"<Service>.<Resource>"` (e.g. `"PostHog.FeatureFlag"`).
5. **JSDoc**: Every prop and attr gets a JSDoc comment. The Resource export gets `@section`/`@example` blocks.
6. **ID types**: Most SaaS APIs return `number` IDs. Some (like surveys) return string UUIDs — use the correct type.

---

# PHASE 3: Provider Implementation

See `ref-provider.md` for a complete example.

## 3.1 Provider File (`<resource>.provider.ts`)

```typescript
import * as <Service>API from "@packages/<service>/<resources>";
import * as Effect from "effect/Effect";

import type { <Resource>Attrs } from "./<resource>";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { <Resource> as <Resource>Resource } from "./<resource>";

/**
 * Maps a <Service> API response to <Resource>Attrs.
 */
function mapResponseToAttrs(
  result: <Service>API.<Resource>,
): <Resource>Attrs {
  return {
    id: result.id,
    name: result.name,
    createdAt: result.created_at,
  };
}

/**
 * Provider for <Service> <Resource> resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const <resource>Provider = () =>
  <Resource>Resource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // Properties that trigger REPLACEMENT (resource must be recreated):
          if (news.key !== olds.key) {
            return { action: "replace" };
          }
          // Properties that trigger UPDATE:
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            JSON.stringify(news.filters) !== JSON.stringify(olds.filters)
          ) {
            return { action: "update" };
          }
          // No changes
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // Primary: lookup by ID
          if (output?.id) {
            const result = yield* retryPolicy(
              <Service>API.get<Resource>({
                project_id: projectId,
                id: output.id,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined)),
            );

            if (result) {
              return mapResponseToAttrs(result);
            }
          }

          // Fallback: paginated scan by unique key to recover from state loss
          if (olds?.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                <Service>API.list<Resources>({
                  project_id: projectId,
                  limit,
                  offset,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.results?.length) break;

              const match = page.results.find(
                (r) => r.name === olds.name && !r.deleted,
              );

              if (match) {
                return mapResponseToAttrs(match);
              }

              if (!page.next) break;
              offset += limit;
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // IDEMPOTENCY: scan for existing resource with same unique key.
          // State persistence can fail after create, so retries call create again.
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              <Service>API.list<Resources>({
                project_id: projectId,
                limit,
                offset,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (!page?.results?.length) break;

            const existing = page.results.find(
              (r) => r.name === news.name && !r.deleted,
            );

            if (existing) {
              yield* session.note(
                `Idempotent <Resource>: found existing with name ${existing.name}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            <Service>API.create<Resource>({
              project_id: projectId,
              name: news.name,
              description: news.description,
              // Map camelCase props to snake_case API fields
            }),
          );

          yield* session.note(`Created <Resource>: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            <Service>API.update<Resource>({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
            }),
          );

          yield* session.note(`Updated <Resource>: ${result.name}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            <Service>API.delete<Resource>({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted <Resource>: ${output.name}`);
        }),
      };
    }),
  );
```

### Critical Rules for Providers

1. **`stables`**: List properties that never change across updates. Always includes `id`. Include immutable keys (e.g., `"key"` for feature flags).
2. **`diff`**:
   - Use `Effect.fnUntraced` (lightweight, no tracing overhead).
   - Return `{ action: "replace" }` for breaking property changes.
   - Return `{ action: "update" }` for updateable property changes.
   - Return `undefined` for no changes.
   - Use `JSON.stringify` for deep comparison of objects/arrays.
   - NEVER return `"no-op"` — return `undefined` instead.
3. **`read`**: Always implement. Primary lookup by ID, fallback by unique key via paginated scan. Catches `NotFoundError` → `undefined`.
4. **`create`**: MUST be idempotent. Scan for existing resource by unique key before creating. Use paginated scan. Log via `session.note()`.
5. **`update`**: Spread `{ ...output, ...mapResponseToAttrs(result) }` to preserve stable attrs.
6. **`delete`**: Catch `NotFoundError` → `Effect.void` (idempotent). Some APIs require soft-delete via PATCH (e.g., `archived: true` or `deleted: true`).
7. **`retryPolicy`**: Wrap EVERY API call in `retryPolicy()`. Never inline retry logic.
8. **`mapResponseToAttrs`**: Separate function to map snake_case API responses to camelCase Attrs.
9. **Context**: Yield project/account ID at the top of the provider effect, not inside each lifecycle method.
10. **Naming**: Provider function is `<resource>Provider` (camelCase). Resource alias is `<Resource>Resource` to avoid name collision with the import.

---

# PHASE 4: Infrastructure Files

See the `ref-config.md`, `ref-project.md`, `ref-credentials.md`, `ref-endpoint.md`, `ref-retry.md`, and `ref-index.md` reference files.

## 4.1 Config (StageConfig Augmentation)

```typescript
// src/<service>/config.ts
export interface <Service>StageConfig {
  /** Project/account ID */
  projectId: string;
  /** API key. Falls back to <SERVICE>_API_KEY env var. */
  apiKey?: string;
  /** API endpoint. Defaults to https://api.<service>.com */
  endpoint?: string;
}

declare module "alchemy-effect" {
  interface StageConfig {
    <service>?: <Service>StageConfig;
  }
}
```

## 4.2 Project Context Tag

```typescript
// src/<service>/project.ts
import { App } from "alchemy-effect";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export class Project extends Context.Tag("<Service>::ProjectId")<
  Project,
  string
>() {}

export const fromStageConfig = () =>
  Layer.effect(
    Project,
    Effect.gen(function* () {
      const app = yield* App;
      if (app.config.<service>?.projectId) {
        return app.config.<service>.projectId;
      }
      const projectId = yield* Config.string("<SERVICE>_PROJECT_ID").pipe(
        Effect.catchAll(() =>
          Effect.dieMessage(
            "<Service> project ID is not set. Provide via stage config (<service>.projectId) or <SERVICE>_PROJECT_ID env var."
          )
        )
      );
      return projectId;
    })
  );
```

## 4.3 Credentials Layer

```typescript
// src/<service>/credentials.ts
import { Credentials } from "@packages/<service>/Credentials";
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
      if (app.config.<service>?.apiKey) {
        return { apiKey: Redacted.make(app.config.<service>.apiKey) };
      }
      const apiKey = yield* Config.redacted("<SERVICE>_API_KEY");
      return { apiKey };
    })
  );
```

## 4.4 Endpoint Layer

```typescript
// src/<service>/endpoint.ts
import { Endpoint } from "@packages/<service>";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const fromStageConfig = () =>
  Layer.effect(
    Endpoint,
    Effect.gen(function* () {
      const app = yield* App;
      return app.config.<service>?.endpoint ?? "https://api.<service>.com";
    })
  );
```

## 4.5 Retry Policy

```typescript
// src/<service>/retry.ts
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

function isRetryable(error: { readonly _tag: string }): boolean {
  switch (error._tag) {
    case "RateLimitError":
    case "ServerError":
    case "UnknownServiceError":
      return true;
    default:
      return false;
  }
}

/**
 * Centralized retry policy for all <Service> API operations.
 * Exponential backoff: 200ms base, max 5 retries.
 * Only retries transient errors (429, 5xx).
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

## 4.6 Main Index (Provider Composition)

```typescript
// src/<service>/index.ts
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import "./config";
import * as Credentials from "./credentials";
import * as Endpoint from "./endpoint";
export { Project } from "./project";
import * as Project from "./project";

// Import all resource modules
import * as ResourceA from "./resource-a/index";
import * as ResourceB from "./resource-b/index";
export { ResourceA, ResourceB };

/**
 * Read the stage config from the App context.
 */
export const stageConfig = () =>
  Effect.gen(function* () {
    const app = yield* App;
    return app.config.<service>;
  });

/**
 * Compose a Layer with stage config layers (Project, Credentials, Endpoint).
 * Does not include HttpClient — callers provide their own.
 */
export const config = <L extends Layer.Layer<any, any, any>>(layer: L) =>
  layer.pipe(
    Layer.provideMerge(Project.fromStageConfig()),
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
  );

/**
 * All resource providers merged into a single Layer.
 */
export const resources = () =>
  Layer.mergeAll(
    ResourceA.resourceAProvider(),
    ResourceB.resourceBProvider(),
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

## 4.7 Resource Index (Barrel Export)

```typescript
// src/<service>/<resource>/index.ts
import "../config";

export * from "./<resource>";
export * from "./<resource>.provider";
```

**IMPORTANT**: The `import "../config"` side-effect import ensures the StageConfig module augmentation is loaded.

---

# PHASE 5: Test Implementation

See `ref-test-utils.md` and `ref-test.md` for complete examples.

## 5.1 Test Utilities (`test/<service>/test.ts`)

The test helper provides:
- Full alchemy environment (App, State, CLI mock)
- Platform layers (NodeContext, FetchHttpClient, Logger)
- Service layers (Credentials, Endpoint, Project from env)
- DotEnv loading via `@effect/platform`
- `makeAssertDeleted` factory for deletion verification with retry

## 5.2 Provider Test Pattern

Every resource test covers:
1. **Create** — apply a resource, verify attrs, verify via direct API call
2. **Update** — apply with changed props, verify ID stability
3. **Delete** — destroy, verify via assertDeleted helper
4. **Replace** (if applicable) — change an immutable key, verify new ID

### Critical Rules for Tests

1. **Always `destroy()` first** to clean state from previous failed runs.
2. **Timeout**: `120_000` for single-resource, `180_000` for smoke tests.
3. **Verify via direct API**: Don't just check `apply()` return — also fetch from the API.
4. **ID stability**: Assert IDs don't change on update, DO change on replacement.
5. **`Effect.provide(<Service>.providers())`** at the end of every test.

---

# PHASE 6: Delete Strategies

Different APIs handle deletion differently. Choose the right strategy:

| Strategy | When | Implementation |
|----------|------|---------------|
| **Hard DELETE** | API supports `DELETE /resource/:id` | `deleteResource({ id })` + catch NotFoundError |
| **Soft archive** | API returns 405 on DELETE | `updateResource({ id, archived: true })` + catch NotFoundError |
| **Soft delete** | API supports PATCH with deleted flag | `updateResource({ id, deleted: true })` + catch NotFoundError |

When scanning lists, filter out soft-deleted resources: `!r.deleted && !r.archived`.

---

# PHASE 7: Idempotency Strategies

SaaS APIs rarely support deterministic ID generation. Use these strategies:

1. **Unique key scan** (e.g., FeatureFlag.key): Paginated scan for exact match on unique field.
2. **Name scan** (e.g., Dashboard.name): Paginated scan for name match. Filter out deleted/archived.
3. **Search parameter** (e.g., Survey): If the API supports `?search=`, use it to reduce scan size.
4. **Content + date** (e.g., Annotation): Combine multiple fields for uniqueness.

Always use paginated scan with `limit=100` and `offset` increment. Check `page.next` to know when to stop.

---

# PHASE 8: Checklist

Before submitting a PR:

- [ ] Every resource has `Props`, `Attrs`, `Resource` interface, and `Resource` export
- [ ] Every resource has `@section`/`@example` JSDoc on the Resource export
- [ ] Every prop and attr has a JSDoc comment
- [ ] Key props have `@example` inline values
- [ ] Every provider implements all 5 lifecycle methods: `diff`, `read`, `create`, `update`, `delete`
- [ ] Every API call is wrapped in `retryPolicy()`
- [ ] Every `delete` catches `NotFoundError` → `Effect.void`
- [ ] Every `create` has idempotency check via paginated scan
- [ ] Every `read` has ID-based primary lookup and fallback scan
- [ ] `stables` array is `as const` and lists all immutable properties
- [ ] `diff` returns `"replace"` for breaking changes, `"update"` for updateable changes, `undefined` for no-op
- [ ] `mapResponseToAttrs` maps snake_case API → camelCase Attrs
- [ ] Provider composition in `index.ts` uses `Layer.mergeAll`
- [ ] `config.ts` augments `alchemy-effect`'s `StageConfig` interface
- [ ] `credentials.ts` uses `Redacted.make()` for API keys
- [ ] Tests cover create, update, delete, and replacement (if applicable)
- [ ] Smoke test covers cross-resource references
- [ ] `bun run check-types` passes
- [ ] `bun run test` passes (with `.env` credentials)
- [ ] `turbo build` produces clean output (no verbose logs)

---

# APPENDIX A: `Input<T>` Cross-Resource References

See `ref-survey-resource.md` for a complete example.

When a resource property may receive its value from **another resource's output attribute** (e.g., `myFeatureFlag.id`), wrap the type in `Input<T>`:

```typescript
// In Props — the value may be lazy (resolved at apply-time)
linkedFlagId?: Input<number | null>;
```

Then use `Input.Resolve<Props>` in the Attrs generic so that resolved (non-lazy) types flow through:

```typescript
export interface SurveyAttrs<
  _Props extends Input.Resolve<SurveyProps> = Input.Resolve<SurveyProps>
> {
  id: string;
  // ...
}
```

And on the Resource interface:

```typescript
export interface Survey<
  ID extends string = string,
  Props extends SurveyProps = SurveyProps,
> extends Resource<"PostHog.Survey", ID, Props, SurveyAttrs<Input.Resolve<Props>>, Survey> {}
```

### When to use `Input<T>`

- **DO**: Properties that reference another resource's output (`linkedFlagId`, `parentId`, `dashboardId`)
- **DON'T**: Static identifiers (`key`, `name`, `type`) — these must be statically known at `diff` time

---

# APPENDIX B: String UUID vs Number IDs

Most SaaS APIs return numeric IDs (`id: number`). Some return string UUIDs (e.g., PostHog Surveys use `id: string`).

Match the API's return type in your Attrs interface. This affects:
- `stables: ["id"] as const` — works the same for both types
- `read` ID lookup — passes string or number to the get API
- `create` idempotency scan — comparison works the same for both

No special handling is needed beyond using the correct type in Attrs.

---

# APPENDIX C: Stack Definition (`alchemy.run.ts`)

See `ref-alchemy-run.md` for a complete example.

Every provider package includes an `alchemy.run.ts` showing how to wire up resources in a deployable stack:

```typescript
import { defineStack, defineStages, type StageConfig, USER } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Config from "effect/Config";
import * as <Service> from "./src/<service>/index.js";
import { <ResourceA> } from "./src/<service>/<resource-a>/index.js";

// 1. Define stages — reads config from env/stage
const stages = defineStages(
  Effect.fn(function* () {
    return {
      <service>: {
        projectId: yield* Config.string("<SERVICE>_PROJECT_ID"),
      },
    } satisfies StageConfig;
  }),
);

// 2. Declare resource instances
export class MyResource extends <ResourceA>("MyResource", {
  name: "Example",
}) {}

// 3. Define the stack
const stack = defineStack({
  name: "<service>-resources",
  stages,
  resources: [MyResource],
  providers: <Service>.providers(),
  tap: (outputs) =>
    Effect.log(`Deployed: ${Object.keys(outputs).join(", ")}`),
});

// 4. Stage refs for deployment targets
export const MyApp = stages
  .ref<typeof stack>("<service>-resources")
  .as({
    prod: "prod",
    staging: "staging",
    dev: (user: USER = USER) => `dev_${user}`,
  });

export default stack;
```

---

# APPENDIX D: Environment & `.env` Structure

Every provider package needs a `.env` file (gitignored) for tests and alchemy CLI:

```
<SERVICE>_API_KEY=phx_xxxxxxxxxxxxxxxxxxxx
<SERVICE>_PROJECT_ID=12345
```

These are read by:
- `bun --env-file=.env vitest run` (test script)
- `credentials.ts` via `Config.redacted("<SERVICE>_API_KEY")`
- `project.ts` via `Config.string("<SERVICE>_PROJECT_ID")`

Stage config takes precedence over env vars when both are present.

---

# APPENDIX E: `vitest.config.ts` Alias Mapping

The `resolve.alias` block in `vitest.config.ts` must map **each SDK service export** to its source `.ts` file so tests resolve workspace packages correctly:

```typescript
alias: {
  // Provider package internal alias
  "@": path.resolve(__dirname, "src"),

  // One entry per SDK service export (e.g., @packages/posthog/feature-flags)
  "@packages/<service>/<resource-a>": path.resolve(
    __dirname, "../<service>/src/services/<resource-a>.ts"
  ),
  "@packages/<service>/<resource-b>": path.resolve(
    __dirname, "../<service>/src/services/<resource-b>.ts"
  ),

  // SDK credentials
  "@packages/<service>/Credentials": path.resolve(
    __dirname, "../<service>/src/credentials.ts"
  ),

  // SDK root (must be LAST — more specific paths above take precedence)
  "@packages/<service>": path.resolve(
    __dirname, "../<service>/src/index.ts"
  ),
},
```

**Critical**: Order matters — more specific paths must precede less specific ones.

---

# APPENDIX F: Test CLI Mock & Happy Eyeballs Workaround

See `ref-test-utils.md` for the complete test helper.

### Test CLI Mock

Tests mock the alchemy CLI to avoid running the full deployment pipeline:

```typescript
const testCLI = (): Layer.Layer<CLI> =>
  Layer.succeed(CLI, {
    prompt: () => Effect.succeed(true),
    note: () => Effect.void,
    notes: () => Effect.void,
    confirm: () => Effect.succeed(true),
    enabled: true,
  });
```

### Happy Eyeballs / DNS Workaround

Some test environments have IPv6 DNS issues causing `UND_ERR_CONNECT_TIMEOUT`. The test helper disables DNS address sorting as a workaround:

```typescript
import { setDefaultAutoSelectFamily } from "node:net";
setDefaultAutoSelectFamily(false);
```

This is placed at the top of the test utility file, outside any test function.

---

# APPENDIX G: Smoke Test (Multi-Resource Integration)

See `ref-smoke-test.md` for a complete example.

Every provider package should include a smoke test that:

1. Destroys any leftover state (`yield* destroy()`)
2. Creates multiple resources together via `yield* apply(ResourceA, ResourceB, ResourceC)`
3. Verifies each resource's attributes and fetches from the API directly
4. Destroys all resources (`yield* destroy()`)
5. Verifies all resources are cleaned up via `assertDeleted` helpers

The smoke test uses `Effect.provide(<Service>.providers())` — the same provider layer used in production.

---

# APPENDIX H: Pre-Create Omission Rationale

SaaS providers intentionally omit `pre-create` hooks. Unlike infrastructure providers (AWS, GCP) that need to validate quotas or permissions before provisioning, SaaS APIs are fast and cheap — a failed create is trivially retried. The idempotency scan in `create` handles retries after partial failures.

---

# APPENDIX I: SDK Client Dependency

This skill covers the **alchemy provider** layer only. The provider depends on a **typed Effect-based SDK client** (`@packages/<service>`).

Use the `distilled-client` skill to create the SDK client first. The client provides:
- Typed CRUD operations (`getResource`, `listResources`, `createResource`, `updateResource`, `deleteResource`)
- Error types (`NotFoundError`, `RateLimitError`, `ServerError`, `UnknownServiceError`)
- `Credentials` Context.Tag for API key injection
- `Endpoint` Context.Tag for base URL injection
- Pagination support (`{ results, next, count }`)
