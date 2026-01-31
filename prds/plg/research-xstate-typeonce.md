# Research: Typeonce.dev -- XState + Functional TypeScript Patterns

> Research conducted 2026-01-31 from typeonce.dev (Sandro Maglione) and related sources.

## 1. What Typeonce.dev Offers

[Typeonce.dev](https://www.typeonce.dev) is a learning platform by Sandro Maglione focused on
"type-safe resources for TypeScript developers." It provides courses, articles, snippets, and
workshops organized around two primary pillars:

- **XState** -- state machines, actors, and statecharts for UI state management
- **Effect** -- the functional TypeScript runtime ("the missing standard library for TypeScript")

Key resources:

| Resource | Type | URL |
|----------|------|-----|
| XState: Complete Getting Started Guide | Course | https://www.typeonce.dev/course/xstate-complete-getting-started-guide |
| Effect: Beginners Complete Getting Started | Course | https://www.typeonce.dev/course/effect-beginners-complete-getting-started |
| Patterns for State Management with Actors | Article | https://www.typeonce.dev/article/patterns-for-state-management-with-actors-in-react-with-xstate |
| Stripe Payments with XState + Effect | Snippet | https://www.typeonce.dev/snippet/stripe-payments-react-client-with-xstate-and-effect |
| Upload File with XState + Effect | Snippet | https://www.typeonce.dev/snippet/upload-file-xstate-machine-with-effect |
| Calories Tracker (XState + Effect + PGlite) | App | https://github.com/typeonce-dev/calories-tracker-local-only-app |

**Important clarification:** Typeonce does NOT use FXTS (the fp-ts successor library). Instead, it
uses **Effect** (from the Effect-TS ecosystem) as its functional TypeScript layer. Effect provides
pipe, match, Option, Either, Schema, Layer, and Service -- the same FP primitives that FXTS offers,
but in a more integrated runtime package.

---

## 2. XState Architecture: How Typeonce Structures State Machines

### 2.1 The `setup()` + `createMachine()` Pattern (XState v5)

Typeonce teaches the XState v5 idiom where `setup()` defines all types, actors, actions, guards,
and delays upfront, then `createMachine()` consumes them with full inference:

```typescript
import { setup, fromPromise } from "xstate";

const machine = setup({
  types: {
    context: {} as { count: number; error: string | null },
    events: {} as
      | { type: "increment" }
      | { type: "submit"; data: FormData },
  },
  actors: {
    submitActor: fromPromise(async ({ input }) => { /* ... */ }),
  },
  actions: {
    resetError: assign({ error: null }),
  },
  guards: {
    isValid: ({ context }) => context.count > 0,
  },
}).createMachine({
  id: "example",
  initial: "Idle",
  states: {
    Idle: { /* ... */ },
    Loading: { /* ... */ },
    Error: { /* ... */ },
  },
});
```

Key advantages emphasized:
- **Zero type generation** -- all types inferred from `setup()`
- **Named sources guaranteed to exist** -- actors, guards, actions referenced by string name
- **Framework-agnostic** -- machine definition decoupled from React/Vue/etc.

### 2.2 Five Actor Composition Patterns

The article on actor patterns (with [companion repo](https://github.com/typeonce-dev/patterns-for-state-management-with-actors-in-react-with-xstate)) describes five ways to compose actors:

| # | Pattern | Mechanism | Recommendation |
|---|---------|-----------|----------------|
| 1 | All-in-one | Single actor, no composition | Not recommended |
| 2 | Child sends to parent ref | `sendTo(parentRef)` | Creates state duplication |
| 3 | **Parent holds child refs in context** | `spawn()` + `ActorRefFrom` + `getSnapshot()` | **Recommended** |
| 4 | Parent invokes child | `invoke` in state config | Good for lifecycle-bound actors |
| 5 | Bidirectional forwarding | `sendParent()` + `forwardTo()` | Tight coupling, less reusable |

**Pattern 3 is the recommended default.** The parent spawns children, stores their refs in context,
and reads child state via `getSnapshot()`. Children remain fully independent and testable.

### 2.3 Actor Invocation for Async Work

The core XState pattern for side effects is invoking actors within states:

```typescript
Loading: {
  invoke: {
    src: "submitActor",
    input: ({ context }) => ({ formData: context.formData }),
    onDone: { target: "Success", actions: "handleResult" },
    onError: { target: "Error", actions: "assignError" },
  },
}
```

"Invoking an actor means the actor will be executed when the state is entered." This is described
as "the core of the actor model" -- composing independent actors into a full application.

---

## 3. XState + Effect Integration Pattern

The most distinctive contribution from Typeonce is the **bridge pattern** between XState's actor
model and Effect's functional runtime.

### 3.1 The `fromPromise` + `RuntimeClient.runPromise` Bridge

XState actors are defined with `fromPromise`, but internally delegate to Effect programs:

```typescript
const machine = setup({
  actors: {
    loadStripe: fromPromise(() =>
      RuntimeClient.runPromise(StripeService)
    ),
    confirmPayment: fromPromise(({ input: { elements, stripe } }) =>
      RuntimeClient.runPromise(
        Effect.gen(function* () {
          if (stripe === null) {
            return yield* Effect.fail("Stripe not loaded");
          }
          const { error } = yield* Effect.tryPromise({
            try: () => stripe.confirmPayment({ elements, confirmParams: { return_url: "..." } }),
            catch: (e) => String(e),
          });
          if (error) {
            return yield* Effect.fail(error.message ?? "Unknown error");
          }
        })
      )
    ),
  },
}).createMachine({ /* ... */ });
```

Architecture summary:

```
React Component
  |-- useActor(machine)
        |
  XState Machine (states + transitions + guards)
        |-- invoke: fromPromise actor
              |-- RuntimeClient.runPromise(Effect.gen(...))
                    |-- Effect Services (Layer, Schema, Config)
```

### 3.2 Separation of Concerns

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| UI | React + useActor | Render state, dispatch events |
| Orchestration | XState machines | States, transitions, guards, actor lifecycle |
| Business logic | Effect services | Pure computation, validation, API calls |
| Data validation | Effect Schema | Type-safe encoding/decoding |
| Dependency injection | Effect Layer | Service composition and testing |

The Calories Tracker app demonstrates this at scale: "All the logic is contained in isolated
services that are combined inside layers and executed as part of TanStack Router loaders and
xstate actors."

### 3.3 Error Handling Bridge

Effect errors (via `Effect.fail`) become Promise rejections, which XState captures through
`onError` transitions. This bridges functional error handling (tagged errors, catchTag) with
state machine error states:

```
Effect.fail("NotFound") --> Promise.reject --> XState onError --> transition to ErrorState
```

---

## 4. Guards, Constraints, and Conditional Flows

### 4.1 Guards in XState

Guards are boolean functions defined in `setup()` that conditionally allow transitions:

```typescript
setup({
  guards: {
    isStripeLoaded: ({ context }) => context.stripe !== null,
    isValid: ({ context }) => context.formData.isComplete,
  },
}).createMachine({
  states: {
    Idle: {
      on: {
        submit: {
          target: "Submitting",
          guard: "isValid",  // Only transition if guard returns true
        },
      },
    },
  },
});
```

`state.can(event)` can be used to check if a transition would succeed (executing guards) without
actually sending the event -- useful for disabling UI buttons based on current constraints.

### 4.2 XState Wizards Library

The [xstate-wizards](https://github.com/xstate-wizards/xstate-wizards) project (not from
Typeonce but relevant) provides a framework for multi-step wizard flows:

- Each step is a state in the machine
- Transitions between steps have guard conditions
- Sub-flows are spawned as child actors that resolve back into the parent
- The `@xstate-wizards/spellbook` package provides a no-code editor (machines serialize as JSON)
- `@xstate-wizards/crystal-ball` provides outline/linear visualization of branching flows

---

## 5. Application to a PLG Builder with Dependency Constraints

### 5.1 Mapping PLG Builder Concepts to XState + Effect

| PLG Builder Concept | XState + Effect Pattern |
|---------------------|------------------------|
| Builder wizard steps (auth, analytics, billing, etc.) | Top-level machine states or parallel state regions |
| Selection within a step (e.g., pick Clerk vs Auth.js) | Child actors spawned per step, context tracks selection |
| Dependency constraints (PostHog requires Clerk) | Guards on transitions that check prerequisite selections |
| Validation of full configuration | Effect Schema for validating the assembled config |
| API calls to provision services | `fromPromise` actors bridging to Effect services |
| Undo/change earlier selection | Re-enter previous state, guards re-evaluate downstream |

### 5.2 Proposed Architecture

```
PLGBuilderMachine (top-level)
  |
  |-- states: { Auth, Analytics, Billing, Database, Review }
  |
  |-- context: {
  |     selections: { auth?: "clerk" | "authjs", analytics?: "posthog" | "plausible", ... },
  |     constraints: ConstraintGraph,  // Effect Schema-validated
  |   }
  |
  |-- guards: {
  |     canSelectPostHog: ({ context }) =>
  |       context.selections.auth === "clerk",  // PostHog requires Clerk
  |     canProceedToReview: ({ context }) =>
  |       allRequiredSelectionsPresent(context),
  |   }
  |
  |-- actors: {
  |     validateConfig: fromPromise(({ input }) =>
  |       RuntimeClient.runPromise(
  |         ConfigValidationService.validate(input.selections)
  |       )
  |     ),
  |     provisionStack: fromPromise(({ input }) =>
  |       RuntimeClient.runPromise(
  |         ProvisioningService.provision(input.selections)
  |       )
  |     ),
  |   }
```

### 5.3 Key Patterns to Adopt

1. **`setup()` with typed events for each selection action** -- e.g.,
   `{ type: "select.auth"; value: "clerk" | "authjs" }`. This gives exhaustive type checking on
   all possible user actions.

2. **Guards for dependency constraints** -- Each selection transition has a guard that checks
   whether prerequisites are met in the current context. The UI uses `state.can(event)` to
   disable options whose guards would fail.

3. **Pattern 3 actor composition** -- Each builder step could be its own spawned child actor
   with independent state (loading options, validating, showing errors). The parent machine
   holds refs in context and reads child snapshots.

4. **Effect services for business logic** -- Constraint resolution, configuration validation,
   and provisioning API calls all live in Effect services. XState actors bridge to them via
   `fromPromise` + `runPromise`.

5. **Effect Schema for configuration validation** -- Define the valid configuration shape
   (including conditional fields) as an Effect Schema. Decode the accumulated selections at
   the Review step to catch invalid combinations.

6. **Parallel states for independent selections** -- If some selections are independent (e.g.,
   database choice does not affect auth choice), model them as parallel state regions. Guards
   still enforce cross-cutting constraints at transition boundaries.

### 5.4 Constraint Graph with Guards

For a PLG builder where selections create dependency chains:

```typescript
// Define constraints declaratively
const constraints = {
  posthog: { requires: ["clerk"] },
  stripe: { requires: ["clerk"] },
  drizzle: { requires: ["neon"] },
} as const;

// Generate guards from constraints
const guards = Object.fromEntries(
  Object.entries(constraints).map(([tool, { requires }]) => [
    `canSelect_${tool}`,
    ({ context }: { context: BuilderContext }) =>
      requires.every((dep) =>
        context.selections[dep as keyof typeof context.selections] != null
      ),
  ])
);
```

This keeps constraint logic declarative and testable, while XState enforces it at the transition
level.

---

## 6. Open Source Repositories

All Typeonce repos: https://github.com/typeonce-dev

| Repository | Relevance |
|-----------|-----------|
| [xstate-complete-getting-started-guide](https://github.com/typeonce-dev/xstate-complete-getting-started-guide) | XState fundamentals, setup(), actors, guards |
| [patterns-for-state-management-with-actors-in-react-with-xstate](https://github.com/typeonce-dev/patterns-for-state-management-with-actors-in-react-with-xstate) | Five actor composition patterns |
| [calories-tracker-local-only-app](https://github.com/typeonce-dev/calories-tracker-local-only-app) | Full app combining XState + Effect + PGlite |
| [effect-getting-started-course](https://github.com/typeonce-dev/effect-getting-started-course) | Effect fundamentals |
| [snippets](https://github.com/typeonce-dev/snippets) | XState+Effect code snippets |
| [xstate-wizards/xstate-wizards](https://github.com/xstate-wizards/xstate-wizards) | Wizard-specific XState framework (not Typeonce) |

---

## 7. Key Takeaways

1. **Typeonce uses Effect, not FXTS.** The functional layer is Effect (pipe, Schema, Layer,
   Service, gen) rather than the FXTS/fp-ts lineage. Effect provides a more integrated runtime.

2. **The bridge pattern is `fromPromise` wrapping `RuntimeClient.runPromise`.** This is the
   canonical way to run Effect programs inside XState actors -- clean separation between
   orchestration (XState) and computation (Effect).

3. **Actor composition pattern 3 (parent holds child refs) is recommended** for complex UIs
   where multiple independent sub-flows need to compose.

4. **Guards are the constraint enforcement mechanism.** Define constraints declaratively, generate
   guard functions, and XState prevents invalid transitions. The UI queries `state.can(event)`
   to reflect constraints visually.

5. **No wizard-specific content on Typeonce.** The xstate-wizards library (separate project)
   is the closest existing framework for multi-step selection flows with constraints. Typeonce
   focuses on the lower-level patterns that such a wizard would be built from.

6. **The XState + Effect stack is production-validated.** The Calories Tracker app, Stripe
   payments snippet, and Paddle payments course all demonstrate the pattern at varying scales.
