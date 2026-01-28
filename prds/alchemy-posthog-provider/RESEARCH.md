# Research Notes

This document captures research findings, discoveries, and technical notes
accumulated while designing the alchemy-effect PostHog provider.

---

## Package Location Decision (SETUP-001)

**Decision:** Created a new `@packages/alchemy-posthog` package in `packages/alchemy-posthog/` rather than modifying the alchemy-effect submodule.

**Rationale:**
- alchemy-effect is an external open-source package at `.context/alchemy-effect/` (submodule, read-only context)
- `alchemy-effect@0.6.0` is published on npm and can be used as a dependency
- `@packages/posthog` is the local equivalent of "distilled-posthog" referenced in the PRD
- New package depends on both, focusing only on the PostHog provider code

**Export Convention Difference:**
- alchemy-effect uses: `{ types, bun, import }` conditions
- This repo uses: `{ import: { "@packages/source", types, default } }` conditions
- New package follows this repo's convention for consistency

---

## Provider Architecture Pattern

### How distilled-* Libraries Become alchemy-effect Providers

The alchemy-effect framework uses a zero-wrapping pattern. `distilled-aws` and `distilled-cloudflare` are consumed directly — their Effect-returning functions are `yield*`-ed inside provider lifecycle operations with no intermediate adapter layer.

```
distilled-{cloud} (typed Effect SDK)
  |-- Per-service modules returning Effect<Result, TypedError, Requirements>
  |-- Shared context: Credentials, Region/Account, Endpoint
  v
alchemy-effect provider
  |-- Resource contracts: Props, Attrs, Resource type declaration
  |-- Resource providers: CRUD lifecycle (create/update/delete/diff/read)
  |-- Config layers: bridge stage config → distilled-* Context.Tags
  |-- Layer composition: resources() + providers() merging all layers
```

**Key finding:** There is NO wrapping or translation layer. The distilled-* functions return `Effect` values that are directly `yield*`-ed. The only "glue" is Layer composition providing context dependencies from alchemy-effect's stage config system.

**Reference:** `.context/alchemy-effect/AGENTS.md` (lines 1-512) — comprehensive guide for provider development.

---

## alchemy-effect Core Abstractions

### Resource Type

Created via `Resource<CtorSignature>("Fully.Qualified.Type")`. Each resource has:
- `type`: FQN string, e.g. `"AWS.SQS.Queue"`, `"Cloudflare.KV.Namespace"`
- `id`: Logical ID (user-defined string, stable across lifecycle)
- `props`: Input Properties (desired state)
- `attr`: Output Attributes (current state after deployment)
- `provider`: Has `.effect()` and `.succeed()` for creating Layers

**Reference:** `.context/alchemy-effect/alchemy-effect/src/resource.ts`

### ProviderService Interface

CRUD lifecycle implementation with these methods:
- `stables?: string[]` — attribute keys that never change across updates
- `diff?(input)` — returns `{ action: "replace" }`, `{ action: "update" }`, `{ action: "noop" }`, or `void` (default update)
- `read?(input)` — refresh state from cloud provider, return `undefined` if not found
- `create(input)` — create new resource (must be idempotent)
- `update(input)` — update existing resource
- `delete(input)` — delete resource (must be idempotent)

Each lifecycle method receives: `{ id, instanceId, news, olds, output, session, bindings }`.

**Critical rules from AGENTS.md:**
- Never use `Effect.orDie` in lifecycle operations (crashes IaC engine)
- Never use `Date.now()` for physical names in tests
- Delete must be idempotent — already-deleted is not an error
- Create must be idempotent — handle "already exists" gracefully
- Get config INSIDE lifecycle operations, not in the Layer effect
- Use `session.note()` for progress reporting

**Reference:** `.context/alchemy-effect/alchemy-effect/src/provider.ts`

### Provider Registration Pattern

```typescript
export const featureFlagProvider = () =>
  FeatureFlag.provider.effect(
    Effect.gen(function* () {
      // Dependencies resolved here or inside lifecycle ops
      return {
        stables: ["id", "key"],
        diff: Effect.fn(function* ({ news, olds }) { ... }),
        create: Effect.fn(function* ({ news, session }) { ... }),
        update: Effect.fn(function* ({ news, output, session }) { ... }),
        delete: Effect.fn(function* ({ output }) { ... }),
        read: Effect.fn(function* ({ output }) { ... }),
      };
    }),
  );
```

**Reference:** `.context/alchemy-effect/alchemy-effect/src/aws/sqs/queue.provider.ts`

---

## Stage Config Pattern

### Module Augmentation

Each cloud provider augments `StageConfig` via TypeScript `declare module`:

```typescript
// aws/config.ts
declare module "../stage.ts" {
  interface StageConfig {
    aws?: AwsStageConfig;
  }
}
```

This allows users to configure providers in their stage files.

**Reference:** `.context/alchemy-effect/alchemy-effect/src/aws/config.ts`

### Context.Tag Bridges

Each provider defines Context.Tags for its dependencies and creates `fromStageConfig()` Layer constructors that read from `App` → `StageConfig`:

```typescript
// Cloudflare pattern
export class Account extends Context.Tag("cloudflare/account-id")<Account, string>() {}

export const fromStageConfig = () =>
  Layer.effect(Account, Effect.gen(function* () {
    const app = yield* App;
    const accountId = app.config.cloudflare?.account ??
      (yield* Config.string("CLOUDFLARE_ACCOUNT_ID"));
    return accountId;
  }));
```

Falls back to environment variables when stage config is not set.

**Reference:** `.context/alchemy-effect/alchemy-effect/src/cloudflare/account.ts`

---

## Cloudflare Provider Pattern (Closest to PostHog)

The Cloudflare provider is the closest reference for PostHog because it also wraps a SaaS API (not raw HTTP like AWS). Key observations:

### CloudflareApi Service

Cloudflare uses a recursive proxy that wraps the `cloudflare` npm SDK, converting all Promise-returning methods to Effect-returning methods with typed `CloudflareApiError`.

PostHog does NOT need this — `distilled-posthog` already returns Effect values natively.

### KV Namespace Provider (Simplest Example)

```typescript
export const namespaceProvider = () =>
  Namespace.provider.effect(
    Effect.gen(function* () {
      const api = yield* CloudflareApi;
      const accountId = yield* Account;

      return {
        stables: ["namespaceId", "accountId"],
        create: Effect.fn(function* ({ id, news }) { ... }),
        update: Effect.fn(function* ({ id, news, output }) { ... }),
        delete: Effect.fn(function* ({ output }) {
          yield* api.kv.namespaces.delete(output.namespaceId, { ... })
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
        read: Effect.fn(function* ({ id, olds, output }) { ... }),
      };
    }),
  );
```

**Key pattern:** Dependencies (`api`, `accountId`) resolved at provider level, then used in lifecycle ops. Delete catches "NotFound" as success.

**Reference:** `.context/alchemy-effect/alchemy-effect/src/cloudflare/kv/namespace.provider.ts`

---

## distilled-posthog Package Structure

### Package Identity
- **Name:** `@packages/posthog` (distilled-posthog)
- **Based on:** distilled-aws architecture, simplified for REST-JSON (no SigV4, no XML)
- **Dependencies:** `effect`, `@effect/platform` (peer)

### Context Tags

| Tag | ID | Value Type |
|-----|----|-----------| 
| `Credentials` | `@posthog/Credentials` | `{ apiKey: Redacted<string> }` |
| `Endpoint` | `@posthog/Endpoint` | `string` (URL) |
| `Retry` | `@posthog/Retry` | `{ while?, schedule? }` |

Layer constructors: `Credentials.fromEnv()`, `Credentials.fromApiKey(str)`, `Credentials.fromRedactedApiKey(redacted)`.

### Service Functions

Every function returns `Effect<Output, PostHogErrorType, HttpClient | Credentials | Endpoint>`.

| Service | Operations | Delete Strategy |
|---------|-----------|-----------------|
| FeatureFlags | list, get, create, update, delete | Soft (PATCH deleted:true) |
| Dashboards | list, get, create, update, delete | Soft (PATCH deleted:true) |
| Experiments | list, get, create, update, delete | Hard (HTTP DELETE) |
| Surveys | list, get, create, update, delete | Hard (HTTP DELETE) |
| Cohorts | list, get, create, update, delete | Soft (PATCH deleted:true) |
| Actions | list, get, create, update, delete | Soft (PATCH deleted:true) |
| Annotations | list, get, create, update, delete | Hard (HTTP DELETE) |
| Insights | list, get, create, update, delete | Soft (PATCH deleted:true) |

### Error Types (TaggedError)

`AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ValidationError`, `RateLimitError`, `ServerError`, `UnknownPostHogError`, `PostHogError`.

All use `_tag` discriminator. Providers catch `NotFoundError` on delete for idempotency.

**Reference:** `packages/posthog/src/errors.ts`

### ID Types

- Most resources: `number` (server-generated integer)
- Surveys: `string` (UUID)

### API Path Prefix

- Dashboards: `/api/environments/{project_id}/`
- All others: `/api/projects/{project_id}/`

---

## PostHog vs AWS vs Cloudflare: Key Differences

| Aspect | AWS | Cloudflare | PostHog |
|--------|-----|-----------|---------|
| Auth | SigV4 | API Token/Key | Bearer token (API Key) |
| Resource IDs | Deterministic (physical name) | Server-generated | Server-generated integer/UUID |
| Idempotency | Physical name + tags | Title lookup | Store ID in output attrs |
| Delete | Hard delete | Hard delete | Mix of soft and hard |
| Scoping | Region + Account | Account | Project ID |
| Tags | First-class tag system | No | No |
| Bindings/Capabilities | IAM Policies + Env Vars | Worker Bindings | N/A |
| SDK | distilled-aws (Effect-native) | cloudflare npm (Promise→Effect proxy) | distilled-posthog (Effect-native) |

### PostHog-Specific Design Decisions

1. **No Bindings/Capabilities** — PostHog is a SaaS API. No IAM policies, no environment variable bindings, no event sources.
2. **Project scoping** — All resources scoped to `project_id`. Use a `Project` Context.Tag (analogous to `Account`).
3. **Server-generated IDs** — Provider stores the integer/UUID ID in output attrs, uses it for read/update/delete.
4. **Soft delete handling** — Some resources use PATCH `deleted: true`, others use HTTP DELETE. Each provider implements the correct strategy.
5. **HttpClient dependency** — distilled-posthog requires `@effect/platform` `HttpClient`. Providers layer must include `FetchHttpClient.layer`.

---

## Test Patterns

### alchemy-effect Test Utility (`src/test.ts`)

The `test()` function wraps `it.scopedLive()` from `@effect/vitest` and auto-provides:
- `App` (with name/stage/config from test context)
- `State` (in-memory or local filesystem)
- `DotAlchemy` (`.alchemy` directory management)
- `HttpClient` (via `FetchHttpClient`)
- `FileSystem`, `Path` (via `NodeContext`)
- Cloud-specific layers (Credentials, Region, etc.)

Usage: `test("name", Effect.gen(...).pipe(Effect.provide(CloudProvider.providers())))`.

### Test Verification Pattern

Tests verify cloud state by calling distilled-* APIs directly after `apply()`:

```typescript
const stack = yield* apply(TestResource);
const actual = yield* API.getResource({ id: stack.TestResource.id });
expect(actual.field).toEqual(expected);
```

### Delete Verification Pattern

```typescript
class ResourceStillExists extends Data.TaggedError("ResourceStillExists") {}

const assertDeleted = Effect.fn(function* (id, projectId) {
  yield* API.getResource({ project_id: projectId, id }).pipe(
    Effect.flatMap(() => Effect.fail(new ResourceStillExists())),
    Effect.retry({
      while: (e) => e instanceof ResourceStillExists,
      schedule: Schedule.exponential(100),
    }),
    Effect.catchTag("NotFoundError", () => Effect.void),
  );
});
```

**Reference:** `.context/alchemy-effect/alchemy-effect/test/cloudflare/kv/namespace.provider.test.ts`

---

## File System Conventions

```
src/{cloud}/{service}/
  index.ts                  # Barrel exports
  {resource}.ts             # Resource contract (Props, Attrs, Resource declaration)
  {resource}.provider.ts    # Provider implementation (CRUD lifecycle)

test/{cloud}/{service}/
  {resource}.provider.test.ts  # Provider integration tests
```

Package.json exports follow: `"./{cloud}/{service}"` → `"src/{cloud}/{service}/index.ts"`.

---

## Module Augmentation from External Package (SETUP-002)

Since `@packages/alchemy-posthog` is a **separate package** from `alchemy-effect`, the `declare module` augmentation syntax must use the **npm package name** rather than a relative path:

```typescript
// ✅ External package — use package name
declare module "alchemy-effect" {
  interface StageConfig {
    posthog?: PostHogStageConfig;
  }
}

// ❌ This only works inside alchemy-effect itself
declare module "../stage.ts" { ... }
```

This works because `alchemy-effect/src/index.ts` re-exports `StageConfig` via `export * from "./stage.ts"`, making it part of the `"alchemy-effect"` module declaration.

### Endpoint Default Difference

- `@packages/posthog` defaults to `https://app.posthog.com` (Endpoint.DEFAULT)
- The SPEC specifies `https://us.posthog.com` as the provider default
- The `endpoint.ts` bridge uses `https://us.posthog.com` per SPEC

---

## Package.json Export Pattern

Each subpath export has three conditions:

```json
{
  "./posthog": {
    "types": "./lib/posthog/index.d.ts",
    "bun": "./src/posthog/index.ts",
    "import": "./lib/posthog/index.js"
  }
}
```

**Reference:** `.context/alchemy-effect/alchemy-effect/package.json`

---

## Layer Composition Pattern

### Cloud-Level Index

```typescript
export const resources = () =>
  Layer.mergeAll(
    resourceProvider1(),
    resourceProvider2(),
    // ...
  );

export const providers = () =>
  resources().pipe(
    Layer.provideMerge(Project.fromStageConfig()),
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
    Layer.provideMerge(FetchHttpClient.layer),
  );
```

**Reference:** `.context/alchemy-effect/alchemy-effect/src/cloudflare/live.ts`

---

## Layer.empty vs Layer.mergeAll() (SETUP-003)

`Layer.mergeAll()` requires at least 1 argument in the Effect type system. Since the initial `resources()` has no providers yet, we use `Layer.empty` as the starting point. As providers are added in subsequent tasks, this will be replaced with `Layer.mergeAll(provider1(), provider2(), ...)`.

### Import Extension Convention

This repo uses `moduleResolution: "Bundler"` without `allowImportingTsExtensions`, so relative imports must use `.js` extensions (not `.ts`). This matches the convention used in `@packages/posthog`.
