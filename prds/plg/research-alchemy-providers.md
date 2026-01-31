# Alchemy-Effect Provider Architecture Research

## Overview

Alchemy-Effect is the core IaC (Infrastructure-as-Code) framework that powers the PLG stack's declarative resource management. It provides a generic engine for defining, reconciling, and managing stateful resources across any external service (PostHog, Attio, etc.).

## Resource Definition

Every managed resource is defined by three types:

### Props (Input / Desired State)

The properties a user specifies when declaring a resource:

```typescript
interface FeatureFlagProps {
  name: string
  key: string
  filters: {
    groups: Array<{
      properties: PropertyFilter[]
      rollout_percentage: number
    }>
  }
  active: boolean
  ensure_experience_continuity: boolean
}
```

### Attrs (Output / Current State)

The full set of attributes returned from the external service:

```typescript
interface FeatureFlagAttrs extends FeatureFlagProps {
  id: number
  created_at: string
  created_by: { email: string }
  is_simple_flag: boolean
  rollout_percentage: number | null
}
```

### Resource Factory

Combines Props and Attrs into a typed resource declaration:

```typescript
const FeatureFlag = Resource("PostHog/FeatureFlag")<
  FeatureFlagProps,
  FeatureFlagAttrs
>()
```

## Provider Lifecycle

Every provider implements these lifecycle operations in order:

```
diff -> read -> create | update | delete
```

### diff(props, attrs) -> DiffResult

Compares desired state (Props) against current state (Attrs). Returns which fields changed.

```typescript
diff: (props, attrs) => {
  const changes: Record<string, { from: any; to: any }> = {}
  if (props.name !== attrs.name) {
    changes.name = { from: attrs.name, to: props.name }
  }
  if (!deepEqual(props.filters, attrs.filters)) {
    changes.filters = { from: attrs.filters, to: props.filters }
  }
  return { changed: Object.keys(changes).length > 0, changes }
}
```

### read(id) -> Effect\<Attrs | null\>

Fetches the current state of a resource from the external service. Returns `null` if the resource no longer exists.

```typescript
read: (id) =>
  Effect.gen(function* () {
    const session = yield* Session
    yield* session.note(`Reading feature flag: ${id}`)

    // Primary: lookup by ID
    const result = yield* client
      .get(`/api/projects/${projectId}/feature_flags/${id}`)
      .pipe(
        Effect.catchTag("NotFoundError", () =>
          // Fallback: scan by key
          scanByKey(props.key)
        )
      )

    return result
  })
```

### create(props) -> Effect\<Attrs\>

Creates a new resource. Implements idempotent creation by scanning for existing resources first.

```typescript
create: (props) =>
  Effect.gen(function* () {
    const session = yield* Session

    // Idempotent: check if already exists
    const existing = yield* scanByKey(props.key)
    if (existing) {
      yield* session.note(`Found existing flag: ${existing.id}`)
      return existing
    }

    yield* session.note(`Creating feature flag: ${props.name}`)
    const result = yield* client.post(
      `/api/projects/${projectId}/feature_flags/`,
      { body: props }
    )
    yield* session.note(`Created feature flag: ${result.id}`)
    return result
  })
```

### update(id, props, diff) -> Effect\<Attrs\>

Updates only the changed fields identified by the diff operation.

```typescript
update: (id, props, diff) =>
  Effect.gen(function* () {
    const session = yield* Session
    yield* session.note(`Updating feature flag ${id}: ${Object.keys(diff.changes).join(", ")}`)

    const result = yield* client.patch(
      `/api/projects/${projectId}/feature_flags/${id}/`,
      { body: diff.changes }
    )
    return result
  })
```

### delete(id) -> Effect\<void\>

Removes the resource from the external service.

```typescript
delete: (id) =>
  Effect.gen(function* () {
    const session = yield* Session
    yield* session.note(`Deleting feature flag: ${id}`)
    yield* client.delete(`/api/projects/${projectId}/feature_flags/${id}/`)
  })
```

### Optional: precreate(props) -> Effect\<Partial\<Attrs\>\>

Used for circular dependency resolution. Creates a minimal placeholder that other resources can reference before the full create runs.

## Stable Properties

Properties marked in the `stables[]` array never change on update. They are set once at creation time and remain constant for the resource's lifetime.

```typescript
{
  stables: ["id", "key"],
  // "id" is assigned by the service
  // "key" is the unique identifier chosen at creation
}
```

The diff operation skips stable properties entirely, and update operations never include them in the payload.

## Idempotent Create

All create operations scan for existing resources before creating new ones. This is critical for:

1. **Crash recovery** -- If the process dies after creating but before recording state, the next run finds the existing resource
2. **Import** -- Existing manually-created resources are adopted into IaC management
3. **Deduplication** -- Prevents duplicate resources from concurrent runs

```typescript
create: (props) =>
  Effect.gen(function* () {
    // Scan for existing by unique key
    const existing = yield* scanForExisting(props)
    if (existing) {
      return existing // Adopt existing resource
    }
    // Create new
    return yield* doCreate(props)
  })
```

## Soft Deletes

Some resources use update-with-deleted-flag instead of actual deletion:

```typescript
delete: (id) =>
  Effect.gen(function* () {
    // Soft delete: mark as deleted rather than destroying
    yield* client.patch(`/api/.../flags/${id}/`, {
      body: { deleted: true }
    })
  })
```

This preserves historical data while removing the resource from active use.

## Error Recovery in Read

The read operation implements a fallback chain:

```typescript
read: (id) =>
  pipe(
    // 1. Try direct ID lookup
    client.get(`/api/.../flags/${id}`),
    // 2. On 404, try scanning by key
    Effect.catchTag("NotFoundError", () => scanByKey(props.key)),
    // 3. On any error, return null (resource doesn't exist)
    Effect.catchAll(() => Effect.succeed(null))
  )
```

This handles cases where IDs change (e.g., resource was recreated) or the API returns unexpected errors.

## Input\<T\> -- Resource Cross-References

The `Input<T>` type allows resources to reference outputs of other resources. This is resolved at apply time when the referenced resource's outputs are available.

```typescript
interface EntryProps {
  listId: Input<string>           // Can be a literal or a resource output
  parentRecordId: Input<string>   // e.g., Record.recordId
  values: Record<string, Input<any>>
}

// Usage: reference another resource's output
const myRecord = Record("my-record", { ... })
const myEntry = Entry("my-entry", {
  listId: myList.id,                // Direct reference
  parentRecordId: myRecord.recordId, // Cross-resource reference
  values: { status: "active" },
})
```

## Output\<T\> Proxy

Provides type-safe property access to resource outputs before the resource has been applied:

```typescript
const flag = FeatureFlag("my-flag", { ... })

// flag.id is Output<number> -- a proxy that resolves after apply
// flag.key is Output<string>
// flag.created_at is Output<string>

// Can be passed as Input<T> to other resources
const annotation = Annotation("flag-annotation", {
  content: `Flag created: ${flag.key}`,
  // flag.key resolves to the actual key string at apply time
})
```

## State Management

Resources transition through well-defined states:

```
(initial)
    |
CreatingResourceState
    | (create succeeds)
CreatedResourceState
    | (next apply detects changes)
UpdatingResourceState
    | (update succeeds)
UpdatedResourceState
    | (resource removed from stack)
DeletingResourceState
    | (delete succeeds)
DeletedResourceState
```

State is persisted between runs to enable incremental reconciliation.

## Provider Composition

All resource providers for a service are combined into a single layer:

```typescript
// Combine all PostHog resource providers
const PostHogProviders = Layer.mergeAll(
  FeatureFlagProvider,
  DashboardProvider,
  ExperimentProvider,
  SurveyProvider,
  CohortProvider,
  ActionProvider,
  AnnotationProvider,
  InsightProvider,
)

// Add credentials and config
const PostHogStack = PostHogProviders.pipe(
  Layer.provideMerge(
    Layer.succeed(Credentials, {
      apiKey: process.env.POSTHOG_API_KEY!,
      projectId: process.env.POSTHOG_PROJECT_ID!,
    })
  ),
  Layer.provideMerge(
    Layer.succeed(Endpoint, {
      baseUrl: "https://us.posthog.com",
    })
  ),
  Layer.provideMerge(HttpClient.layer),
)
```

## Stack Definition

A stack declares all resources and their providers:

```typescript
const plgStack = defineStack({
  name: "plg-stack",

  stages: defineStages(
    Effect.fn(function* () {
      const env = yield* Environment
      return {
        posthogApiKey: env.POSTHOG_API_KEY,
        posthogProjectId: env.POSTHOG_PROJECT_ID,
        attioApiKey: env.ATTIO_API_KEY,
      }
    })
  ),

  resources: [
    // 78 resources total
    ...posthogFeatureFlags,
    ...posthogDashboards,
    ...posthogExperiments,
    ...posthogSurveys,
    ...posthogCohorts,
    ...posthogActions,
    ...posthogAnnotations,
    ...posthogInsights,
    ...attioObjects,
    ...attioAttributes,
    ...attioSelectOptions,
    ...attioStatuses,
    ...attioLists,
    ...attioRecords,
  ],

  providers: Layer.mergeAll(PostHogProviders, AttioProviders),
})
```

## Stage Configuration

Stages allow environment-specific configuration:

```typescript
const stages = defineStages(
  Effect.fn(function* () {
    const env = yield* Environment
    return match(env.STAGE)
      .with("production", () => ({
        posthogProjectId: "12345",
        rolloutPercentage: 100,
      }))
      .with("staging", () => ({
        posthogProjectId: "67890",
        rolloutPercentage: 50,
      }))
      .exhaustive()
  })
)
```

## Retry Policies

Providers use exponential backoff for transient failures and eventual consistency:

```typescript
const retryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.union(Schedule.spaced("5 seconds")),
  Schedule.compose(Schedule.recurs(5)),
)

const withRetry = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(
    Effect.retry({
      schedule: retryPolicy,
      while: (error) =>
        error._tag === "RateLimitError" ||
        error._tag === "ServiceUnavailableError",
    })
  )
```

## Session Logging

Every provider operation uses session logging for visibility:

```typescript
const create = (props: Props) =>
  Effect.gen(function* () {
    const session = yield* Session
    yield* session.note(`[PostHog/FeatureFlag] Creating: ${props.name}`)

    const result = yield* doCreate(props)

    yield* session.note(`[PostHog/FeatureFlag] Created: ${result.id} (${props.name})`)
    return result
  })
```

Session notes appear in the CLI output during `apply` runs, providing real-time visibility into what the IaC engine is doing.

## Resource Tagging

All managed resources carry a tag indicating they are IaC-managed:

```typescript
// Applied during create and verified during read
const IAC_TAG = "managed-by-iac"

create: (props) =>
  client.post("/api/.../flags/", {
    body: {
      ...props,
      tags: [...(props.tags ?? []), IAC_TAG],
    },
  })
```

This prevents manual resources from being accidentally adopted or modified by the IaC engine.

## File Structure Convention

Each resource follows a consistent file layout:

```
src/
  posthog/
    feature-flag.ts              # Resource definition (Props, Attrs, factory)
    feature-flag.provider.ts     # Provider implementation (diff, read, create, update, delete)
    dashboard.ts
    dashboard.provider.ts
    experiment.ts
    experiment.provider.ts
    ...
    index.ts                     # Re-exports all resources and providers
```

The separation of resource definition from provider implementation allows the resource types to be imported without pulling in the provider's HTTP dependencies -- useful for tests and type-only consumers.
