# Effect Service/Layer Architecture Patterns

## Branded Types — Nominal Type Safety via Schema.brand()

Branded types are the foundation of type safety in Effect-based systems. They use `Schema.brand()` to create **nominal types** — types that are structurally identical but semantically distinct.

### Why Branded Types

In standard TypeScript, `string` is `string` everywhere. A user ID, an email, a feature flag key, and an API token are all just `string`. This leads to bugs where values are accidentally swapped:

```typescript
// ❌ Standard TypeScript — no protection
function track(userId: string, event: string, flagKey: string) {}
track(flagKey, userId, event) // Compiles fine! But completely wrong.
```

Branded types make each domain primitive its own type:

```typescript
// ✅ Branded types — compile-time protection
function track(userId: DistinctId, event: EventName, flagKey: FlagKey) {}
track(flagKey, userId, event) // ❌ Type error on every argument!
```

### Defining Branded Types

The pattern from this codebase (packages/types, packages/auth):

```typescript
import { Schema } from "effect"

// Pattern 1: String with validation constraints + brand
export const UserId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  Schema.brand("UserId")
)
export type UserId = typeof UserId.Type
// Type: string & Brand<"UserId">

// Pattern 2: String with length constraints + brand
export const SessionToken = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("SessionToken")
)
export type SessionToken = typeof SessionToken.Type

// Pattern 3: Numeric constraints + brand
export const HealthScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("HealthScore")
)
export type HealthScore = typeof HealthScore.Type
// Type: number & Brand<"HealthScore">

// Pattern 4: Literal union + brand (for enumerations)
export const LifecycleStage = Schema.Literal(
  "trial", "active", "expanding", "at_risk", "churned"
).pipe(Schema.brand("LifecycleStage"))
export type LifecycleStage = typeof LifecycleStage.Type
// Type: ("trial" | "active" | ...) & Brand<"LifecycleStage">

// Pattern 5: Sensitive values + brand (credential protection)
export const JwtSecret = Schema.String.pipe(
  Schema.minLength(32),
  Schema.brand("JwtSecret")
)
export type JwtSecret = typeof JwtSecret.Type
```

### Validation at System Boundaries

Branded types enforce constraints at runtime via `Schema.decodeUnknown`:

```typescript
import { Schema, Either, Effect } from "effect"

// Synchronous validation (returns Either)
const parseUserId = Schema.decodeUnknownEither(UserId)
const result = parseUserId("550e8400-e29b-41d4-a716-446655440000")
// => Either.right("550e8400..." as UserId)

const invalid = parseUserId("not-a-uuid")
// => Either.left(ParseError)

// Effectful validation (returns Effect — use in service code)
const program = Effect.gen(function* () {
  const userId = yield* Schema.decode(UserId)("550e8400-...")
  const score = yield* Schema.decode(HealthScore)(85)
  // userId: UserId, score: HealthScore — fully branded
})
```

### Branded Types in Struct Schemas

Branded types compose into struct schemas:

```typescript
const User = Schema.Struct({
  id: UserId,
  email: Email,
  name: Schema.String,
  healthScore: HealthScore,
  lifecycleStage: LifecycleStage,
})
type User = typeof User.Type
// { id: UserId; email: Email; name: string; healthScore: HealthScore; ... }
```

### Branded Types in Service Interfaces

Service method signatures use branded types for all domain values:

```typescript
class Analytics extends Context.Tag("PLG/Analytics")<
  Analytics,
  {
    readonly track: (
      distinctId: DistinctId,    // Not string
      event: EventName,          // Not string
      properties?: EventProperties
    ) => Effect.Effect<void, TrackingError>

    readonly setMrr: (
      id: CustomerId,            // Not string
      mrr: MrrCents,             // Not number — can't pass HealthScore here
    ) => Effect.Effect<void, CustomerError>
  }
>() {}
```

### Cross-Brand Safety

The key value proposition — branded types that share the same underlying type are incompatible:

```typescript
declare const distinctId: DistinctId
declare const customerId: CustomerId
declare const mrr: MrrCents
declare const score: HealthScore

// These all fail at compile time:
const _1: CustomerId = distinctId  // ❌ DistinctId ≠ CustomerId
const _2: HealthScore = mrr        // ❌ MrrCents ≠ HealthScore
const _3: EventName = "raw-string" // ❌ string ≠ EventName
const _4: MrrCents = 4900          // ❌ number ≠ MrrCents
```

### Testing Branded Types

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Schema, Either } from "effect"

describe("UserId", () => {
  it("accepts valid UUID", () => {
    const result = Schema.decodeUnknownEither(UserId)("550e8400-e29b-41d4-a716-446655440000")
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects invalid UUID", () => {
    const result = Schema.decodeUnknownEither(UserId)("not-valid")
    expect(Either.isLeft(result)).toBe(true)
  })
})

// Compile-time tests (in .test-d.ts or with @ts-expect-error)
// @ts-expect-error — raw string not assignable to UserId
const _invalid: UserId = "some-string"
```

### Branded Type Categories for PLG

| Category | Examples | Validation |
|----------|----------|------------|
| **Identity** | DistinctId, CustomerId, GroupId | minLength, maxLength, pattern |
| **Keys** | FlagKey, ExperimentKey, EventName | snake_case/kebab-case pattern |
| **Scores** | HealthScore, NpsScore, CsatScore | int, bounded range |
| **Money** | MrrCents, DealValueCents | int, non-negative |
| **Percentages** | RolloutPercentage, SignificanceLevel | bounded 0-100 or 0-1 |
| **Enums** | LifecycleStage, InsightType, PipelineStage | Literal union |
| **Credentials** | PostHogApiKey, AttioApiKey, JwtSecret | pattern, minLength |
| **IaC** | ResourceId, StackName | pattern, maxLength |

---

## Context.Tag — Abstract Service Definitions

Every service in the codebase is defined as a `Context.Tag`. This establishes an abstract contract that can be fulfilled by different implementations.

```typescript
import { Context } from "effect"

// Define a service interface via Context.Tag
class MyService extends Context.Tag("MyService")<
  MyService,
  {
    readonly doSomething: (input: string) => Effect.Effect<Output, MyError>
    readonly getConfig: Effect.Effect<Config>
  }
>() {}
```

The first type parameter is the tag itself (for nominal typing), and the second is the service interface. Consumers reference `MyService` in their `R` (requirements) type parameter.

## Layer Construction

### Layer.succeed — Immediate Values

For services that require no effectful setup:

```typescript
const MyServiceLive = Layer.succeed(
  MyService,
  {
    doSomething: (input) => Effect.succeed({ result: input }),
    getConfig: Effect.succeed({ timeout: 5000 }),
  }
)
```

### Layer.effect — Effectful Construction

When building a service requires running effects (e.g., reading config, establishing connections):

```typescript
const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const config = yield* Config
    const client = yield* HttpClient.HttpClient
    return {
      doSomething: (input) =>
        client.post(`${config.baseUrl}/api`, { body: input }),
      getConfig: Effect.succeed(config),
    }
  })
)
```

## Layer Composition

### Layer.mergeAll — Parallel Independent Layers

Combines layers that have no dependencies on each other:

```typescript
const AllProviders = Layer.mergeAll(
  FeatureFlagProvider,
  DashboardProvider,
  ExperimentProvider,
  SurveyProvider,
  CohortProvider,
)
```

All layers are constructed independently and in parallel.

### Layer.provideMerge — Chained Dependency Resolution

Adds a dependency layer and makes its output available to downstream layers:

```typescript
// CredentialsLayer provides what AllProviders needs
const FullStack = AllProviders.pipe(
  Layer.provideMerge(CredentialsLayer),
  Layer.provideMerge(HttpClientLayer),
)
```

The order matters: each `Layer.provideMerge` adds a layer to the dependency graph and resolves it for all upstream layers.

## Plugin Pattern via Bindings

The Binding system creates a pluggable capability system:

```typescript
import { Binding } from "alchemy-effect"

// Binding(runtime, capability, tag) creates:
//   1. A Context.Tag for the capability
//   2. A provider factory function
const PostHogBinding = Binding(
  PostHogRuntime,        // The runtime environment
  "posthog",             // Capability name
  PostHogProviderTag     // The Context.Tag for the provider
)
```

Bindings allow the IaC framework to dynamically look up providers by resource type at apply time.

## The R Type Parameter

Effect's `R` (requirements) type parameter propagates through the entire call chain, ensuring all service dependencies are satisfied at compile time.

```typescript
// This function requires MyService and Logger
const myProgram: Effect.Effect<Result, MyError, MyService | Logger>

// Providing MyService removes it from R
const withService: Effect.Effect<Result, MyError, Logger>
  = myProgram.pipe(Effect.provide(MyServiceLive))

// Providing Logger removes it too — R is now `never`
const fullyProvided: Effect.Effect<Result, MyError, never>
  = withService.pipe(Effect.provide(LoggerLive))
```

This is how the codebase ensures at the type level that all PostHog credentials, Attio credentials, HTTP clients, and provider layers are wired correctly before any IaC operation runs.

## Provider Composition Pattern

The codebase uses a three-tier composition:

```typescript
// Tier 1: bareProviders() — just the resource providers
const bareProviders = () =>
  Layer.mergeAll(
    FeatureFlagProvider,
    DashboardProvider,
    ExperimentProvider,
    // ...all resource providers
  )

// Tier 2: config() — adds credentials and region
const config = (creds: Credentials) =>
  bareProviders().pipe(
    Layer.provideMerge(Layer.succeed(CredentialsTag, creds)),
    Layer.provideMerge(Layer.succeed(EndpointTag, { baseUrl: "..." })),
  )

// Tier 3: providers() — adds HTTP client (full runtime)
const providers = (creds: Credentials) =>
  config(creds).pipe(
    Layer.provideMerge(HttpClient.layer),
  )
```

This allows tests to provide mock HTTP clients at Tier 2, while production uses real HTTP at Tier 3.

## Effect.serviceOption — Optional Services

For services that may or may not be present in the environment:

```typescript
const program = Effect.gen(function* () {
  const maybeLogger = yield* Effect.serviceOption(OptionalLogger)
  if (Option.isSome(maybeLogger)) {
    yield* maybeLogger.value.log("Service is available")
  }
})
```

## ManagedRuntime.make — Pre-composed Stacks

For long-running processes that need a pre-built runtime:

```typescript
const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    PostHogProviders,
    AttioProviders,
    CredentialsLayer,
    HttpClientLayer,
  )
)

// Later, run effects against the pre-composed runtime
await runtime.runPromise(myProgram)
```

## LayerMap — Dynamic Provider Lookup

Used by the IaC engine to look up the correct provider for a given resource type at runtime:

```typescript
const providerMap = LayerMap.make({
  "PostHog/FeatureFlag": FeatureFlagProvider,
  "PostHog/Dashboard": DashboardProvider,
  "Attio/Object": ObjectProvider,
  // ...
})

// At apply time, the engine looks up:
const provider = LayerMap.get(providerMap, resource.type)
```

## Resource Provider Pattern

Each IaC resource provider follows a standardized shape:

```typescript
const FeatureFlagProvider = Resource.provider.effect(
  Effect.gen(function* () {
    const credentials = yield* Credentials
    const endpoint = yield* Endpoint
    const client = yield* HttpClient.HttpClient

    return {
      stables: ["id", "key"],

      diff: (props, attrs) => {
        // Compare desired vs actual state
        // Return changed fields
      },

      read: (id) =>
        // Fetch current state from API
        client.get(`${endpoint.baseUrl}/api/projects/${credentials.projectId}/feature_flags/${id}`),

      create: (props) =>
        // Create resource via API
        client.post(`${endpoint.baseUrl}/api/projects/${credentials.projectId}/feature_flags/`, {
          body: props,
        }),

      update: (id, props, diff) =>
        // Patch changed fields
        client.patch(`${endpoint.baseUrl}/api/projects/${credentials.projectId}/feature_flags/${id}/`, {
          body: diff.changed,
        }),

      delete: (id) =>
        // Remove resource
        client.delete(`${endpoint.baseUrl}/api/projects/${credentials.projectId}/feature_flags/${id}/`),
    }
  })
)
```

## Session Logging

The IaC framework provides structured progress logging:

```typescript
const create = (props: Props) =>
  Effect.gen(function* () {
    const session = yield* Session
    yield* session.note(`Creating feature flag: ${props.name}`)

    const result = yield* doCreate(props)

    yield* session.note(`Created feature flag: ${result.id}`)
    return result
  })
```

## Error Handling

### Tagged Error Unions

```typescript
class PostHogError extends Data.TaggedError("PostHogError")<{
  readonly status: number
  readonly message: string
}> {}

class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly retryAfter: number
}> {}

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resourceType: string
  readonly id: string
}> {}
```

### Effect.catchTag for Specific Recovery

```typescript
const withFallback = myEffect.pipe(
  Effect.catchTag("NotFoundError", (err) =>
    Effect.succeed(null) // Return null instead of failing
  ),
  Effect.catchTag("RateLimitError", (err) =>
    Effect.sleep(Duration.seconds(err.retryAfter)).pipe(
      Effect.andThen(myEffect) // Retry after backoff
    )
  ),
)
```
