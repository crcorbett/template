# @packages/posthog

A typed PostHog SDK for [Effect](https://effect.website), providing fully typed API operations with schema-validated responses, automatic retry policies, and composable error handling.

## Setup

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTHOG_API_KEY` | Yes | Your PostHog personal API key |
| `POSTHOG_PROJECT_ID` | Yes | The numeric project ID |
| `POSTHOG_ENDPOINT` | No | API endpoint (defaults to `https://app.posthog.com`) |

Create a `.env` file at the repository root:

```env
POSTHOG_API_KEY="phx_your_api_key_here"
POSTHOG_PROJECT_ID="123456"
POSTHOG_ENDPOINT="https://us.posthog.com"
```

### Peer Dependencies

```json
{
  "effect": "^3.16.0",
  "@effect/platform": "^0.82.0"
}
```

## Available Services

| Service | Operations | Notes |
|---|---|---|
| **Me** | `getMe` | Current authenticated user |
| **Dashboards** | `list`, `get`, `create`, `update`, `delete` | Soft-delete |
| **FeatureFlags** | `list`, `get`, `create`, `update`, `delete` | Rollout percentages, multivariate, property filters |
| **Insights** | `list`, `get`, `create`, `update`, `delete` | TrendsQuery, FunnelsQuery, RetentionQuery |
| **Cohorts** | `list`, `get`, `create`, `update`, `delete` | Dynamic cohorts with AND/OR filter logic |
| **Events** | `list`, `get` | Read-only (events are ingested, not created via API) |
| **Persons** | `list`, `get`, `delete` | No create/update (persons are created implicitly) |
| **Surveys** | `list`, `get`, `create`, `update`, `delete` | Popover, widget, API types; NPS/rating/choice questions |
| **Actions** | `list`, `get`, `create`, `update`, `delete` | Composite events with URL/element matching steps |
| **Annotations** | `list`, `get`, `create`, `update`, `delete` | Chart markers with project/organisation scope |
| **Experiments** | `list`, `get`, `create`, `update`, `delete` | A/B testing with feature flag integration |

## Usage

### Basic Example

```typescript
import { Effect, Config } from "effect";
import { NodeHttpClient } from "@effect/platform-node";
import {
  Credentials,
  Endpoint,
  Dashboards,
  FeatureFlags,
} from "@packages/posthog";

const program = Effect.gen(function* () {
  const projectId = yield* Config.string("POSTHOG_PROJECT_ID");

  // List dashboards
  const dashboards = yield* Dashboards.listDashboards({
    project_id: projectId,
    limit: 10,
  });
  console.log(`Found ${dashboards.results.length} dashboards`);

  // Create a feature flag
  const flag = yield* FeatureFlags.createFeatureFlag({
    project_id: projectId,
    name: "my-new-flag",
    key: "my-new-flag",
    filters: {
      groups: [{ rollout_percentage: 50 }],
    },
  });
  console.log(`Created flag: ${flag.key} (id: ${flag.id})`);
});

// Provide required layers and run
program.pipe(
  Effect.provide(Credentials.fromEnv()),
  Effect.provide(NodeHttpClient.layerUndici),
  Effect.runPromise,
);
```

### With Retry Policy

```typescript
import { Retry, Dashboards } from "@packages/posthog";

const withRetry = Dashboards.listDashboards({
  project_id: projectId,
  limit: 10,
}).pipe(
  // Retry on rate limit and server errors with exponential backoff
  Retry.transient,
);
```

### Available Retry Policies

| Policy | Retries On |
|---|---|
| `Retry.transient` | Rate limit errors + server errors |
| `Retry.throttling` | Rate limit errors only |
| `Retry.none` | No retries |

All policies use exponential backoff (1s base, 2x factor, 5s cap) with jitter.

### Error Handling

```typescript
import { Effect } from "effect";
import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@packages/posthog";

const safe = Dashboards.getDashboard({
  project_id: projectId,
  id: 123,
}).pipe(
  Effect.catchTag("NotFoundError", () =>
    Effect.succeed({ fallback: true }),
  ),
  Effect.catchTag("RateLimitError", () =>
    Effect.sleep("5 seconds").pipe(
      Effect.andThen(
        Dashboards.getDashboard({ project_id: projectId, id: 123 }),
      ),
    ),
  ),
);
```

## Running Tests

All tests are integration tests that hit the real PostHog API. Ensure your `.env` is configured.

```bash
# Run all tests (224 tests across 17 files)
bun run test

# Run a single service's tests
bun run test test/dashboards.test.ts
bun run test test/feature-flags.test.ts

# Watch mode
bun run test:watch
```

## Provisioning Script

A standalone script provisions a complete analytics stack for a sample SaaS application ("Acme Project Manager"):

```bash
bun run scripts/provision-analytics.ts
```

This creates 45 resources: 7 cohorts, 8 feature flags, 14 insights, 3 dashboards, 3 surveys, 4 actions, 4 annotations, and 2 experiments. Resources are prefixed with a unique identifier and left in place (no cleanup).

## Package Exports

```typescript
// Barrel export
import { Dashboards, FeatureFlags, ... } from "@packages/posthog";

// Direct service imports
import { createDashboard } from "@packages/posthog/dashboards";
import { createFeatureFlag } from "@packages/posthog/feature-flags";

// Infrastructure
import { Credentials } from "@packages/posthog/Credentials";
import { Retry } from "@packages/posthog/Retry";
import { ValidationError, NotFoundError, ... } from "@packages/posthog/Errors";
```

## Architecture

The SDK follows the `distilled-aws` pattern:

- **Schema-first** -- All request/response types are Effect `Schema` classes with full encode/decode
- **Operation objects** -- Each API call is defined as an `{ input, output, errors }` triple
- **`makeClient`** -- Generates typed Effect functions from operation definitions
- **Context-based DI** -- Credentials, endpoint, and retry policies are provided via Effect layers
- **Redacted secrets** -- API keys are wrapped in `Redacted<string>` to prevent accidental logging
