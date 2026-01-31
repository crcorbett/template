# Research: Effect TypeScript Graph, State Machine, and Dependency Resolution Capabilities

**Date:** 2026-01-31
**Branch:** feat/plg-stack
**Context:** PLG builder dependency graph and configuration wizard design

---

## 1. Effect's Graph/DAG Capabilities

### 1.1 The `Graph` Module (Experimental)

Effect includes an **experimental `Graph` module** at `packages/effect/src/Graph.ts` providing comprehensive graph data structure support. This is a general-purpose graph library, not tied to Layer internals.

**Data structures:**
- Directed and undirected graph variants via `Graph.directed` and `Graph.undirected`
- Mutable and immutable graph representations
- Generic type parameters: `Graph<N, E, T>` where `N` = node type, `E` = edge type, `T` = graph kind
- Implements `Equal.symbol` and `Hash.symbol` for structural equality and hashing

**Algorithms available:**

| Algorithm | Function | Description |
|-----------|----------|-------------|
| Cycle Detection | `Graph.isAcyclic` | DFS-based back-edge detection for DAG validation |
| Topological Sort | `Graph.topo` | Kahn's algorithm; throws on cycles |
| DFS | `Graph.dfs` | Depth-first traversal |
| DFS Post-Order | `Graph.dfsPostOrder` | Post-order DFS traversal |
| Dijkstra | `Graph.dijkstra` | Shortest path (non-negative weights) |
| Bellman-Ford | `Graph.bellmanFord` | Shortest path (supports negative weights) |
| A* | `Graph.astar` | Heuristic-guided pathfinding |
| Floyd-Warshall | `Graph.floydWarshall` | All-pairs shortest paths |
| Connected Components | `Graph.connectedComponents` | For undirected graphs |
| Strongly Connected | `Graph.stronglyConnectedComponents` | For directed graphs |

**Direction control:** The `Direction` type allows specifying "outgoing" or "incoming" edge traversal.

**Usage example (from Effect test suite):**

```typescript
import { Graph } from "effect"

const graph = Graph.directed<string, number>((mutable) => {
  const a = Graph.addNode(mutable, "A")
  const b = Graph.addNode(mutable, "B")
  const c = Graph.addNode(mutable, "C")
  Graph.addEdge(mutable, a, b, 1)
  Graph.addEdge(mutable, b, c, 2)
})

// Topological sort
const topoIterator = Graph.topo(graph)
const values = Array.from(Graph.values(topoIterator))
// => ["A", "B", "C"]

// DAG validation
const isDAG = Graph.isAcyclic(graph) // true
```

**Status:** Marked `@experimental`. Exposed via `packages/effect/src/index.ts`. While experimental, this is the correct primitive for building custom dependency graphs in the Effect ecosystem.

### 1.2 HashMap and HashSet for Adjacency Lists

Effect provides `HashMap` and `HashSet` as immutable, structurally-hashed collections. These could serve as building blocks for graph adjacency lists if the experimental `Graph` module is insufficient:

```typescript
import { HashMap, HashSet } from "effect"

// Adjacency list representation
type AdjacencyList<N> = HashMap.HashMap<N, HashSet.HashSet<N>>
```

However, given that `Graph` already exists with full algorithm support, building from `HashMap`/`HashSet` would be redundant for most use cases.

---

## 2. Layer's Internal Dependency Resolution

### 2.1 How Layer Resolution Works Internally

Layer dependency resolution uses an implicit DAG formed by the Layer composition tree. The core resolution happens in `build`, `buildWithScope`, and `buildWithMemoMap` functions:

1. **MemoMap** - Ensures each Layer is built exactly once, even when depended on by multiple consumers. Prevents redundant computation and ensures resource sharing.
2. **Scope Management** - `Scope.Scope` manages lifecycle (acquire/release) for all resources.
3. **Graph Traversal** - `makeBuilder` recursively traverses the Layer structure. Different combinators (`Provide`, `ZipWith`, `MergeAll`) determine evaluation order:
   - `ZipWith` can execute layers in **parallel** via `fiberRuntime.zipWithOptions`
   - `MergeAll` uses `fiberRuntime.forEachConcurrentDiscard` for concurrent evaluation

### 2.2 Can Layer's DAG Be Reused for Custom Resolution?

**No, Layer's internal graph resolution is not exposed for external use.** The topological ordering is implicit in the recursive structure of Layer combinators, not represented as an explicit graph data structure.

However, `LayerMap` (from the Effect changelog) provides a limited form of dynamic resolution:

```typescript
import { LayerMap } from "effect"

// Dynamic Layer resolution based on key
const map = LayerMap.make((model: string) =>
  Layer.succeed(CompletionService, createCompletionFor(model))
)

// Usage: dynamically resolve a Layer
const layer = LayerMap.get(map, "gpt-4")
```

**Recommendation:** Use `Graph` module directly for custom dependency graphs. Do not attempt to extract or reuse Layer internals.

### 2.3 Alchemy-Effect's Approach (From Local Codebase)

The alchemy-effect framework in `.context/alchemy-effect/` implements its own resource dependency resolution through the `plan.ts` and `apply.ts` modules:

- Resources are organized into a plan with explicit dependency tracking via `Output` references
- Plan nodes (`Attach`, `Detach`, `Reattach`, `NoopBind`) represent lifecycle operations
- The `apply` function evaluates plans by resolving dependencies through `Output.Resolve`
- Dependencies flow through two mechanisms:
  1. **Output Properties** - Non-circular DAG (resource A's output feeds resource B's input)
  2. **Bindings** - Potentially cyclic (handled via pre-create stubs)

This confirms that **custom dependency resolution** is the norm when building infrastructure tooling in Effect -- Layer provides service composition, but domain-specific resource ordering requires explicit graph modeling.

---

## 3. State Machine Patterns in Effect

### 3.1 The `Machine` Module (@effect/experimental)

Effect's primary state machine abstraction is `Machine` from `@effect/experimental`:

```typescript
import { Machine, Schema } from "@effect/experimental"

// Define requests as tagged schemas
class Increment extends Schema.TaggedRequest<Increment>()(
  "Increment", { failure: Schema.Never, success: Schema.Number, payload: {} }
) {}

class GetCount extends Schema.TaggedRequest<GetCount>()(
  "GetCount", { failure: Schema.Never, success: Schema.Number, payload: {} }
) {}

// Define the machine
const CounterMachine = Machine.makeWith<number>()((_, previous) =>
  Machine.procedures.make(previous ?? 0).pipe(
    Machine.procedures.add(Increment, (state) =>
      Effect.succeed([state + 1, state + 1])  // [newState, response]
    ),
    Machine.procedures.add(GetCount, (state) =>
      Effect.succeed([state, state])
    ),
  )
)
```

**Key features:**
- State management with typed request/response patterns
- Concurrency via `fork`, `forkOne`, `forkReplace` in `MachineContext`
- Retry policies for failure handling
- PubSub-based state broadcasting internally

**Status:** `@effect/experimental` -- subject to API changes.

### 3.2 Ref and SubscriptionRef for Reactive State

**`Ref<A>`** -- Concurrent-safe mutable reference:

```typescript
import { Ref, Effect } from "effect"

const program = Effect.gen(function* () {
  const counter = yield* Ref.make(0)
  yield* Ref.update(counter, (n) => n + 1)
  const value = yield* Ref.get(counter)
})
```

**`SubscriptionRef<A>`** -- Ref with change notifications via PubSub:

```typescript
import { SubscriptionRef, Effect, Stream } from "effect"

const program = Effect.gen(function* () {
  const ref = yield* SubscriptionRef.make({ step: "welcome", data: {} })

  // Subscribe to changes
  const changes = yield* SubscriptionRef.changes(ref)

  // Update triggers notification
  yield* SubscriptionRef.update(ref, (state) => ({
    ...state,
    step: "configure"
  }))
})
```

`SubscriptionRef` internally uses `PubSub` to broadcast changes. This is the recommended primitive for wizard/configuration state where multiple consumers need to react to state transitions.

### 3.3 STM (Software Transactional Memory)

Effect includes `@effect/stm` providing transactional memory:

```typescript
import { STM, TRef } from "effect"

const program = STM.gen(function* () {
  const balance = yield* TRef.make(100)
  const available = yield* TRef.get(balance)
  if (available >= 50) {
    yield* TRef.update(balance, (n) => n - 50)
  }
}).pipe(STM.commit)
```

**Use case for PLG:** STM is valuable when multiple concurrent fibers need to atomically modify shared state (e.g., concurrent configuration steps that must be consistent). For a wizard-style builder, `SubscriptionRef` is simpler and sufficient.

### 3.4 Match for Exhaustive State Transitions

The `Match` module provides type-safe, exhaustive pattern matching:

```typescript
import { Match } from "effect"

type WizardStep =
  | { _tag: "SelectProviders"; providers: string[] }
  | { _tag: "ConfigureAnalytics"; config: AnalyticsConfig }
  | { _tag: "ConfigureCRM"; config: CRMConfig }
  | { _tag: "Review"; stack: PLGStack }
  | { _tag: "Deploy" }

const handleStep = Match.type<WizardStep>().pipe(
  Match.tag("SelectProviders", ({ providers }) =>
    Effect.succeed({ _tag: "ConfigureAnalytics" as const, config: defaultAnalytics(providers) })
  ),
  Match.tag("ConfigureAnalytics", ({ config }) =>
    Effect.succeed({ _tag: "ConfigureCRM" as const, config: defaultCRM() })
  ),
  Match.tag("ConfigureCRM", ({ config }) =>
    Effect.succeed({ _tag: "Review" as const, stack: buildStack(config) })
  ),
  Match.tag("Review", ({ stack }) =>
    Effect.succeed({ _tag: "Deploy" as const })
  ),
  Match.tag("Deploy", () =>
    deployStack()
  ),
  Match.exhaustive  // Compile error if any case is missed
)
```

**Key advantage:** `Match.exhaustive` ensures every state is handled at compile time. Adding a new step to the union requires handling it everywhere `Match.exhaustive` is used.

### 3.5 PubSub for Event-Driven State Changes

```typescript
import { PubSub, Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  const bus = yield* PubSub.unbounded<WizardEvent>()

  // Subscribe
  const sub = yield* PubSub.subscribe(bus)

  // Publish state changes
  yield* PubSub.publish(bus, { type: "step_completed", step: "analytics" })

  // Consume
  const event = yield* Queue.take(sub)
})
```

### 3.6 acquireRelease for State Machine Lifecycle

`Effect.acquireRelease` provides resource lifecycle management that maps well to state machine initialization/cleanup:

```typescript
const wizardSession = Effect.acquireRelease(
  // Acquire: initialize wizard state
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make(initialWizardState)
    const eventBus = yield* PubSub.unbounded<WizardEvent>()
    return { state, eventBus }
  }),
  // Release: cleanup on wizard close/cancel
  (session) => Effect.gen(function* () {
    yield* PubSub.publish(session.eventBus, { type: "session_ended" })
    yield* PubSub.shutdown(session.eventBus)
  })
)
```

---

## 4. Schema-Driven Code Generation

### 4.1 Effect Schema to JSON Schema

Effect Schema natively supports JSON Schema generation:

```typescript
import { JSONSchema, Schema } from "effect"

const PLGConfig = Schema.Struct({
  analytics: Schema.Struct({
    provider: Schema.Literal("posthog", "amplitude", "segment"),
    projectId: Schema.String,
  }),
  featureFlags: Schema.Struct({
    provider: Schema.Literal("posthog", "launchdarkly"),
  }),
})

const jsonSchema = JSONSchema.make(PLGConfig)
// Produces standard JSON Schema that can drive code generation
```

### 4.2 Schema Annotations for Rich Metadata

```typescript
const EventName = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]*$/),
  Schema.brand("EventName"),
  Schema.annotations({
    title: "Event Name",
    description: "A snake_case event name for analytics tracking",
    examples: ["signup_completed", "feature_used"],
  })
)
```

Annotations flow through to JSON Schema output, enabling tooling that reads them for code generation (e.g., generating PostHog event tracking code from schema definitions).

### 4.3 Schema as Single Source of Truth

The PLG service specification (`PLG-SERVICE-SPECIFICATION.md`) already establishes branded types and Schema as the foundation. The generation pipeline would be:

```
Effect Schema definitions
    |
    v
JSONSchema.make() --> JSON Schema
    |                    |
    v                    v
TypeScript branded   External tools (json-schema-to-typescript,
types (direct use)   OpenAPI generators, config validators)
    |
    v
Alchemy IaC resource definitions
(PostHog actions, Attio attributes, etc.)
```

### 4.4 Limitations

Effect does not provide built-in utilities for generating TypeScript source code or configuration files directly from Schema. The JSON Schema bridge is the escape hatch. For direct code generation, you would:

1. Use Schema's AST (`Schema.AST`) to walk the type tree programmatically
2. Use `JSONSchema.make()` and feed output to external generators
3. Build custom generators that read Schema definitions and emit code

---

## 5. Recommended Approach for PLG Builder Dependency Graph

### 5.1 Problem Statement

The PLG builder needs to:
1. Model dependencies between PLG resources (e.g., Insights depend on Actions, Feature Flags depend on Events, Experiments depend on Feature Flags)
2. Determine valid configuration states (what can be configured when)
3. Validate the complete graph before deployment
4. Generate deployment ordering (topological sort)
5. Support incremental configuration (wizard-style builder)

### 5.2 Recommended Architecture

**Use `Graph` for the dependency DAG + `SubscriptionRef` + `Match` for the configuration wizard state machine.**

#### Layer 1: Dependency Graph (Static Analysis)

```typescript
import { Graph, Effect } from "effect"

// Define PLG resource node types
type PLGNode =
  | { _tag: "Event"; name: EventName }
  | { _tag: "Action"; name: string; event: EventName }
  | { _tag: "Cohort"; name: string; events: EventName[] }
  | { _tag: "Insight"; name: string; events: EventName[] }
  | { _tag: "Dashboard"; name: string; insights: string[] }
  | { _tag: "FeatureFlag"; key: FlagKey }
  | { _tag: "Experiment"; name: string; flag: FlagKey }
  | { _tag: "Attribute"; slug: string; object: string }
  | { _tag: "SelectOption"; attribute: string; value: string }

type DependsOn = { reason: string }

// Build the graph from PLG configuration
const buildPLGGraph = (config: PLGConfig) =>
  Graph.directed<PLGNode, DependsOn>((g) => {
    // Add nodes for each resource
    const eventNodes = config.events.map(e => Graph.addNode(g, { _tag: "Event", name: e }))
    const actionNodes = config.actions.map(a => {
      const node = Graph.addNode(g, { _tag: "Action", name: a.name, event: a.event })
      // Action depends on Event
      const eventNode = eventNodes.find(/* matching event */)
      if (eventNode) Graph.addEdge(g, eventNode, node, { reason: "action tracks event" })
      return node
    })
    // ... similar for all resource types
  })

// Validate: must be a DAG
const validate = (graph: typeof Graph) =>
  Graph.isAcyclic(graph)
    ? Effect.succeed(graph)
    : Effect.fail(new CyclicDependencyError())

// Deploy ordering
const deployOrder = (graph: typeof Graph) =>
  Array.from(Graph.values(Graph.topo(graph)))
```

#### Layer 2: Configuration Wizard State Machine

```typescript
import { SubscriptionRef, Match, Effect } from "effect"

// Wizard state as a discriminated union
type BuilderState =
  | { _tag: "SelectProviders"; selected: Set<ProviderKey> }
  | { _tag: "DefineEvents"; events: EventName[] }
  | { _tag: "ConfigureActions"; actions: ActionConfig[] }
  | { _tag: "ConfigureCohorts"; cohorts: CohortConfig[] }
  | { _tag: "ConfigureFlags"; flags: FlagConfig[] }
  | { _tag: "ConfigureInsights"; insights: InsightConfig[] }
  | { _tag: "ConfigureDashboards"; dashboards: DashboardConfig[] }
  | { _tag: "ConfigureCRM"; attributes: AttributeConfig[] }
  | { _tag: "Review"; graph: PLGGraph; errors: ValidationError[] }
  | { _tag: "Deploying"; progress: DeployProgress }
  | { _tag: "Complete"; outputs: PLGOutputs }

// State machine as a service
class PLGBuilder extends Effect.Service<PLGBuilder>()("PLGBuilder", {
  effect: Effect.gen(function* () {
    const state = yield* SubscriptionRef.make<BuilderState>({
      _tag: "SelectProviders",
      selected: new Set(),
    })

    const transition = (action: BuilderAction) =>
      SubscriptionRef.update(state, (current) =>
        Match.value(current).pipe(
          Match.tag("SelectProviders", (s) =>
            Match.value(action).pipe(
              Match.when({ type: "confirm_providers" }, () => ({
                _tag: "DefineEvents" as const,
                events: [],
              })),
              Match.orElse(() => s),
            )
          ),
          Match.tag("DefineEvents", (s) =>
            Match.value(action).pipe(
              Match.when({ type: "add_event" }, ({ name }) => ({
                ...s,
                events: [...s.events, name],
              })),
              Match.when({ type: "next" }, () => ({
                _tag: "ConfigureActions" as const,
                actions: [],
              })),
              Match.orElse(() => s),
            )
          ),
          // ... exhaustive handling for all states
          Match.exhaustive,
        )
      )

    return {
      state: SubscriptionRef.changes(state),
      current: SubscriptionRef.get(state),
      transition,
    }
  }),
}) {}
```

#### Layer 3: Deployment via Alchemy-Effect

The existing `plg-stack.run.ts` already demonstrates how resources are collected into a `defineStack` call. The builder's output would feed into this same pattern:

```typescript
// Builder output -> alchemy-effect stack
const deploy = (config: ReviewedPLGConfig) =>
  Effect.gen(function* () {
    // Build the dependency graph
    const graph = buildPLGGraph(config)
    yield* validate(graph)

    // Get deployment order
    const order = Array.from(Graph.values(Graph.topo(graph)))

    // Generate alchemy resource classes dynamically or
    // feed into defineStack with the resolved configuration
  })
```

### 5.3 Why This Approach

| Concern | Solution | Rationale |
|---------|----------|-----------|
| Dependency ordering | `Graph.topo` | Purpose-built topological sort with cycle detection |
| DAG validation | `Graph.isAcyclic` | Prevents invalid configurations before deployment |
| Wizard state | `SubscriptionRef` | Reactive state with change subscription for UI binding |
| State transitions | `Match.exhaustive` | Compile-time guarantee all states are handled |
| Resource lifecycle | `Effect.acquireRelease` | Clean setup/teardown of builder sessions |
| Schema validation | `Schema.brand()` | Branded types prevent mixing event names, flag keys, etc. |
| Code generation | `JSONSchema.make()` | Bridge to external tooling and config file generation |

### 5.4 What NOT to Use

- **Layer's internal DAG** -- Not exposed, not reusable. Layer is for service composition, not resource dependency graphs.
- **Raw HashMap/HashSet adjacency lists** -- `Graph` module already provides this with algorithms included.
- **STM** -- Overkill for a wizard builder; `SubscriptionRef` is simpler and provides the same reactivity guarantees for single-writer scenarios.
- **@effect/experimental Machine** -- More suited to long-running actor-style state machines (servers, workers). A wizard is simpler and better modeled with `SubscriptionRef` + `Match`.
- **@effect/workflow** -- Designed for durable, distributed workflows. The PLG builder is an in-memory, single-session tool.

### 5.5 Key Dependencies to Add

```json
{
  "effect": "latest"
}
```

The `Graph` module is part of the core `effect` package (no additional dependency). The `Machine` module would require `@effect/experimental` but is not recommended for this use case.

### 5.6 Risk: Graph Module is Experimental

The `Graph` module is marked `@experimental`, meaning its API may change. Mitigation strategies:

1. **Wrap in a thin adapter** -- Create a `PLGGraph` module that delegates to `Graph` internally, isolating consumers from API changes.
2. **Pin Effect version** -- Lock to a specific Effect version in the workspace.
3. **Fallback plan** -- If `Graph` is removed, the algorithms (Kahn's topological sort, DFS cycle detection) are straightforward to implement over `HashMap<NodeId, HashSet<NodeId>>`.

---

## 6. Summary of Findings

1. **Effect HAS a built-in Graph module** with DAG validation, topological sort, DFS, shortest path, and component analysis. It is experimental but fully functional and the right tool for PLG dependency graphs.

2. **Layer's dependency resolution is internal and not reusable.** It uses MemoMap for deduplication and recursive traversal for ordering. The `Graph` module is the correct alternative for custom dependency ordering.

3. **State machine patterns are rich in Effect.** The recommended stack for a PLG configuration wizard is `SubscriptionRef` (reactive state) + `Match.exhaustive` (type-safe transitions) + `PubSub` (event broadcasting). The experimental `Machine` module exists but is heavier than needed.

4. **Schema-driven code generation** is supported via `JSONSchema.make()`. Schema annotations flow through to JSON Schema output. Direct TypeScript code generation requires custom tooling on top of `Schema.AST` or the JSON Schema bridge.

5. **The recommended PLG builder architecture** combines `Graph.directed` for the resource dependency DAG, `Graph.topo` for deployment ordering, `SubscriptionRef` + `Match` for wizard state management, and `Schema.brand()` for type-safe domain primitives throughout.
