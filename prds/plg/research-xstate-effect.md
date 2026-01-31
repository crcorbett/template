# Research: XState v5 + Effect TypeScript for PLG Builder State Management

**Date:** 2026-01-31
**Branch:** feat/plg-stack
**Context:** Evaluating XState v5 as the state machine layer for the PLG stack builder UI, integrated with Effect TypeScript for constraint DAG and side effects.

---

## Table of Contents

1. [XState v5 Core Concepts](#1-xstate-v5-core-concepts)
2. [Guards and Conditional Transitions for Dependency Constraints](#2-guards-and-conditional-transitions-for-dependency-constraints)
3. [Actor Model for Interdependent Selections](#3-actor-model-for-interdependent-selections)
4. [Eventless (Always) Transitions for Constraint Propagation](#4-eventless-always-transitions-for-constraint-propagation)
5. [XState + Effect Integration Patterns](#5-xstate--effect-integration-patterns)
6. [Comparison: XState vs Pure Effect SubscriptionRef](#6-comparison-xstate-vs-pure-effect-subscriptionref)
7. [Recommended Architecture](#7-recommended-architecture)
8. [PLG Builder Machine Definition](#8-plg-builder-machine-definition)
9. [Sources](#9-sources)

---

## 1. XState v5 Core Concepts

### 1.1 The `setup()` + `createMachine()` API

XState v5 introduces the `setup()` function as the primary way to define strongly-typed machines. This replaces v4's separate config and options objects with a single, type-inferred chain:

```typescript
import { setup, assign } from 'xstate';

const machine = setup({
  types: {
    context: {} as { count: number },
    events: {} as { type: 'inc' } | { type: 'dec' },
  },
  actions: {
    increment: assign({ count: ({ context }) => context.count + 1 }),
    decrement: assign({ count: ({ context }) => context.count - 1 }),
  },
  guards: {
    isPositive: ({ context }) => context.count > 0,
  },
}).createMachine({
  context: { count: 0 },
  on: {
    inc: { actions: 'increment' },
    dec: { guard: 'isPositive', actions: 'decrement' },
  },
});
```

Key benefits of `setup()`:
- All types are inferred from a single source of truth
- Named actions, guards, actors, and delays are guaranteed to exist
- Requires TypeScript 5.0+ with `strictNullChecks: true`

### 1.2 Actors as First-Class Citizens

In XState v5, actors are the fundamental building block. State machines are one kind of actor logic, but promises, callbacks, observables, and transition functions are equally supported:

- **Invoked actors** (`invoke`): Finite, state-scoped. Stopped when the invoking state is exited.
- **Spawned actors** (`spawn`): Dynamic, context-scoped. Started and stopped at any time via actions.
- **Actor systems**: The root actor created via `createActor()` establishes a system. All spawned/invoked descendants are part of that system and can communicate via `systemId` registration (the "receptionist pattern").

```typescript
import { createActor } from 'xstate';

const actor = createActor(machine);
actor.subscribe((snapshot) => {
  console.log(snapshot.value, snapshot.context);
});
actor.start();
actor.send({ type: 'inc' });
```

### 1.3 Context and Assign

Context is the machine's extended state (data). It is immutable; updates go through `assign()`:

```typescript
actions: assign({
  selections: ({ context, event }) => ({
    ...context.selections,
    [event.category]: event.value,
  }),
})
```

All state nodes in a machine (including parallel regions) share a single root context. This is important for builder UIs where selections across categories need to be visible to guards in other regions.

### 1.4 Key Action Creators

| Action | Purpose |
|--------|---------|
| `assign()` | Update context immutably |
| `sendTo()` | Send event to another actor by reference or ID |
| `raise()` | Send event to self (processed after current transition) |
| `enqueueActions()` | Conditionally batch multiple actions |
| `emit()` | Emit event to subscribers (for observation, not transitions) |

### 1.5 Parallel States

Parallel states model independent-but-simultaneous concerns. All regions are active at the same time and receive events simultaneously:

```typescript
type: 'parallel',
states: {
  analytics: { initial: 'posthog', states: { posthog: {}, amplitude: {}, none: {} } },
  featureFlags: { initial: 'posthogFlags', states: { posthogFlags: {}, launchDarkly: {}, none: {} } },
  crm: { initial: 'attio', states: { attio: {}, hubspot: {}, none: {} } },
}
```

State value is an object: `{ analytics: 'posthog', featureFlags: 'posthogFlags', crm: 'attio' }`.

When all regions reach final states, the parallel state's `onDone` fires -- useful for a "all categories configured" completion signal.

---

## 2. Guards and Conditional Transitions for Dependency Constraints

### 2.1 Guard Fundamentals

Guards are pure, synchronous boolean functions that gate transitions. In v5, the property is `guard` (renamed from v4's `cond`):

```typescript
const builderMachine = setup({
  guards: {
    isPostHogAnalytics: ({ context }) =>
      context.selections.analytics === 'posthog',

    hasFeatureFlags: ({ context }) =>
      context.selections.featureFlags !== 'none',

    requiresPostHogForExperiments: ({ context }) =>
      context.selections.experiments === 'posthog-experiments'
        ? context.selections.analytics === 'posthog' &&
          context.selections.featureFlags === 'posthog-flags'
        : true,
  },
}).createMachine({ /* ... */ });
```

### 2.2 Composable Higher-Order Guards

XState v5 provides `and()`, `or()`, and `not()` for composing guards declaratively:

```typescript
import { and, or, not } from 'xstate';

on: {
  SELECT_EXPERIMENT: {
    guard: and([
      'hasFeatureFlags',
      or(['isPostHogAnalytics', 'isAmplitudeAnalytics']),
    ]),
    actions: 'setExperiment',
  },
}
```

This directly maps to the PLG builder's dependency rules, such as:
- PostHog Experiments requires `Analytics = PostHog AND FeatureFlags = PostHog Flags`
- Statsig Experiments requires `FeatureFlags != None`
- Amplitude Experiment requires `Analytics = Amplitude`

### 2.3 Parameterized Guards

Guards can accept parameters, enabling reusable constraint checks:

```typescript
guards: {
  isCategoryValue: (_, params: { category: string; value: string }) =>
    // check context...
},
// Usage:
guard: {
  type: 'isCategoryValue',
  params: { category: 'analytics', value: 'posthog' },
}
```

### 2.4 Multiple Guarded Transitions (Pattern Matching)

When an event has multiple possible targets based on guards, XState evaluates them in order. The first matching guard wins, with an optional unguarded fallback:

```typescript
on: {
  SELECT_ANALYTICS: [
    {
      guard: 'isSegmentSelected',
      actions: ['setAnalytics', 'requireDownstreamDestination'],
      target: '.selectingSegmentDestination',
    },
    {
      actions: ['setAnalytics', 'propagateConstraints'],
      // default: no guard needed
    },
  ],
}
```

---

## 3. Actor Model for Interdependent Selections

### 3.1 Parent-Child Actor Communication

For a builder with 11+ categories, each category could be modeled as a spawned child actor. The parent orchestrator sends constraint-change events to children when selections change:

```typescript
// Parent receives a selection change
on: {
  CATEGORY_SELECTED: {
    actions: [
      assign({ /* update selection */ }),
      // Notify dependent categories
      sendTo('featureFlagsActor', ({ event }) => ({
        type: 'CONSTRAINT_CHANGED',
        analyticsProvider: event.value,
      })),
    ],
  },
}
```

### 3.2 The Receptionist Pattern (System-Level Communication)

XState v5's actor systems allow actors to register by `systemId` and be looked up by any actor in the system. This decouples parent-child hierarchies:

```typescript
invoke: {
  src: 'analyticsSelector',
  systemId: 'analytics',
},
// Any actor in the system can send to:
sendTo(({ system }) => system.get('analytics'), { type: 'RESET' })
```

### 3.3 Trade-off: Parallel States vs Spawned Actors

For the PLG builder, **parallel states with shared context** are preferable to spawned actors:

| Aspect | Parallel States | Spawned Actors |
|--------|----------------|----------------|
| Shared state | Single context, all regions see all selections | Each actor has own state; requires message passing |
| Guard access | Guards can check any selection in context directly | Guards only see local actor state |
| Complexity | Moderate: one machine, multiple regions | High: actor communication, synchronization |
| Visualization | Fully supported in Stately editor | Limited visualization for dynamic spawns |
| Persistence | Automatic deep persistence in v5 | Also persisted, but more complex to restore |

**Recommendation:** Use a single machine with parallel states for the 11 builder categories. Reserve spawned actors for truly dynamic content (e.g., user-defined feature flag list entries).

---

## 4. Eventless (Always) Transitions for Constraint Propagation

### 4.1 How `always` Works

Eventless transitions (labeled `always`) are evaluated immediately after every normal transition. They fire if their guard is true, without needing an explicit event:

```typescript
states: {
  experiments: {
    initial: 'idle',
    states: {
      idle: {},
      posthogExperiments: {
        always: {
          // If PostHog analytics is deselected, auto-invalidate this selection
          guard: not('isPostHogAnalytics'),
          target: 'idle',
          actions: 'clearExperimentSelection',
        },
      },
      statsig: {
        always: {
          guard: not('hasFeatureFlags'),
          target: 'idle',
          actions: 'clearExperimentSelection',
        },
      },
    },
  },
}
```

### 4.2 Cascading Constraint Propagation

When Analytics changes from PostHog to Amplitude:
1. `assign` updates `context.selections.analytics = 'amplitude'`
2. After the transition, `always` guards on `experiments.posthogExperiments` fire
3. Since `isPostHogAnalytics` is now false, machine transitions experiments to `idle`
4. The `clearExperimentSelection` action updates context
5. Further `always` guards on downstream states are re-evaluated

This cascade is automatic and deterministic. XState evaluates `always` transitions in a loop until no more guards are satisfied, preventing the need for manual event chains.

### 4.3 Avoiding Infinite Loops

Guards must be designed so that the action they trigger invalidates their own condition:
- Guard checks `experiments === 'posthog-experiments' && analytics !== 'posthog'`
- Action sets `experiments = 'none'`
- On re-evaluation, guard returns `false` (experiments is no longer posthog-experiments)

XState will detect most infinite loop conditions and warn at runtime.

---

## 5. XState + Effect Integration Patterns

### 5.1 Sandro Maglione's XState + Effect Pattern

The canonical integration pattern (from the XState + Effect audio player example) wraps Effect programs inside XState actions:

```typescript
import { Effect, Console } from 'effect';
import { setup, assign } from 'xstate';

// Effect function for the side effect
const validateConstraints = (selections: Selections): Effect.Effect<ValidationResult> =>
  Effect.gen(function* () {
    yield* Console.log('Validating constraints...');
    // Use Effect Graph module for DAG validation
    const graph = yield* buildConstraintGraph(selections);
    const violations = yield* findViolations(graph);
    return { valid: violations.length === 0, violations };
  });

// XState action wrapping the Effect
const machine = setup({
  actions: {
    validateAndPropagate: assign(({ context }) => {
      const result = validateConstraints(context.selections).pipe(
        Effect.runSync // Safe because our validation is synchronous
      );
      return result.valid
        ? { validationErrors: [] }
        : { validationErrors: result.violations, selections: autoFix(context.selections, result.violations) };
    }),
  },
}).createMachine({ /* ... */ });
```

Key principles:
- Effect functions are defined outside the machine for testability
- `Effect.runSync` is used when the Effect is guaranteed synchronous
- For async Effects (API calls), use `invoke` with a promise actor:

```typescript
invoke: {
  src: fromPromise(({ input }) =>
    validateRemote(input.selections).pipe(Effect.runPromise)
  ),
  input: ({ context }) => ({ selections: context.selections }),
  onDone: { actions: 'applyValidation' },
  onError: { actions: 'handleError' },
}
```

### 5.2 Effect Services Inside XState via `provide()`

XState's `provide()` method enables dependency injection, paralleling Effect's Layer system:

```typescript
// Production: real API calls
const prodMachine = machine.provide({
  actors: {
    validateRemote: fromPromise(({ input }) =>
      pipe(
        ConstraintService.validate(input),
        Effect.provide(LiveConstraintLayer),
        Effect.runPromise,
      )
    ),
  },
});

// Test: mocked services
const testMachine = machine.provide({
  actors: {
    validateRemote: fromPromise(({ input }) =>
      pipe(
        ConstraintService.validate(input),
        Effect.provide(TestConstraintLayer),
        Effect.runPromise,
      )
    ),
  },
});
```

### 5.3 File Organization Pattern

Recommended structure for an XState + Effect machine:

```
src/builder/
  machine/
    context.ts        # Context type, initial context
    events.ts         # Discriminated union of all events
    guards.ts         # Guard implementations
    actions.ts        # Action implementations (wrapping Effect)
    actors.ts         # Invoked/spawned actor logic
    machine.ts        # setup().createMachine() combining all above
  effects/
    constraint-graph.ts   # Effect Graph-based DAG for constraints
    validation.ts         # Effect programs for constraint validation
    codegen.ts            # Effect programs for code generation
  index.ts            # Public API: createBuilderActor()
```

---

## 6. Comparison: XState vs Pure Effect SubscriptionRef

### 6.1 Effect SubscriptionRef Approach

A pure Effect approach would use `SubscriptionRef` for reactive state, `Match.exhaustive` for state-based rendering, and the Effect `Graph` module for constraint DAGs:

```typescript
import { SubscriptionRef, Effect, Stream, Match } from 'effect';

const BuilderState = SubscriptionRef.make({
  step: 'analytics' as BuilderStep,
  selections: {} as Selections,
  errors: [] as ValidationError[],
});

// Observe changes
const ui = Effect.gen(function* () {
  const ref = yield* BuilderState;
  const changes = yield* SubscriptionRef.changes(ref);
  yield* Stream.runForEach(changes, (state) =>
    Match.value(state.step).pipe(
      Match.when('analytics', () => renderAnalyticsStep(state)),
      Match.when('featureFlags', () => renderFlagsStep(state)),
      Match.exhaustive,
    )
  );
});
```

### 6.2 Head-to-Head Comparison

| Dimension | XState v5 | Effect SubscriptionRef + Match |
|-----------|-----------|-------------------------------|
| **State modeling** | Explicit finite states with named transitions | Freeform state object; constraints via types |
| **Impossible states** | Structurally prevented by state chart topology | Prevented by branded types + schema validation |
| **Constraint propagation** | `always` transitions + guards (automatic cascade) | Manual: update ref, re-run validation Effect |
| **Visualization** | Stately editor renders state charts | No built-in visualization |
| **Testability** | `machine.transition()` is pure; snapshot testing | Effect.runSync with test layers |
| **React integration** | `@xstate/react` with `useActor()` hook | Custom hook wrapping `SubscriptionRef.changes` stream |
| **Learning curve** | Statechart concepts + XState API | Effect ecosystem (already adopted in this project) |
| **Bundle size** | ~15KB (xstate) + ~3KB (@xstate/react) | 0 additional (Effect already bundled) |
| **Type safety** | Strong via `setup()`, but types are internal to machine | Effect Schema + branded types for domain modeling |
| **DAG/Graph** | No built-in graph; guards are flat boolean checks | `Graph` module with topological sort, cycle detection |

### 6.3 Where Each Excels

**XState is better for:**
- Modeling the wizard flow itself (which step, can go forward/back, completion)
- Preventing impossible transitions (you literally cannot send an event the machine does not handle in the current state)
- Visualizing the builder's state chart for design review
- Handling complex multi-step async flows (invoke, onDone, onError)

**Effect SubscriptionRef is better for:**
- Reactive data subscriptions (multiple UI components observing selection changes)
- Composing with the existing Effect service/layer architecture
- Running constraint validation as Effect programs with proper error channels
- Graph-based dependency resolution using `Graph.topo` and `Graph.isAcyclic`

---

## 7. Recommended Architecture

### 7.1 Hybrid: XState for Flow + Effect Graph for Constraints

The optimal architecture combines both:

```
+--------------------------------------------------+
|              XState Builder Machine               |
|  (wizard flow, step transitions, UI state)        |
|                                                   |
|  States: idle -> configuring (parallel) -> review |
|          -> generating -> complete                |
|                                                   |
|  Parallel regions during "configuring":           |
|    analytics | flags | experiments | surveys |     |
|    crm | pricing | plans | events | iac | dist   |
+--------------------------------------------------+
         |                        ^
         | on SELECT_*:           | validation result
         | run Effect program     | (valid/violations)
         v                        |
+--------------------------------------------------+
|          Effect Constraint Engine                  |
|  (DAG validation, propagation, auto-fix)          |
|                                                   |
|  Graph<Category, DependsOn>                       |
|    analytics -> featureFlags -> experiments        |
|    analytics -> surveys                            |
|    pricing -> plans -> events                      |
|                                                   |
|  ConstraintService.validate(selections):          |
|    1. Build graph from current selections          |
|    2. Topological sort for evaluation order        |
|    3. Check each node's constraints                |
|    4. Return violations + suggested auto-fixes     |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|          Effect Codegen Engine                     |
|  (template rendering, file generation)            |
|                                                   |
|  Triggered when machine reaches "generating"      |
|  Uses Layer/Service pattern for provider adapters  |
+--------------------------------------------------+
```

### 7.2 Responsibility Split

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Which wizard step is active | XState | Finite state; transitions are explicit |
| Can the user proceed to next step | XState guard | Boolean check on context validity |
| Which options are available/disabled | Effect ConstraintService | DAG traversal determines availability |
| What happens when a selection changes | XState action calling Effect | Assign new value, then run constraint validation |
| Cascading invalidation | `always` transitions + Effect | `always` guard calls Effect.runSync for DAG check |
| Code generation | Effect + invoke | XState invokes an Effect promise actor |
| Persistence / undo-redo | XState snapshot | `actor.getPersistedSnapshot()` + `createActor(machine, { snapshot })` |

### 7.3 Why Not Pure XState for Constraints?

XState guards are flat boolean functions -- they cannot express graph relationships like "if A depends on B, and B depends on C, changing C should cascade through B to A." You would need to manually encode every transitive dependency as a guard, which is O(n^2) in the number of constraint edges.

Effect's `Graph` module provides:
- `Graph.topo()` for evaluation order
- `Graph.isAcyclic()` for validation
- `Graph.dfs()` for finding all dependents of a changed node

This means the constraint engine scales with the number of categories without combinatorial guard explosion.

### 7.4 Why Not Pure Effect for Flow?

`SubscriptionRef` is a reactive primitive, not a state machine. It allows any mutation at any time. There is no structural guarantee that the builder cannot be in an impossible state (e.g., "generating" while "configuring" is incomplete). XState makes these impossible by construction.

---

## 8. PLG Builder Machine Definition

### 8.1 Events

```typescript
// builder/machine/events.ts
import type { Category, OptionId, Preset } from '../types';

export type BuilderEvent =
  | { type: 'SELECT_OPTION'; category: Category; value: OptionId }
  | { type: 'APPLY_PRESET'; preset: Preset }
  | { type: 'CLEAR_CATEGORY'; category: Category }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SKIP_TO_STEP'; step: string }
  | { type: 'START_GENERATION' }
  | { type: 'GENERATION_COMPLETE'; artifacts: GeneratedArtifacts }
  | { type: 'GENERATION_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'CONSTRAINT_VIOLATION'; violations: Violation[] }
  | { type: 'AUTO_FIX_APPLIED'; fixes: Fix[] };
```

### 8.2 Context

```typescript
// builder/machine/context.ts
export interface BuilderContext {
  // Current selections for all 11 categories
  selections: {
    analytics: 'posthog' | 'amplitude' | 'mixpanel' | 'segment' | 'none';
    featureFlags: 'posthog-flags' | 'launchdarkly' | 'statsig' | 'growthbook' | 'none';
    experiments: 'posthog-experiments' | 'statsig' | 'amplitude-experiment' | 'growthbook-experiments' | 'none';
    surveys: 'posthog-surveys' | 'typeform' | 'formbricks' | 'none';
    crm: 'attio' | 'hubspot' | 'salesforce' | 'none';
    pricing: 'free' | 'freemium' | 'free-trial' | 'usage-based' | 'seat-based' | 'custom';
    plans: PlanConfig;
    events: EventId[];
    featureFlagsList: FeatureFlagDef[];
    iac: 'alchemy-effect';
    distribution: 'shadcn-registry';
  };

  // Constraint validation state
  violations: Violation[];
  availableOptions: Record<Category, OptionId[]>;

  // Wizard navigation
  currentStep: number;
  completedSteps: Set<string>;

  // Generation output
  artifacts: GeneratedArtifacts | null;
  generationError: string | null;
}
```

### 8.3 Full Machine Definition

```typescript
// builder/machine/machine.ts
import { setup, assign, and, or, not, fromPromise } from 'xstate';
import { Effect, pipe } from 'effect';
import type { BuilderContext, BuilderEvent } from './types';

export const builderMachine = setup({
  types: {
    context: {} as BuilderContext,
    events: {} as BuilderEvent,
  },

  guards: {
    // --- Category-level guards ---
    isPostHogAnalytics: ({ context }) =>
      context.selections.analytics === 'posthog',

    isAmplitudeAnalytics: ({ context }) =>
      context.selections.analytics === 'amplitude',

    hasFeatureFlags: ({ context }) =>
      context.selections.featureFlags !== 'none',

    isPostHogFlags: ({ context }) =>
      context.selections.featureFlags === 'posthog-flags',

    isPaidPricing: ({ context }) =>
      context.selections.pricing !== 'free',

    // --- Composite constraint guards ---
    canSelectPostHogExperiments: ({ context }) =>
      context.selections.analytics === 'posthog' &&
      context.selections.featureFlags === 'posthog-flags',

    canSelectPostHogSurveys: ({ context }) =>
      context.selections.analytics === 'posthog',

    canSelectAmplitudeExperiment: ({ context }) =>
      context.selections.analytics === 'amplitude',

    canSelectGrowthBookExperiments: ({ context }) =>
      context.selections.featureFlags === 'growthbook',

    // --- Flow guards ---
    allCategoriesConfigured: ({ context }) =>
      context.violations.length === 0 &&
      context.completedSteps.size >= 6, // minimum required categories

    hasNoViolations: ({ context }) =>
      context.violations.length === 0,

    // --- Constraint invalidation guards (for `always` transitions) ---
    experimentsInvalidated: ({ context }) => {
      const { analytics, featureFlags, experiments } = context.selections;
      if (experiments === 'posthog-experiments')
        return analytics !== 'posthog' || featureFlags !== 'posthog-flags';
      if (experiments === 'amplitude-experiment')
        return analytics !== 'amplitude';
      if (experiments === 'growthbook-experiments')
        return featureFlags !== 'growthbook';
      if (experiments === 'statsig')
        return featureFlags === 'none';
      return false;
    },

    surveysInvalidated: ({ context }) => {
      const { analytics, surveys } = context.selections;
      if (surveys === 'posthog-surveys') return analytics !== 'posthog';
      return false;
    },

    flagsInvalidated: ({ context }) => {
      const { analytics, featureFlags } = context.selections;
      if (featureFlags === 'posthog-flags') return analytics !== 'posthog';
      return false;
    },
  },

  actions: {
    setSelection: assign({
      selections: ({ context, event }) => {
        if (event.type !== 'SELECT_OPTION') return context.selections;
        return { ...context.selections, [event.category]: event.value };
      },
    }),

    clearExperiments: assign({
      selections: ({ context }) => ({
        ...context.selections,
        experiments: 'none' as const,
      }),
    }),

    clearSurveys: assign({
      selections: ({ context }) => ({
        ...context.selections,
        surveys: 'none' as const,
      }),
    }),

    clearFlags: assign({
      selections: ({ context }) => ({
        ...context.selections,
        featureFlags: 'none' as const,
      }),
    }),

    applyPreset: assign({
      selections: ({ event }) => {
        if (event.type !== 'APPLY_PRESET') return {};
        // Preset application logic -- each preset defines all 11 categories
        return event.preset.selections;
      },
    }),

    markStepComplete: assign({
      completedSteps: ({ context }) => {
        const steps = new Set(context.completedSteps);
        steps.add(String(context.currentStep));
        return steps;
      },
    }),

    nextStep: assign({
      currentStep: ({ context }) => context.currentStep + 1,
    }),

    prevStep: assign({
      currentStep: ({ context }) => Math.max(0, context.currentStep - 1),
    }),

    setArtifacts: assign({
      artifacts: ({ event }) =>
        event.type === 'GENERATION_COMPLETE' ? event.artifacts : null,
    }),

    setGenerationError: assign({
      generationError: ({ event }) =>
        event.type === 'GENERATION_ERROR' ? event.error : null,
    }),

    updateAvailableOptions: assign({
      availableOptions: ({ context }) => {
        // This would call Effect.runSync on the constraint engine
        // to compute which options are currently valid per category
        return computeAvailableOptions(context.selections);
      },
    }),
  },

  actors: {
    generateCode: fromPromise(async ({ input }: { input: { selections: BuilderContext['selections'] } }) => {
      // Wraps Effect codegen pipeline as a promise
      return pipe(
        CodegenService.generate(input.selections),
        Effect.runPromise,
      );
    }),
  },
}).createMachine({
  id: 'plgBuilder',
  initial: 'idle',
  context: {
    selections: {
      analytics: 'posthog',
      featureFlags: 'posthog-flags',
      experiments: 'posthog-experiments',
      surveys: 'posthog-surveys',
      crm: 'attio',
      pricing: 'freemium',
      plans: defaultPlanConfig,
      events: defaultEvents,
      featureFlagsList: defaultFlags,
      iac: 'alchemy-effect',
      distribution: 'shadcn-registry',
    },
    violations: [],
    availableOptions: {},
    currentStep: 0,
    completedSteps: new Set(),
    artifacts: null,
    generationError: null,
  },

  states: {
    idle: {
      on: {
        SELECT_OPTION: { target: 'configuring', actions: ['setSelection', 'updateAvailableOptions'] },
        APPLY_PRESET: { target: 'configuring', actions: ['applyPreset', 'updateAvailableOptions'] },
      },
    },

    configuring: {
      // --- Constraint propagation via always transitions ---
      // These fire after ANY transition within "configuring"
      always: [
        {
          guard: 'flagsInvalidated',
          actions: ['clearFlags', 'updateAvailableOptions'],
        },
        {
          guard: 'experimentsInvalidated',
          actions: ['clearExperiments', 'updateAvailableOptions'],
        },
        {
          guard: 'surveysInvalidated',
          actions: ['clearSurveys', 'updateAvailableOptions'],
        },
      ],

      on: {
        SELECT_OPTION: {
          actions: ['setSelection', 'updateAvailableOptions'],
        },
        APPLY_PRESET: {
          actions: ['applyPreset', 'updateAvailableOptions'],
        },
        CLEAR_CATEGORY: {
          actions: assign({
            selections: ({ context, event }) => ({
              ...context.selections,
              [event.category]: 'none',
            }),
          }),
        },
        NEXT_STEP: {
          actions: ['markStepComplete', 'nextStep'],
        },
        PREV_STEP: {
          actions: 'prevStep',
        },
        START_GENERATION: {
          guard: 'allCategoriesConfigured',
          target: 'generating',
        },
        RESET: { target: 'idle' },
      },
    },

    generating: {
      invoke: {
        src: 'generateCode',
        input: ({ context }) => ({ selections: context.selections }),
        onDone: {
          target: 'complete',
          actions: 'setArtifacts',
        },
        onError: {
          target: 'configuring',
          actions: 'setGenerationError',
        },
      },
    },

    complete: {
      on: {
        RESET: { target: 'idle' },
      },
    },
  },
});
```

### 8.4 React Integration

```typescript
// builder/index.tsx
import { useActor } from '@xstate/react';
import { builderMachine } from './machine/machine';

export function PLGBuilder() {
  const [snapshot, send] = useActor(builderMachine);

  const { selections, availableOptions, currentStep, violations } = snapshot.context;

  return (
    <div>
      {snapshot.matches('idle') && <PresetSelector onSelect={(p) => send({ type: 'APPLY_PRESET', preset: p })} />}

      {snapshot.matches('configuring') && (
        <BuilderWizard
          step={currentStep}
          selections={selections}
          available={availableOptions}
          violations={violations}
          onSelect={(category, value) => send({ type: 'SELECT_OPTION', category, value })}
          onNext={() => send({ type: 'NEXT_STEP' })}
          onBack={() => send({ type: 'PREV_STEP' })}
          onGenerate={() => send({ type: 'START_GENERATION' })}
        />
      )}

      {snapshot.matches('generating') && <GeneratingSpinner />}

      {snapshot.matches('complete') && (
        <ResultView artifacts={snapshot.context.artifacts} onReset={() => send({ type: 'RESET' })} />
      )}
    </div>
  );
}
```

### 8.5 Effect Constraint Engine (Called from Guards/Actions)

```typescript
// builder/effects/constraint-graph.ts
import { Effect, Graph } from 'effect';
import type { Category, Selections, Violation } from '../types';

// Build a DAG of category dependencies
const buildConstraintDAG = (selections: Selections) =>
  Effect.sync(() =>
    Graph.directed<Category, 'depends-on'>((g) => {
      const analytics = Graph.addNode(g, 'analytics');
      const flags = Graph.addNode(g, 'featureFlags');
      const experiments = Graph.addNode(g, 'experiments');
      const surveys = Graph.addNode(g, 'surveys');
      const pricing = Graph.addNode(g, 'pricing');
      const plans = Graph.addNode(g, 'plans');
      const events = Graph.addNode(g, 'events');

      // Static dependency edges
      Graph.addEdge(g, flags, analytics, 'depends-on');      // some flags depend on analytics
      Graph.addEdge(g, experiments, flags, 'depends-on');     // experiments depend on flags
      Graph.addEdge(g, experiments, analytics, 'depends-on'); // experiments depend on analytics
      Graph.addEdge(g, surveys, analytics, 'depends-on');     // some surveys depend on analytics
      Graph.addEdge(g, plans, pricing, 'depends-on');         // plans depend on pricing model
      Graph.addEdge(g, events, pricing, 'depends-on');        // events depend on pricing (monetization events)
    })
  );

// Validate all constraints using topological order
export const validateConstraints = (selections: Selections): Effect.Effect<Violation[]> =>
  Effect.gen(function* () {
    const dag = yield* buildConstraintDAG(selections);
    const order = Array.from(Graph.values(Graph.topo(dag)));

    const violations: Violation[] = [];
    for (const category of order) {
      const categoryViolations = yield* checkCategoryConstraints(category, selections);
      violations.push(...categoryViolations);
    }
    return violations;
  });

// Compute available options for each category based on current selections
export const computeAvailableOptions = (selections: Selections): Record<Category, OptionId[]> => {
  return validateConstraints(selections).pipe(
    Effect.map((violations) => {
      // Filter out options that would create violations
      // ... implementation
    }),
    Effect.runSync,
  );
};
```

---

## 9. Sources

- [XState v5 Announcement](https://stately.ai/blog/2023-12-01-xstate-v5)
- [XState Actors Documentation](https://stately.ai/docs/actors)
- [XState State Machines Documentation](https://stately.ai/docs/machines)
- [XState Setup API](https://stately.ai/docs/setup)
- [XState Guards Documentation](https://stately.ai/docs/guards)
- [XState Parallel States](https://stately.ai/docs/parallel-states)
- [XState Actions Documentation](https://stately.ai/docs/actions)
- [XState Context Documentation](https://stately.ai/docs/context)
- [XState Eventless Transitions](https://stately.ai/docs/eventless-transitions)
- [XState TypeScript Documentation](https://stately.ai/docs/typescript)
- [XState Migration v4 to v5](https://stately.ai/docs/migration)
- [XState Quick Start](https://stately.ai/docs/quick-start)
- [State Machines and Actors in XState v5 - Sandro Maglione](https://www.sandromaglione.com/articles/state-machines-and-actors-in-xstate-v5)
- [Getting Started with XState and Effect - Audio Player](https://www.sandromaglione.com/articles/getting-started-with-xstate-and-effect-audio-player)
- [State Management with XState State Machines and Effect](https://www.sandromaglione.com/newsletter/state-management-with-xstate-state-machines-and-effect)
- [XState + Effect GitHub Repository](https://github.com/SandroMaglione/getting-started-xstate-and-effect)
- [XState and Effect Discussion](https://github.com/statelyai/xstate/discussions/4767)
- [Patterns for State Management with Actors in React](https://www.typeonce.dev/article/patterns-for-state-management-with-actors-in-react-with-xstate)
- [Effect SubscriptionRef Documentation](https://effect.website/docs/state-management/subscriptionref/)
- [XState GitHub Repository](https://github.com/statelyai/xstate)
- [Managing Multi-Step Forms in Vue with XState](https://mayashavin.com/articles/manage-multi-step-forms-vue-xstate)
- [Building Incremental Views with XState Parallel States](https://timdeschryver.dev/blog/building-incremental-views-with-xstate-parallel-states)
