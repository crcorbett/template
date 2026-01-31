# Research: effect-atom by Tim Smart

## Overview

**Package**: `@effect-atom/atom` (core) / `@effect-atom/atom-react` (React bindings)
**Author**: Tim Smart (Founding Engineer at Effectful Technologies, core Effect contributor)
**Repository**: https://github.com/tim-smart/effect-atom
**Documentation**: https://tim-smart.github.io/effect-atom/
**npm**: https://www.npmjs.com/package/@effect-atom/atom
**License**: MIT
**Current Version**: 0.5.0
**Weekly Downloads**: ~22,000 (core), ~13,000 (React)
**GitHub Stars**: 634

`effect-atom` is a reactive state management library built natively for the Effect ecosystem. It was previously known as `effect-rx` and was renamed in August 2025, with the addition of an `AtomRpc` module for `@effect/rpc` integration.

---

## Peer Dependencies

```json
{
  "@effect/experimental": "^0.58.0",
  "@effect/platform": "^0.94.2",
  "@effect/rpc": "^0.73.0",
  "effect": "^3.19.15"
}
```

It requires Effect 3.19.15+, meaning it tracks the latest Effect releases closely. Tim Smart, as a core Effect maintainer, keeps it aligned.

---

## Core Concepts

### What Is It?

effect-atom is a **Jotai-style atomic state management library** built on Effect primitives. Like Jotai, atoms are the fundamental unit of state -- small, composable, and independently subscribable. Unlike Jotai, atoms natively integrate with Effect's runtime: they can run Effects, consume Streams, use Layers/Services, manage Scopes with finalizers, and participate in the `@effect/experimental` Reactivity invalidation system.

### Key Mental Model

| Concept | effect-atom Equivalent |
|---------|----------------------|
| Jotai `atom()` | `Atom.make()` |
| Jotai derived atom | `Atom.make((get) => get(other) * 2)` or `Atom.map()` |
| Jotai writable atom | `Atom.writable()` or `Atom.state()` |
| Jotai `useAtomValue` | `useAtomValue` (same name) |
| Jotai `useSetAtom` | `useAtomSet` |
| Jotai `atomFamily` | `Atom.family()` |
| Jotai Provider/Store | `Registry` |
| React Query | `AtomRpc` / `AtomHttpApi` (query + mutation pattern with reactivity keys) |

---

## API Surface

### Creating Atoms

```ts
import { Atom } from "@effect-atom/atom-react"

// Simple value atom (writable)
const countAtom = Atom.make(0)

// Derived atom (read-only, recomputes when dependencies change)
const doubleAtom = Atom.make((get) => get(countAtom) * 2)

// Map combinator
const tripleAtom = Atom.map(countAtom, (count) => count * 3)

// Effectful atom - returns Result<A, E> (Initial | Success | Failure)
const usersAtom = Atom.make(
  Effect.gen(function* () {
    const users = yield* Users
    return yield* users.getAll
  })
)

// Stream atom - emits latest value as Result
const tickAtom = Atom.make(Stream.fromSchedule(Schedule.spaced(1000)))

// Pull atom - accumulates chunks from a Stream (pagination/infinite scroll)
const pagesAtom = Atom.pull(someStream)
```

### Atom Families (Dynamic Sets)

```ts
const userAtom = Atom.family((id: string) =>
  runtimeAtom.atom(
    Effect.gen(function* () {
      const users = yield* Users
      return yield* users.findById(id)
    })
  )
)
```

### Reading & Writing in React

```tsx
function Counter() {
  const count = useAtomValue(countAtom)          // read
  const setCount = useAtomSet(countAtom)          // write
  const [value, setter] = useAtom(countAtom)      // both
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

### Wrapping Event Listeners

```ts
const scrollYAtom: Atom.Atom<number> = Atom.make((get) => {
  const onScroll = () => get.setSelf(window.scrollY)
  window.addEventListener("scroll", onScroll)
  get.addFinalizer(() => window.removeEventListener("scroll", onScroll))
  return window.scrollY
})
```

### Effect Services / Layers Integration

```ts
// Create a runtime from a Layer
const runtimeAtom = Atom.runtime(Users.Default)

// Atoms scoped to that runtime can use its services
const usersAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const users = yield* Users
    return yield* users.getAll
  })
)

// Global layers (tracing, logging, config)
Atom.runtime.addGlobalLayer(
  Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env))
)
```

### Function Atoms (Fire-and-forget Effects)

```ts
const createUserAtom = runtimeAtom.fn(
  Effect.fnUntraced(function* (name: string) {
    const users = yield* Users
    return yield* users.create(name)
  })
)

// In React:
const createUser = useAtomSet(createUserAtom, { mode: "promiseExit" })
const exit = await createUser("Alice")
```

### Reactivity Invalidation (@effect/experimental)

```ts
const count = Atom.make(() => fetchCount()).pipe(
  Atom.withReactivity(["counter"])   // auto-refresh on "counter" invalidation
)

const incrementAtom = runtimeAtom.fn(
  Effect.fn(function* () {
    yield* doIncrement()
  }),
  { reactivityKeys: ["counter"] }   // invalidates "counter" when done
)
```

### RPC Integration

```ts
class CountClient extends AtomRpc.Tag<CountClient>()("CountClient", {
  group: Rpcs,
  protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
    Layer.provide(BrowserSocket.layerWebSocket("ws://localhost:3000/rpc")),
    Layer.provide(RpcSerialization.layerJson)
  )
}) {}

// Query (reactive, auto-invalidated)
const count = useAtomValue(CountClient.query("count", void 0, {
  reactivityKeys: ["count"]
}))

// Mutation (invalidates queries)
const increment = useAtomSet(CountClient.mutation("increment"))
```

### HttpApi Integration

```ts
class CountClient extends AtomHttpApi.Tag<CountClient>()("CountClient", {
  api: Api,
  httpClient: FetchHttpClient.layer,
  baseUrl: "http://localhost:3000"
}) {}
```

### Other Features

- **`Atom.keepAlive`**: Prevent atom disposal when all subscribers unmount
- **`Atom.debounce(ms)`**: Debounce atom updates
- **`Atom.searchParam("key")`**: Two-way binding to URL search params
- **`Atom.kvs({ runtime, key, schema })`**: Persistent storage via `@effect/platform` KeyValueStore
- **`Atom.serializable(key, schema)`**: SSR serialization/hydration
- **`Atom.withServerValue(value)`**: Server-side value override
- **`Atom.batch(() => { ... })`**: Batch multiple updates into one notification cycle
- **`Atom.optimistic()`**: Optimistic updates with rollback
- **Vue bindings**: `@effect-atom/atom-vue` also available
- **LiveStore integration**: `@effect-atom/atom-livestore`

---

## Internal Architecture

### Registry

The `Registry` is the central store that manages all atom nodes. It provides:

```ts
interface Registry {
  get: <A>(atom: Atom<A>) => A
  set: <R, W>(atom: Writable<R, W>, value: W) => void
  subscribe: <A>(atom: Atom<A>, f: (a: A) => void, options?) => () => void
  mount: <A>(atom: Atom<A>) => () => void
  refresh: <A>(atom: Atom<A>) => void
  modify: <R, W, A>(atom: Writable<R, W>, f: (r: R) => [A, W]) => A
  update: <R, W>(atom: Writable<R, W>, f: (r: R) => W) => void
  reset: () => void
  dispose: () => void
}
```

Key implementation details:
- **Node states**: uninitialized, stale, valid, removed
- **Parent-child dependency tracking** for invalidation cascades
- **TTL management** with timeout buckets for efficient idle cleanup
- **Batching system** to defer notifications until synchronous changes complete
- **Lazy evaluation**: atoms marked lazy only recompute when actively subscribed

### Result Type

Effectful atoms return `Result<A, E>`, a discriminated union:
- **Initial**: no computation yet (with `waiting: boolean`)
- **Success**: value available (with `waiting: boolean` for refresh states)
- **Failure**: error occurred (with optional `previousSuccess` for stale-while-revalidate)

The `Result` type has `map`, `flatMap`, `match`, and a fluent `builder()` for React rendering.

### Registry as Effect Layer

```ts
// Use within Effect programs
const layer: Layer<Registry.AtomRegistry> = Registry.layer

// Convert atoms to Effect Streams
const stream = Registry.toStream(registry, someAtom)
const resultStream = Registry.toStreamResult(registry, someResultAtom)
```

---

## Comparison: effect-atom vs Effect SubscriptionRef

| Aspect | SubscriptionRef | effect-atom |
|--------|----------------|-------------|
| **Level** | Low-level Effect primitive | High-level reactive toolkit |
| **Purpose** | Observable shared mutable ref within Effect fibers | UI state management with Effect integration |
| **Derived state** | Manual (compose streams) | Built-in (`Atom.make((get) => ...)`, `Atom.map`) |
| **UI integration** | None (pure Effect) | React hooks, Vue composables |
| **Effect services** | N/A (already in Effect) | `Atom.runtime(layer)` bridges layers to atoms |
| **Async results** | Raw Effect/Stream | `Result<A, E>` with loading/error states |
| **Lifecycle** | Fiber/Scope-based | Component-lifecycle aware (mount/unmount, TTL, keepAlive) |
| **Invalidation** | Manual | `withReactivity` keys + automatic cascade |
| **Persistence** | None | `Atom.kvs`, `Atom.searchParam`, `Atom.serializable` |
| **RPC/API** | None | `AtomRpc`, `AtomHttpApi` with query/mutation pattern |
| **Batching** | None | `Atom.batch()` for coalescing updates |
| **Families** | None | `Atom.family()` for dynamic atom sets |

**When to use SubscriptionRef**: Backend services, inter-fiber communication, pure Effect programs without UI.

**When to use effect-atom**: Any frontend/UI application using Effect, especially React. It is essentially the "blessed" way to bridge Effect into React component trees.

---

## PLG Builder Relevance

### How effect-atom Could Serve a PLG Builder

1. **Builder Step State**: Each step in a PLG builder wizard could be an atom. Derived atoms compute overall progress, validation state, and generated output.

```ts
const stepOneAtom = Atom.make({ framework: "next" as const })
const stepTwoAtom = Atom.make({ database: "postgres" as const })
const configAtom = Atom.make((get) => ({
  ...get(stepOneAtom),
  ...get(stepTwoAtom),
}))
```

2. **Async Validation**: Effectful atoms for validating API keys, checking service availability, or previewing generated code:

```ts
const apiKeyValidAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const key = yield* get.result(apiKeyAtom)
    return yield* validateWithPostHog(key)
  })
)
```

3. **Code Generation as Atoms**: Generated code could be derived atoms that recompute when configuration changes:

```ts
const generatedCodeAtom = Atom.make((get) => {
  const config = get(configAtom)
  return generateAlchemyProvider(config)
})
```

4. **RPC for Server-Side Generation**: Use `AtomRpc` to call server-side code generation services:

```ts
class BuilderClient extends AtomRpc.Tag<BuilderClient>()("BuilderClient", {
  group: BuilderRpcs,
  protocol: /* ... */
}) {}
```

5. **Persistence**: Save builder state to localStorage with `Atom.kvs`, restore on revisit.

6. **URL State**: Shareable builder configurations via `Atom.searchParam`.

### Caveats for PLG Use

- **Version 0.5.0**: Pre-1.0, API may still evolve (though Tim Smart's packages tend to be stable in practice)
- **React-centric**: The hooks are React-specific. If your PLG builder is SSR-heavy or uses a different framework, you need `@effect-atom/atom-vue` or raw `Registry` usage
- **Bundle size**: Depends on `effect` + `@effect/experimental` + `@effect/platform` -- significant for a lightweight landing page. Better suited for a full app/dashboard experience
- **Overkill for simple forms**: If the PLG builder is just a multi-step form, simpler state management (React state, Zustand, or even SubscriptionRef) might suffice
- **Best fit**: A PLG builder that involves real-time validation, code generation with Effect services, streaming previews, and persistent state

---

## Tim Smart's Other Relevant Packages

| Package | Description | Relevance |
|---------|-------------|-----------|
| **effect-atom** | Reactive atoms for Effect + React/Vue | Primary research target |
| **effect-mcp** | MCP server for Effect docs in IDEs | Developer experience tooling |
| **sqlfx** | SQL toolkit for Effect (now largely absorbed into `@effect/sql`) | Database layer patterns |
| **dfx** | Discord library for Effect | Shows Effect service patterns at scale |
| **fpk** | Functional configuration management | Config-as-code patterns |

Tim Smart is also the primary author/maintainer of many core `@effect/*` packages including `@effect/platform`, `@effect/rpc`, `@effect/sql`, and `@effect/cluster`. His packages represent the "canonical" way to build with Effect.

---

## Maintenance & Compatibility

- **Actively maintained**: Latest release within days of this research (v0.5.0)
- **Compatible with latest Effect**: Peer dependency `effect ^3.19.15` (current latest)
- **CI/CD**: GitHub Actions for build, check, and test workflows
- **Monorepo structure**: `packages/atom`, `packages/atom-react`, `packages/atom-vue`, `packages/atom-livestore`
- **44 versions published**: Regular release cadence
- **Core contributor trust**: As a founding engineer at Effectful Technologies, Tim Smart's packages are effectively first-party

---

## Summary

effect-atom is the de facto standard for reactive state management in Effect + React applications. It provides a Jotai-like atomic model with deep Effect integration (Effects, Streams, Layers, Services, Scopes, RPC, HttpApi, Reactivity). For a PLG builder, it would be most valuable when the builder involves complex async workflows, Effect service integration, real-time code generation, and persistent/shareable state. For simpler builder UIs, it may be more infrastructure than needed, but it provides a clean upgrade path as complexity grows.

---

## Sources

- [GitHub: tim-smart/effect-atom](https://github.com/tim-smart/effect-atom)
- [npm: @effect-atom/atom](https://www.npmjs.com/package/@effect-atom/atom)
- [npm: @effect-atom/atom-react](https://www.npmjs.com/package/@effect-atom/atom-react)
- [Documentation: effect-atom](https://tim-smart.github.io/effect-atom/)
- [Tim Smart on X (rename announcement)](https://x.com/tim_smart/status/1953754224958878039)
- [Tim Smart on GitHub](https://github.com/tim-smart)
- [Effect SubscriptionRef docs](https://effect.website/docs/state-management/subscriptionref/)
- [This Week in Effect - 2025-08-08](https://effect.website/blog/this-week-in-effect/2025/08/08/)
- [GitHub: tim-smart/sqlfx](https://github.com/tim-smart/sqlfx)
- [GitHub: tim-smart/effect-mcp](https://github.com/tim-smart/effect-mcp)
