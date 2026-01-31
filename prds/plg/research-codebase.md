# Codebase Architecture Research

## Monorepo Structure

The project is organized as a monorepo with two top-level directories:

```
├── apps/
│   ├── admin/       # Admin dashboard application
│   ├── docs/        # Documentation site
│   └── web/         # Main web application
├── packages/
│   ├── alchemy-attio/     # IaC provider for Attio CRM resources
│   ├── alchemy-posthog/   # IaC provider for PostHog resources
│   ├── api/               # Shared API layer
│   ├── attio/             # Typed Attio CRM client (Effect-based)
│   ├── auth/              # Authentication package
│   ├── core/              # Core shared utilities
│   ├── database/          # Database access layer
│   ├── plg/               # PLG automation package (SDK + IaC stack)
│   ├── posthog/           # Typed PostHog API client (Effect-based)
│   ├── types/             # Shared type definitions
│   └── ui/                # Shared UI components
└── .context/
    └── alchemy-effect/    # Core IaC framework (Resource, Provider, State, Apply)
```

## Toolchain

| Tool | Version / Notes |
|------|----------------|
| Package Manager | Bun 1.3.5 |
| Build Orchestration | Turborepo |
| Test Runner | Vitest |
| TypeScript | 5.9+ |
| Effect Runtime | effect@^3.16.0, @effect/platform@^0.82.0 |

## Export Pattern

All packages use a conditional export pattern:

```jsonc
// package.json
{
  "exports": {
    ".": {
      "@packages/source": "./src/index.ts",   // Dev: direct TS source
      "default": "./dist/index.js"             // Prod: compiled output
    }
  }
}
```

This allows intra-monorepo imports to resolve directly to TypeScript source during development while consumers outside the monorepo get compiled output.

## @packages/posthog — Typed PostHog API Client

A fully typed PostHog API client built on Effect. Every API endpoint is modeled as an Effect service with typed inputs, outputs, and errors.

### Services

- **Me** — Current user info
- **Dashboards** — Dashboard CRUD
- **FeatureFlags** — Feature flag management
- **Insights** — Analytics insight queries
- **Cohorts** — User cohort management
- **Events** — Event querying
- **Persons** — Person/user records
- **Surveys** — In-app survey management
- **Actions** — Server-side action definitions
- **Annotations** — Dashboard annotations
- **Experiments** — A/B experiment management

### Architecture

```typescript
// Credentials provided via Context.Tag
class Credentials extends Context.Tag("PostHog/Credentials")<
  Credentials,
  { readonly apiKey: string; readonly projectId: string }
>() {}

// Endpoint provided via Context.Tag
class Endpoint extends Context.Tag("PostHog/Endpoint")<
  Endpoint,
  { readonly baseUrl: string }
>() {}

// Each service method returns an Effect with typed requirements
const listFeatureFlags: Effect.Effect<
  FeatureFlagList,
  PostHogError,
  Credentials | Endpoint | HttpClient.HttpClient
>
```

### Cross-cutting Concerns

- **Retry policies**: Exponential backoff for transient failures (429, 500, 502, 503)
- **Pagination**: Cursor-based pagination with typed page responses
- **Typed errors**: Tagged error union (`PostHogError`) with specific subtypes (`RateLimitError`, `NotFoundError`, `ValidationError`)

## @packages/attio — Typed Attio CRM Client

A fully typed Attio CRM API client, also built on Effect.

### Services

- **Objects** — Custom object definitions
- **Records** — CRM record CRUD
- **Lists** — List/view management
- **Entries** — List entry management
- **Attributes** — Object attribute definitions
- **SelectOptions** — Select/multi-select options
- **Notes** — Note attachments
- **Tasks** — Task management
- **Comments** — Comment threads
- **Webhooks** — Webhook subscriptions
- **WorkspaceMembers** — Team member management
- **Self** — Current workspace info
- **Threads** — Conversation threads
- **Statuses** — Status attribute management
- **Meetings** — Meeting records

## @packages/alchemy-posthog — PostHog IaC Provider

Infrastructure-as-Code provider that manages PostHog resources declaratively.

### Managed Resources

| Resource | Props Interface | Attrs Interface |
|----------|----------------|-----------------|
| FeatureFlags | name, key, filters, rollout_percentage, ... | id, created_at, ... |
| Dashboards | name, description, filters, ... | id, created_at, ... |
| Experiments | name, feature_flag_key, parameters, ... | id, created_at, ... |
| Surveys | name, type, questions, targeting, ... | id, created_at, ... |
| Cohorts | name, groups, is_static, ... | id, count, ... |
| Actions | name, steps, ... | id, created_at, ... |
| Annotations | content, date_marker, scope, ... | id, created_at, ... |
| Insights | name, query, filters, ... | id, short_id, ... |

### Provider Contract

Each resource implements the full provider lifecycle:

```typescript
// Every resource provider implements:
{
  stables: string[]          // Properties that never change on update
  diff: (props, attrs) => DiffResult
  read: (id) => Effect<Attrs | null>
  create: (props) => Effect<Attrs>
  update: (id, props, diff) => Effect<Attrs>
  delete: (id) => Effect<void>
}
```

## @packages/alchemy-attio — Attio IaC Provider

Infrastructure-as-Code provider for Attio CRM resources.

### Managed Resources

- **Objects** — Custom object type definitions
- **Attributes** — Object attribute schemas
- **SelectOptions** — Enum/select option values
- **Statuses** — Status attribute configurations
- **Lists** — List/view definitions
- **Records** — CRM records (contacts, companies, custom objects)
- **Entries** — List entries
- **Webhooks** — Webhook subscription management
- **Notes** — Note resources
- **Tasks** — Task resources

## @packages/plg — PLG Automation Package

The PLG package ties everything together: constants, SDK, and IaC stack.

### Constants

```typescript
// Centralized definitions for the entire PLG stack
export const Events = { ... }           // All tracked event names
export const FeatureFlags = { ... }     // All feature flag keys
export const Surveys = { ... }          // All survey identifiers
export const AttioAttributes = { ... }  // All CRM attribute slugs
export const Plans = { ... }            // Pricing plan identifiers
export const UserProperties = { ... }   // All user property keys
```

### SDK

- **track** — Type-safe event tracking functions
- **identify** — User identification with typed properties
- **attio-sync** — Bidirectional sync between PostHog and Attio
- **automations** — Effect-based automation helpers (lifecycle triggers, health scoring)

### IaC Stack (plg-stack.run.ts)

Defines **78 IaC resources** spanning both Attio and PostHog:

```typescript
// Simplified illustration
const stack = defineStack({
  name: "plg-stack",
  stages: defineStages(Effect.fn(function* () { ... })),
  resources: [
    // PostHog resources
    ...featureFlags,
    ...dashboards,
    ...experiments,
    ...surveys,
    ...cohorts,
    ...actions,
    ...annotations,
    ...insights,
    // Attio resources
    ...objects,
    ...attributes,
    ...selectOptions,
    ...statuses,
    ...lists,
    ...records,
  ],
  providers: Layer.mergeAll(
    PostHogProviders,
    AttioProviders
  )
})
```

## Alchemy-Effect (Core IaC Framework)

Located in `.context/alchemy-effect/`, this is the foundational IaC engine.

### Core Concepts

- **Resource** — Declares a resource type with Props (desired state) and Attrs (actual state)
- **Provider** — Implements lifecycle operations for a resource type
- **State** — Tracks resource state transitions (Creating → Created → Updating → Updated → Deleting → Deleted)
- **Apply** — Engine that reconciles desired state with actual state
- **Binding** — Plugin system for composing providers into runtime capabilities

### Peer Dependencies

All packages share these Effect ecosystem dependencies:

```jsonc
{
  "peerDependencies": {
    "effect": "^3.16.0",
    "@effect/platform": "^0.82.0"
  }
}
```
