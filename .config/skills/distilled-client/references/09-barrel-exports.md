# Barrel Exports Reference

The `index.ts` barrel export defines the public API surface of the package.

## Canonical Reference

- `packages/posthog/src/index.ts`

## Pattern

```typescript
/**
 * distilled-<service>
 *
 * A typed <Service> SDK for Effect, built from OpenAPI specifications.
 */

// Core
export { Credentials, type <Service>Credentials } from "./credentials.js";
export { Endpoint } from "./endpoint.js";

// Client utilities (for advanced usage)
export { makePaginated } from "./client/api.js";

// Shared schemas
export { UserBasic } from "./common.js";

// Error types (named exports for direct import)
export {
  AuthenticationError,
  AuthorizationError,
  COMMON_ERRORS,
  COMMON_ERRORS_WITH_NOT_FOUND,
  MissingCredentialsError,
  NotFoundError,
  RateLimitError,
  ServerError,
  UnknownServiceError,
  ValidationError,
} from "./errors.js";

// Error categories (namespace import for predicate-based catch)
export * as Category from "./category.js";

// Retry policies (namespace import)
export * as Retry from "./retry.js";

// Trait annotations (namespace import — for advanced/generated service authoring)
export * as Traits from "./traits.js";

// Services (each as a namespace module)
export * as Me from "./services/me.js";
export * as Dashboards from "./services/dashboards.js";
export * as FeatureFlags from "./services/feature-flags.js";
export * as Insights from "./services/insights.js";
export * as Cohorts from "./services/cohorts.js";
export * as Events from "./services/events.js";
export * as Persons from "./services/persons.js";
export * as Surveys from "./services/surveys.js";
export * as Actions from "./services/actions.js";
export * as Annotations from "./services/annotations.js";
export * as Experiments from "./services/experiments.js";
```

## Import Styles Available to Consumers

```typescript
// Barrel import — access everything via namespace
import { Dashboards, FeatureFlags, Credentials, Endpoint } from "@packages/<service>";
const result = await Dashboards.listDashboards({ project_id: "123" });

// Direct service import (via wildcard export)
import { listDashboards, Dashboard } from "@packages/<service>/dashboards";

// Infrastructure imports
import { Credentials } from "@packages/<service>/Credentials";
import { Retry } from "@packages/<service>/Retry";
import { AuthenticationError, NotFoundError } from "@packages/<service>/Errors";
```

## Conventions

1. **Services as namespaces** — `export * as ServiceName from "./services/file.js"`
2. **Infrastructure as named exports** — Credentials, Endpoint, error classes
3. **Category and Retry as namespaces** — for `Category.catchNotFoundError()`, `Retry.none`
4. **Traits as namespace** — only needed by service authors, not consumers
5. **`.js` extensions** — required for ESM resolution
