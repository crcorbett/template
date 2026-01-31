# PLG Service Specification

## Product-Led Growth Abstraction Layer

**Version:** 0.1.0
**Status:** Draft
**Date:** 2026-01-31

---

## 1. Executive Summary

This specification defines a **PLG (Product-Led Growth) Service** — an abstract, pluggable service layer built on Effect TypeScript that provides a unified interface over multiple PLG tool providers. The service enables consuming applications to define their PLG stack once using abstract representations, then swap or compose concrete provider implementations (PostHog, Attio, LaunchDarkly, Amplitude, Segment, etc.) via Effect Layers.

The PLG service is distributed via a **ShadCN registry**, allowing consumers to scaffold customized PLG stacks into their projects using the `shadcn` CLI. An **interactive PLG Builder** (modeled after Better T Stack) lets developers visually compose their stack — selecting analytics, feature flags, experiments, surveys, CRM, pricing, and IaC providers — then generates typed constants, SDK wrappers, and a `shadcn` CLI command from their selections.

Infrastructure for each provider is deployed via **alchemy-effect** IaC providers, which are also composable and distributable through the same registry system.

---

## 2. Design Principles

1. **Abstract Over Concrete** — Define PLG capabilities (analytics, feature flags, experiments, surveys, CRM, dashboards) as abstract Effect services. Concrete providers implement these services via Layers.

2. **Composition Over Configuration** — Consumers compose their PLG stack by merging provider Layers. No monolithic config files; the type system enforces completeness.

3. **Type Safety End-to-End** — All domain primitives (IDs, keys, scores, monetary values, percentages, emails, timestamps) are **branded types** with runtime validation constraints. Branded types make it impossible to pass a `CustomerId` where a `DistinctId` is expected, even though both are strings at runtime. Every data structure is an Effect Schema with types derived from schemas — never raw TypeScript interfaces.

4. **Infrastructure as Code** — Each provider's infrastructure (PostHog feature flags, Attio attributes, etc.) is managed as alchemy-effect resources, deployed alongside the service layer.

5. **Registry Distribution** — PLG service definitions, provider implementations, and IaC stacks are distributed as ShadCN registry items. Consumers use `npx shadcn add @plg/...` to scaffold their stack.

6. **Declarative Constraints** — Provider compatibility rules are modeled as a **directed acyclic graph** using Effect's `Graph` module, not imperative if-chains. Constraints are data (nodes + edges), not code. **XState v5** enforces these constraints as composable guards (`and()`, `or()`, `not()`) with `always` transitions for automatic cascading. This makes the constraint system testable, visualizable, and extensible.

7. **Config-Driven Generation** — Code generation is a pure function from a validated Effect Schema config to string output. The builder UI captures user intent into a typed config; generators produce deterministic TypeScript from that config. No intermediate template languages.

8. **Dual Interface, Shared Core** — The PLG builder has two interfaces: a **web UI** (React + effect-atom + XState) and a **CLI** (`@effect/cli` with Options, Prompts, and wizard flows). Both consume the same `plg-builder-core` package containing schemas, constraints, generators, and presets. The CLI supports flags mode (CI/CD), wizard mode (interactive), and preset mode.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Consumer Application                         │
│                                                                   │
│   import { PLG } from "@plg/core"                                │
│   import { PostHogAnalytics } from "@plg/posthog"                │
│   import { AttioCustomers } from "@plg/attio"                    │
│                                                                   │
│   const plgStack = Layer.mergeAll(                                │
│     PostHogAnalytics.Live,     // implements Analytics + Flags    │
│     AttioCustomers.Live,       // implements Customers            │
│   )                                                               │
│                                                                   │
│   program.pipe(Effect.provide(plgStack))                         │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼───────┐ ┌───▼────┐ ┌───────▼───────┐
        │  PLG.Analytics │ │PLG.Flags│ │PLG.Customers  │
        │  (abstract)    │ │(abstract│ │(abstract)     │
        └───────┬───────┘ └───┬────┘ └───────┬───────┘
                │              │              │
        ┌───────▼───────┐ ┌───▼────┐ ┌───────▼───────┐
        │   PostHog      │ │PostHog │ │   Attio        │
        │   Analytics    │ │ Flags  │ │   Customers    │
        │   Layer        │ │ Layer  │ │   Layer        │
        └───────┬───────┘ └───┬────┘ └───────┬───────┘
                │              │              │
        ┌───────▼───────┐ ┌───▼────┐ ┌───────▼───────┐
        │@packages/      │ │@pkgs/  │ │@packages/      │
        │posthog (SDK)   │ │posthog │ │attio (SDK)     │
        └───────┬───────┘ └───┬────┘ └───────┬───────┘
                │              │              │
        ┌───────▼───────┐ ┌───▼────┐ ┌───────▼───────┐
        │ alchemy-       │ │alchemy-│ │ alchemy-       │
        │ posthog (IaC)  │ │posthog │ │ attio (IaC)    │
        └────────────────┘ └────────┘ └────────────────┘
```

### 3.1 Layer Hierarchy

```
Layer 0: PLG Abstract Services    — Context.Tags defining capabilities
Layer 1: Provider Implementations — Concrete Layers (PostHog, Attio, etc.)
Layer 2: SDK Clients              — Typed API clients (@packages/posthog, @packages/attio)
Layer 3: IaC Providers            — Alchemy-effect resource definitions
Layer 4: ShadCN Registry          — Distribution and scaffolding system
```

---

## 4. Branded Type Taxonomy

All PLG domain primitives are **branded types** — `Schema.String` (or `Schema.Number`) piped through validation constraints and `Schema.brand()`. This provides:

1. **Nominal type safety** — A `DistinctId` and `CustomerId` are both `string & Brand<"...">` but are incompatible at the type level. You cannot accidentally pass one where the other is expected.
2. **Runtime validation** — Constraints (patterns, ranges, lengths) are enforced when decoding unknown data via `Schema.decodeUnknown`.
3. **Self-documenting APIs** — Function signatures express domain intent (`score: HealthScore` vs `score: number`).
4. **Security boundaries** — API keys, tokens, and secrets are branded to prevent accidental logging or misuse.

### 4.1 Identity Brands

```typescript
// @plg/core/src/brands/identity.ts

import { Schema } from "effect"

/** Unique user identifier (analytics systems) */
export const DistinctId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(200),
  Schema.brand("DistinctId")
)
export type DistinctId = typeof DistinctId.Type

/** CRM customer/company identifier */
export const CustomerId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("CustomerId")
)
export type CustomerId = typeof CustomerId.Type

/** Group/organization identifier for group analytics */
export const GroupId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("GroupId")
)
export type GroupId = typeof GroupId.Type

/** Group type classifier (e.g., "company", "team", "project") */
export const GroupType = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,49}$/),
  Schema.brand("GroupType")
)
export type GroupType = typeof GroupType.Type

/** User email address — validated format */
export const UserEmail = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("UserEmail")
)
export type UserEmail = typeof UserEmail.Type
```

### 4.2 Event & Action Brands

```typescript
// @plg/core/src/brands/events.ts

import { Schema } from "effect"

/** Event name — snake_case convention enforced */
export const EventName = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,99}$/),
  Schema.brand("EventName")
)
export type EventName = typeof EventName.Type

/** Event properties — typed key-value payload */
export const EventProperties = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type EventProperties = typeof EventProperties.Type

/** User traits for identify calls */
export const UserTraits = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type UserTraits = typeof UserTraits.Type

/** Action identifier (server-side event grouping) */
export const ActionId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("ActionId")
)
export type ActionId = typeof ActionId.Type

/** Timestamp in ISO 8601 format */
export const EventTimestamp = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  Schema.brand("EventTimestamp")
)
export type EventTimestamp = typeof EventTimestamp.Type
```

### 4.3 Feature Flag Brands

```typescript
// @plg/core/src/brands/flags.ts

import { Schema } from "effect"

/** Feature flag key — kebab-case or snake_case */
export const FlagKey = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,99}$/),
  Schema.brand("FlagKey")
)
export type FlagKey = typeof FlagKey.Type

/** Feature flag value (boolean, string, number, or JSON payload) */
export const FlagValue = Schema.Union(
  Schema.Boolean,
  Schema.String,
  Schema.Number,
  Schema.Record({ key: Schema.String, value: Schema.Unknown })
)
export type FlagValue = typeof FlagValue.Type

/** Rollout percentage — constrained 0-100 */
export const RolloutPercentage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("RolloutPercentage")
)
export type RolloutPercentage = typeof RolloutPercentage.Type
```

### 4.4 Experiment Brands

```typescript
// @plg/core/src/brands/experiments.ts

import { Schema } from "effect"

/** Experiment key — links experiment to its feature flag */
export const ExperimentKey = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,99}$/),
  Schema.brand("ExperimentKey")
)
export type ExperimentKey = typeof ExperimentKey.Type

/** Variant key within an experiment */
export const VariantKey = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,49}$/),
  Schema.brand("VariantKey")
)
export type VariantKey = typeof VariantKey.Type

/** Goal metric name for experiment analysis */
export const GoalMetric = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,99}$/),
  Schema.brand("GoalMetric")
)
export type GoalMetric = typeof GoalMetric.Type

/** Minimum sample size — positive integer */
export const SampleSize = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("SampleSize")
)
export type SampleSize = typeof SampleSize.Type

/** Statistical significance threshold — 0 to 1 */
export const SignificanceLevel = Schema.Number.pipe(
  Schema.greaterThan(0),
  Schema.lessThan(1),
  Schema.brand("SignificanceLevel")
)
export type SignificanceLevel = typeof SignificanceLevel.Type
```

### 4.5 Survey Brands

```typescript
// @plg/core/src/brands/surveys.ts

import { Schema } from "effect"

/** Survey identifier */
export const SurveyId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("SurveyId")
)
export type SurveyId = typeof SurveyId.Type

/** Survey question text — non-empty */
export const QuestionText = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(1000),
  Schema.brand("QuestionText")
)
export type QuestionText = typeof QuestionText.Type

/** NPS score — integer 0-10 */
export const NpsScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(10),
  Schema.brand("NpsScore")
)
export type NpsScore = typeof NpsScore.Type

/** CSAT score — integer 1-5 */
export const CsatScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(5),
  Schema.brand("CsatScore")
)
export type CsatScore = typeof CsatScore.Type

/** Generic rating — integer 1-10 */
export const RatingScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(10),
  Schema.brand("RatingScore")
)
export type RatingScore = typeof RatingScore.Type
```

### 4.6 CRM / Customer Brands

```typescript
// @plg/core/src/brands/customers.ts

import { Schema } from "effect"

/** Monthly Recurring Revenue in cents — non-negative integer */
export const MrrCents = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("MrrCents")
)
export type MrrCents = typeof MrrCents.Type

/** Health score — integer 0-100 */
export const HealthScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("HealthScore")
)
export type HealthScore = typeof HealthScore.Type

/** Customer lifecycle stage */
export const LifecycleStage = Schema.Literal(
  "lead", "trial", "activated", "pql", "customer", "expanding", "at_risk", "churned"
).pipe(Schema.brand("LifecycleStage"))
export type LifecycleStage = typeof LifecycleStage.Type

/** Deal/opportunity monetary value in cents */
export const DealValueCents = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("DealValueCents")
)
export type DealValueCents = typeof DealValueCents.Type

/** Pipeline stage identifier */
export const PipelineStage = Schema.Literal(
  "discovery", "evaluation", "negotiation", "closed_won", "closed_lost"
).pipe(Schema.brand("PipelineStage"))
export type PipelineStage = typeof PipelineStage.Type

/** CRM attribute API slug — lowercase with underscores */
export const AttributeSlug = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,49}$/),
  Schema.brand("AttributeSlug")
)
export type AttributeSlug = typeof AttributeSlug.Type
```

### 4.7 Dashboard & Insight Brands

```typescript
// @plg/core/src/brands/dashboards.ts

import { Schema } from "effect"

/** Dashboard identifier */
export const DashboardId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("DashboardId")
)
export type DashboardId = typeof DashboardId.Type

/** Insight identifier */
export const InsightId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("InsightId")
)
export type InsightId = typeof InsightId.Type

/** Cohort identifier */
export const CohortId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("CohortId")
)
export type CohortId = typeof CohortId.Type

/** Insight query type */
export const InsightType = Schema.Literal(
  "trend", "funnel", "retention", "paths", "stickiness", "lifecycle", "formula"
).pipe(Schema.brand("InsightType"))
export type InsightType = typeof InsightType.Type

/** Dashboard tile position — non-negative integer */
export const TilePosition = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("TilePosition")
)
export type TilePosition = typeof TilePosition.Type

/** Dashboard tile dimension — positive integer */
export const TileDimension = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("TileDimension")
)
export type TileDimension = typeof TileDimension.Type
```

### 4.8 Credential & Security Brands

```typescript
// @plg/core/src/brands/credentials.ts

import { Schema } from "effect"

/** PostHog API key — starts with phc_ or phx_ */
export const PostHogApiKey = Schema.String.pipe(
  Schema.pattern(/^ph[cx]_[a-zA-Z0-9]+$/),
  Schema.brand("PostHogApiKey")
)
export type PostHogApiKey = typeof PostHogApiKey.Type

/** PostHog project ID — positive integer */
export const PostHogProjectId = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("PostHogProjectId")
)
export type PostHogProjectId = typeof PostHogProjectId.Type

/** Attio API key — non-empty secret */
export const AttioApiKey = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("AttioApiKey")
)
export type AttioApiKey = typeof AttioApiKey.Type

/** Attio workspace ID */
export const AttioWorkspaceId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("AttioWorkspaceId")
)
export type AttioWorkspaceId = typeof AttioWorkspaceId.Type

/** Generic API endpoint URL */
export const ApiEndpointUrl = Schema.String.pipe(
  Schema.pattern(/^https?:\/\/.+/),
  Schema.brand("ApiEndpointUrl")
)
export type ApiEndpointUrl = typeof ApiEndpointUrl.Type
```

### 4.9 IaC Resource Brands

```typescript
// @plg/core/src/brands/iac.ts

import { Schema } from "effect"

/** IaC resource tag — "managed-by-iac" convention */
export const IaCTag = Schema.Literal("managed-by-iac").pipe(
  Schema.brand("IaCTag")
)
export type IaCTag = typeof IaCTag.Type

/** IaC resource identifier — unique within a stack */
export const ResourceId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(200),
  Schema.brand("ResourceId")
)
export type ResourceId = typeof ResourceId.Type

/** IaC stack name */
export const StackName = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]{0,49}$/),
  Schema.brand("StackName")
)
export type StackName = typeof StackName.Type
```

### 4.10 Branded Type Usage Patterns

```typescript
// === Decoding unknown data at system boundaries ===

import { Schema, Either } from "effect"

// Parse incoming API data — fails with structured error if invalid
const parseDistinctId = Schema.decodeUnknownEither(DistinctId)
const result = parseDistinctId("user-123")
// => Either.right("user-123" as DistinctId)

const invalid = parseDistinctId("")
// => Either.left(ParseError: minLength constraint violated)

// === Composing branded types in schemas ===

const TrackEventRequest = Schema.Struct({
  distinctId: DistinctId,
  event: EventName,
  properties: Schema.optional(EventProperties),
  timestamp: Schema.optional(EventTimestamp),
})
type TrackEventRequest = typeof TrackEventRequest.Type

// === Branded types in service interfaces ===
// Function signatures become self-documenting:
//   track(distinctId: DistinctId, event: EventName, ...)
// vs:
//   track(distinctId: string, event: string, ...)

// === Preventing cross-domain confusion ===
declare const userId: DistinctId
declare const customerId: CustomerId

// analytics.track(customerId, ...)  // ❌ Type error! CustomerId ≠ DistinctId
// analytics.track(userId, ...)      // ✅ Correct

// === Branded numerics prevent unit confusion ===
declare const mrr: MrrCents
declare const score: HealthScore

// customers.setMrr(id, score)       // ❌ Type error! HealthScore ≠ MrrCents
// customers.setMrr(id, mrr)         // ✅ Correct
```

---

## 5. Abstract Service Definitions

### 5.1 PLG.Analytics

Provides event tracking, user identification, and session management. All parameters use branded types from Section 4.

```typescript
// @plg/core/src/analytics.ts

import { Context, Effect, Data } from "effect"
import {
  DistinctId, EventName, EventProperties, UserTraits, GroupType, GroupId
} from "./brands/index.js"

// === Error Types ===

class AnalyticsError extends Data.TaggedError("AnalyticsError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

class TrackingError extends Data.TaggedError("TrackingError")<{
  readonly event: EventName
  readonly cause?: unknown
}> {}

// === Service Interface ===

class Analytics extends Context.Tag("PLG/Analytics")<
  Analytics,
  {
    /** Track a named event with properties */
    readonly track: (
      distinctId: DistinctId,
      event: EventName,
      properties?: EventProperties
    ) => Effect.Effect<void, TrackingError>

    /** Identify a user with traits */
    readonly identify: (
      distinctId: DistinctId,
      traits: UserTraits
    ) => Effect.Effect<void, AnalyticsError>

    /** Associate a user with a group/company */
    readonly group: (
      distinctId: DistinctId,
      groupType: GroupType,
      groupId: GroupId,
      traits?: UserTraits
    ) => Effect.Effect<void, AnalyticsError>

    /** Create an alias between two distinct IDs */
    readonly alias: (
      distinctId: DistinctId,
      alias: DistinctId
    ) => Effect.Effect<void, AnalyticsError>

    /** Flush any buffered events */
    readonly flush: () => Effect.Effect<void, AnalyticsError>
  }
>() {}
```

### 5.2 PLG.FeatureFlags

Provides feature flag evaluation and management.

```typescript
// @plg/core/src/feature-flags.ts

import { Context, Effect, Data } from "effect"
import { DistinctId, FlagKey, FlagValue, EventProperties } from "./brands/index.js"

class FlagEvaluationError extends Data.TaggedError("FlagEvaluationError")<{
  readonly key: FlagKey
  readonly cause?: unknown
}> {}

class FeatureFlags extends Context.Tag("PLG/FeatureFlags")<
  FeatureFlags,
  {
    /** Evaluate a boolean feature flag */
    readonly isEnabled: (
      key: FlagKey,
      distinctId: DistinctId,
      properties?: EventProperties
    ) => Effect.Effect<boolean, FlagEvaluationError>

    /** Evaluate a multivariate feature flag */
    readonly getValue: (
      key: FlagKey,
      distinctId: DistinctId,
      properties?: EventProperties
    ) => Effect.Effect<FlagValue, FlagEvaluationError>

    /** Get all flags for a user */
    readonly getAllFlags: (
      distinctId: DistinctId,
      properties?: EventProperties
    ) => Effect.Effect<ReadonlyMap<FlagKey, FlagValue>, FlagEvaluationError>

    /** Override a flag locally (for testing) */
    readonly override: (
      key: FlagKey,
      value: FlagValue
    ) => Effect.Effect<void, never>
  }
>() {}
```

### 5.3 PLG.Experiments

Provides experiment/A-B test management and variant assignment.

```typescript
// @plg/core/src/experiments.ts

import { Context, Effect, Data, Schema } from "effect"
import {
  DistinctId, ExperimentKey, VariantKey, GoalMetric, SampleSize, SignificanceLevel
} from "./brands/index.js"

const ExperimentResult = Schema.Struct({
  key: ExperimentKey,
  variant: VariantKey,
  payload: Schema.optional(Schema.Unknown),
})
type ExperimentResult = typeof ExperimentResult.Type

const ExperimentConfig = Schema.Struct({
  key: ExperimentKey,
  name: Schema.String.pipe(Schema.minLength(1)),
  variants: Schema.NonEmptyArray(VariantKey),
  goalMetrics: Schema.NonEmptyArray(GoalMetric),
  minimumSampleSize: Schema.optional(SampleSize),
  significanceLevel: Schema.optional(SignificanceLevel),
})
type ExperimentConfig = typeof ExperimentConfig.Type

class ExperimentError extends Data.TaggedError("ExperimentError")<{
  readonly key: ExperimentKey
  readonly cause?: unknown
}> {}

class Experiments extends Context.Tag("PLG/Experiments")<
  Experiments,
  {
    /** Get the variant assigned to a user for an experiment */
    readonly getVariant: (
      key: ExperimentKey,
      distinctId: DistinctId,
    ) => Effect.Effect<ExperimentResult, ExperimentError>

    /** Record an exposure event for an experiment */
    readonly recordExposure: (
      key: ExperimentKey,
      distinctId: DistinctId,
      variant: VariantKey,
    ) => Effect.Effect<void, ExperimentError>
  }
>() {}
```

### 5.4 PLG.Surveys

Provides survey definition and response collection.

```typescript
// @plg/core/src/surveys.ts

import { Context, Effect, Data, Schema } from "effect"
import {
  DistinctId, SurveyId, QuestionText, NpsScore, CsatScore, RatingScore, FlagKey, CohortId
} from "./brands/index.js"

/** Survey question type */
const SurveyQuestionType = Schema.Literal(
  "open", "rating", "nps", "csat", "single_choice", "multiple_choice", "link"
).pipe(Schema.brand("SurveyQuestionType"))
type SurveyQuestionType = typeof SurveyQuestionType.Type

/** Survey display type */
const SurveyDisplayType = Schema.Literal(
  "popover", "widget", "full_screen", "email", "api"
).pipe(Schema.brand("SurveyDisplayType"))
type SurveyDisplayType = typeof SurveyDisplayType.Type

const SurveyQuestion = Schema.Struct({
  text: QuestionText,
  type: SurveyQuestionType,
  required: Schema.optional(Schema.Boolean),
  choices: Schema.optional(Schema.Array(Schema.String.pipe(Schema.minLength(1)))),
})
type SurveyQuestion = typeof SurveyQuestion.Type

const SurveyResponse = Schema.Struct({
  surveyId: SurveyId,
  distinctId: DistinctId,
  responses: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  completedAt: Schema.DateTimeUtc,
})
type SurveyResponse = typeof SurveyResponse.Type

const SurveyConfig = Schema.Struct({
  id: SurveyId,
  name: Schema.String.pipe(Schema.minLength(1)),
  displayType: SurveyDisplayType,
  questions: Schema.NonEmptyArray(SurveyQuestion),
  targetingFlags: Schema.optional(Schema.Array(FlagKey)),
  targetingCohort: Schema.optional(CohortId),
})
type SurveyConfig = typeof SurveyConfig.Type

class SurveyError extends Data.TaggedError("SurveyError")<{
  readonly surveyId: SurveyId
  readonly cause?: unknown
}> {}

class Surveys extends Context.Tag("PLG/Surveys")<
  Surveys,
  {
    /** Check if a survey should be shown to a user */
    readonly shouldShow: (
      surveyId: SurveyId,
      distinctId: DistinctId,
    ) => Effect.Effect<boolean, SurveyError>

    /** Submit a survey response */
    readonly submit: (
      response: SurveyResponse,
    ) => Effect.Effect<void, SurveyError>

    /** Dismiss a survey for a user */
    readonly dismiss: (
      surveyId: SurveyId,
      distinctId: DistinctId,
    ) => Effect.Effect<void, SurveyError>
  }
>() {}
```

### 5.5 PLG.Customers

Provides CRM/customer data management. All monetary values, scores, and stages are branded.

```typescript
// @plg/core/src/customers.ts

import { Context, Effect, Data, Schema } from "effect"
import {
  CustomerId, UserEmail, LifecycleStage, MrrCents, HealthScore,
  DealValueCents, PipelineStage, UserTraits
} from "./brands/index.js"

const CustomerRecord = Schema.Struct({
  id: CustomerId,
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  email: Schema.optional(UserEmail),
  company: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  lifecycleStage: Schema.optional(LifecycleStage),
  mrr: Schema.optional(MrrCents),
  healthScore: Schema.optional(HealthScore),
  traits: Schema.optional(UserTraits),
})
type CustomerRecord = typeof CustomerRecord.Type

class CustomerError extends Data.TaggedError("CustomerError")<{
  readonly customerId?: CustomerId
  readonly cause?: unknown
}> {}

class Customers extends Context.Tag("PLG/Customers")<
  Customers,
  {
    /** Get a customer by ID */
    readonly get: (
      id: CustomerId,
    ) => Effect.Effect<CustomerRecord, CustomerError>

    /** Update customer traits */
    readonly update: (
      id: CustomerId,
      traits: UserTraits,
    ) => Effect.Effect<CustomerRecord, CustomerError>

    /** Update lifecycle stage */
    readonly setLifecycleStage: (
      id: CustomerId,
      stage: LifecycleStage,
    ) => Effect.Effect<void, CustomerError>

    /** Update MRR (in cents) */
    readonly setMrr: (
      id: CustomerId,
      mrr: MrrCents,
    ) => Effect.Effect<void, CustomerError>

    /** Update health score (0-100) */
    readonly setHealthScore: (
      id: CustomerId,
      score: HealthScore,
    ) => Effect.Effect<void, CustomerError>

    /** Mark as Product Qualified Lead */
    readonly markAsPql: (
      id: CustomerId,
    ) => Effect.Effect<void, CustomerError>
  }
>() {}
```

### 5.6 PLG.Dashboards

Provides dashboard and insight management (primarily for IaC, less for runtime).

```typescript
// @plg/core/src/dashboards.ts

import { Context, Effect, Data, Schema } from "effect"
import {
  DashboardId, InsightId, InsightType, TilePosition, TileDimension
} from "./brands/index.js"

const TileLayout = Schema.Struct({
  x: TilePosition,
  y: TilePosition,
  w: TileDimension,
  h: TileDimension,
})
type TileLayout = typeof TileLayout.Type

const InsightConfig = Schema.Struct({
  id: Schema.optional(InsightId),
  name: Schema.String.pipe(Schema.minLength(1)),
  type: InsightType,
  query: Schema.Unknown,  // Provider-specific query format
  dashboardId: Schema.optional(DashboardId),
  layout: Schema.optional(TileLayout),
})
type InsightConfig = typeof InsightConfig.Type

const DashboardSummary = Schema.Struct({
  id: DashboardId,
  name: Schema.String.pipe(Schema.minLength(1)),
  insightCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
})
type DashboardSummary = typeof DashboardSummary.Type

class DashboardError extends Data.TaggedError("DashboardError")<{
  readonly dashboardId?: DashboardId
  readonly cause?: unknown
}> {}

class Dashboards extends Context.Tag("PLG/Dashboards")<
  Dashboards,
  {
    /** List all dashboards */
    readonly list: () => Effect.Effect<
      ReadonlyArray<DashboardSummary>,
      DashboardError
    >

    /** Get insights for a dashboard */
    readonly getInsights: (
      dashboardId: DashboardId,
    ) => Effect.Effect<ReadonlyArray<InsightConfig>, DashboardError>
  }
>() {}
```

---

## 6. Provider Implementations

### 6.1 Provider Structure

Each provider package implements one or more abstract PLG services as Effect Layers.

```
@plg/posthog/
├── src/
│   ├── analytics.ts        # PostHogAnalytics Layer (implements PLG.Analytics)
│   ├── feature-flags.ts    # PostHogFeatureFlags Layer (implements PLG.FeatureFlags)
│   ├── experiments.ts       # PostHogExperiments Layer (implements PLG.Experiments)
│   ├── surveys.ts           # PostHogSurveys Layer (implements PLG.Surveys)
│   ├── dashboards.ts        # PostHogDashboards Layer (implements PLG.Dashboards)
│   └── index.ts             # Composed layer + exports
├── iac/
│   ├── feature-flags.ts     # IaC resource definitions
│   ├── dashboards.ts
│   ├── experiments.ts
│   ├── surveys.ts
│   ├── cohorts.ts
│   ├── actions.ts
│   ├── insights.ts
│   └── index.ts             # Composed IaC providers
└── registry.json            # ShadCN registry definition
```

### 6.2 PostHog Provider Example

```typescript
// @plg/posthog/src/analytics.ts

import { Layer, Effect, pipe } from "effect"
import { Analytics, type DistinctId, type EventName } from "@plg/core"
import * as PostHog from "@packages/posthog"

/** PostHog implementation of PLG.Analytics */
export const PostHogAnalyticsLive = Layer.effect(
  Analytics,
  Effect.gen(function* () {
    // Access PostHog SDK credentials from context
    const creds = yield* PostHog.Credentials
    const endpoint = yield* PostHog.Endpoint

    return {
      track: (distinctId, event, properties) =>
        PostHog.Events.captureEvent(
          new PostHog.Events.CaptureEventRequest({
            distinct_id: distinctId,
            event,
            properties: properties ?? {},
          })
        ).pipe(
          Effect.mapError((e) => new TrackingError({ event, cause: e }))
        ),

      identify: (distinctId, traits) =>
        PostHog.Persons.updatePerson(
          new PostHog.Persons.UpdatePersonRequest({
            distinct_id: distinctId,
            properties: traits,
          })
        ).pipe(
          Effect.mapError((e) => new AnalyticsError({ message: "identify failed", cause: e })),
          Effect.asVoid
        ),

      group: (distinctId, groupType, groupId, traits) =>
        PostHog.Events.captureEvent(
          new PostHog.Events.CaptureEventRequest({
            distinct_id: distinctId,
            event: "$groupidentify",
            properties: {
              $group_type: groupType,
              $group_key: groupId,
              $group_set: traits ?? {},
            },
          })
        ).pipe(
          Effect.mapError((e) => new AnalyticsError({ message: "group failed", cause: e })),
          Effect.asVoid
        ),

      alias: (distinctId, alias) =>
        PostHog.Events.captureEvent(
          new PostHog.Events.CaptureEventRequest({
            distinct_id: distinctId,
            event: "$create_alias",
            properties: { alias },
          })
        ).pipe(
          Effect.mapError((e) => new AnalyticsError({ message: "alias failed", cause: e })),
          Effect.asVoid
        ),

      flush: () => Effect.void,
    }
  })
)
```

### 6.3 Attio Provider Example

```typescript
// @plg/attio/src/customers.ts

import { Layer, Effect } from "effect"
import { Customers, type CustomerId, type LifecycleStage } from "@plg/core"
import * as Attio from "@packages/attio"
import { AttioAttributes } from "@packages/plg/attio"

/** Attio implementation of PLG.Customers */
export const AttioCustomersLive = Layer.effect(
  Customers,
  Effect.gen(function* () {
    return {
      get: (id) =>
        Attio.Records.getRecord(
          new Attio.Records.GetRecordRequest({
            object: "companies",
            record_id: id,
          })
        ).pipe(
          Effect.map((r) => ({
            id: r.id.record_id as CustomerId,
            name: r.values?.["name"]?.[0]?.value as string | undefined,
            // ... map remaining fields
          })),
          Effect.mapError((e) => new CustomerError({ customerId: id, cause: e }))
        ),

      setLifecycleStage: (id, stage) =>
        Attio.Records.updateRecord(
          new Attio.Records.UpdateRecordRequest({
            object: "companies",
            record_id: id,
            data: { [AttioAttributes.LIFECYCLE_STAGE]: stage },
          })
        ).pipe(
          Effect.mapError((e) => new CustomerError({ customerId: id, cause: e })),
          Effect.asVoid,
        ),

      setMrr: (id, mrrCents) =>
        Attio.Records.updateRecord(
          new Attio.Records.UpdateRecordRequest({
            object: "companies",
            record_id: id,
            data: { [AttioAttributes.MRR]: mrrCents },
          })
        ).pipe(
          Effect.mapError((e) => new CustomerError({ customerId: id, cause: e })),
          Effect.asVoid,
        ),

      // ... remaining methods
    }
  })
)
```

### 6.4 Provider Composition

```typescript
// @plg/posthog/src/index.ts

import { Layer } from "effect"
import { PostHogAnalyticsLive } from "./analytics.js"
import { PostHogFeatureFlagsLive } from "./feature-flags.js"
import { PostHogExperimentsLive } from "./experiments.js"
import { PostHogSurveysLive } from "./surveys.js"
import { PostHogDashboardsLive } from "./dashboards.js"

/** All PLG services provided by PostHog */
export const PostHogPLGLive = Layer.mergeAll(
  PostHogAnalyticsLive,
  PostHogFeatureFlagsLive,
  PostHogExperimentsLive,
  PostHogSurveysLive,
  PostHogDashboardsLive,
)

// Re-export individual layers for selective composition
export {
  PostHogAnalyticsLive,
  PostHogFeatureFlagsLive,
  PostHogExperimentsLive,
  PostHogSurveysLive,
  PostHogDashboardsLive,
}
```

---

## 7. PLG Stack Composition

### 7.1 Consumer Usage

```typescript
// app/plg.ts — Consumer's PLG stack definition

import { Layer, Effect } from "effect"
import { Analytics, FeatureFlags, Customers, Surveys, Experiments } from "@plg/core"
import { PostHogPLGLive } from "@plg/posthog"
import { AttioCustomersLive } from "@plg/attio"
import * as PostHog from "@packages/posthog"
import * as Attio from "@packages/attio"

// Compose the PLG stack from chosen providers
const PlgStack = Layer.mergeAll(
  PostHogPLGLive,        // Analytics + Flags + Experiments + Surveys + Dashboards
  AttioCustomersLive,    // Customers (CRM)
).pipe(
  // Provide SDK credentials
  Layer.provideMerge(PostHog.Credentials.fromEnv()),
  Layer.provideMerge(Layer.succeed(PostHog.Endpoint, PostHog.Endpoint.DEFAULT)),
  Layer.provideMerge(Attio.Credentials.fromEnv()),
  Layer.provideMerge(Layer.succeed(Attio.Endpoint, Attio.Endpoint.DEFAULT)),
  // Provide HTTP client
  Layer.provideMerge(FetchHttpClient.layer),
)

// Use in application — branded types enforced via Schema.decode at boundaries
const program = Effect.gen(function* () {
  const analytics = yield* Analytics
  const flags = yield* FeatureFlags
  const customers = yield* Customers

  // Decode branded values from external input at system boundaries
  const distinctId = yield* Schema.decode(DistinctId)("user-123")
  const eventName = yield* Schema.decode(EventName)("signup_completed")
  const flagKey = yield* Schema.decode(FlagKey)("new_onboarding")
  const customerId = yield* Schema.decode(CustomerId)("company-456")
  const lifecycleStage = yield* Schema.decode(LifecycleStage)("active")
  const mrr = yield* Schema.decode(MrrCents)(4900)

  // Track an event — all parameters are branded, no raw strings accepted
  yield* analytics.track(distinctId, eventName, { method: "google" })

  // Check a feature flag
  const showNewOnboarding = yield* flags.isEnabled(flagKey, distinctId)

  // Update CRM — MrrCents prevents passing a HealthScore here
  yield* customers.setLifecycleStage(customerId, lifecycleStage)
  yield* customers.setMrr(customerId, mrr)
})

program.pipe(Effect.provide(PlgStack), Effect.runPromise)
```

### 7.2 Type-Safe Event Definitions

Consumers define their event catalog as schemas:

```typescript
// app/plg-events.ts

import { Schema } from "effect"
import { EventName, EventProperties } from "@plg/core"

// Define event catalog with typed payloads
const SignupCompleted = Schema.Struct({
  event: Schema.Literal("signup_completed"),
  properties: Schema.Struct({
    method: Schema.Literal("email", "google", "github"),
    referrer: Schema.optional(Schema.String),
  }),
})

const FeatureUsed = Schema.Struct({
  event: Schema.Literal("feature_used"),
  properties: Schema.Struct({
    feature: Schema.String,
    context: Schema.optional(Schema.String),
  }),
})

const PlanUpgraded = Schema.Struct({
  event: Schema.Literal("plan_upgraded"),
  properties: Schema.Struct({
    fromPlan: Schema.String,
    toPlan: Schema.String,
    mrrDelta: Schema.Number,
  }),
})

// Union of all events for exhaustive matching
const PlgEvent = Schema.Union(SignupCompleted, FeatureUsed, PlanUpgraded)
type PlgEvent = typeof PlgEvent.Type
```

---

## 8. IaC Integration

The IaC layer is a **first-class part of the registry**. When a consumer selects providers (PostHog, Attio), the registry also brings in the alchemy-effect resource definitions needed to configure those providers — feature flags, experiments, dashboards, CRM attributes, etc. — as infrastructure-as-code.

This means a consumer doesn't manually create PostHog feature flags in the UI or Attio attributes by hand. The IaC stack declares the desired state, and `alchemy-effect` converges the providers to match.

### 8.1 How IaC Fits the Registry Model

Each runtime provider has a **companion IaC registry item**:

| Runtime Provider | IaC Companion | What It Provisions |
|---|---|---|
| `@plg/posthog` | `@plg/posthog-iac` | Feature flags, experiments, surveys, dashboards, insights, actions, cohorts |
| `@plg/attio` | `@plg/attio-iac` | Objects, attributes, select options, statuses, webhooks |

The **stack presets** (`@plg/stack-full`, etc.) pull in both runtime and IaC items via `registryDependencies`, so `npx shadcn add @plg/stack-full` gives you everything — runtime layers, IaC resource definitions, and a ready-to-run stack file.

If a consumer only wants the runtime SDK (they already manage infrastructure manually or via another tool), they install just `@plg/posthog` without `@plg/posthog-iac`. The IaC is opt-in but included by default in stack presets.

### 8.2 IaC Resource Mapping

Each abstract PLG capability maps to concrete IaC resources per provider:

| PLG Service | PostHog IaC Resources | Attio IaC Resources |
|---|---|---|
| Analytics | Action, Cohort | — |
| FeatureFlags | FeatureFlag | — |
| Experiments | Experiment | — |
| Surveys | Survey | — |
| Dashboards | Dashboard, Insight | — |
| Customers | — | Object, Attribute, SelectOption, Status, Webhook |

### 8.3 IaC Registry Items

```json
{
  "name": "posthog-iac",
  "type": "registry:lib",
  "title": "PostHog IaC Resources",
  "description": "Alchemy-effect resource definitions for PostHog (feature flags, experiments, surveys, dashboards, actions, cohorts, insights)",
  "dependencies": ["effect", "@effect/platform", "@packages/alchemy-posthog", "alchemy-effect"],
  "registryDependencies": ["@plg/core"],
  "files": [
    { "path": "lib/plg/iac/posthog/feature-flag.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/experiment.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/survey.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/dashboard.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/insight.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/action.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/cohort.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/providers.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/posthog/index.ts", "type": "registry:lib" }
  ],
  "envVars": {
    "POSTHOG_API_KEY": "your-posthog-api-key",
    "POSTHOG_PROJECT_ID": "your-posthog-project-id"
  }
}
```

```json
{
  "name": "attio-iac",
  "type": "registry:lib",
  "title": "Attio IaC Resources",
  "description": "Alchemy-effect resource definitions for Attio (objects, attributes, select options, statuses, webhooks)",
  "dependencies": ["effect", "@effect/platform", "@packages/alchemy-attio", "alchemy-effect"],
  "registryDependencies": ["@plg/core"],
  "files": [
    { "path": "lib/plg/iac/attio/attribute.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/attio/select-option.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/attio/status.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/attio/webhook.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/attio/providers.ts", "type": "registry:lib" },
    { "path": "lib/plg/iac/attio/index.ts", "type": "registry:lib" }
  ],
  "envVars": {
    "ATTIO_API_KEY": "your-attio-api-key"
  }
}
```

### 8.4 IaC Resource Definitions (PostHog Example)

Each IaC file defines alchemy-effect resources that use the shared branded types and constants from `@plg/core`:

```typescript
// lib/plg/iac/posthog/feature-flag.ts

import { Resource } from "alchemy-effect"
import { Schema } from "effect"
import { FlagKey, RolloutPercentage, VariantKey, CohortId } from "@/lib/plg/brands"

/** PostHog Feature Flag — IaC resource definition */
export const FeatureFlag = Resource.define("PostHog/FeatureFlag", {
  props: Schema.Struct({
    key: FlagKey,
    name: Schema.String.pipe(Schema.minLength(1)),
    active: Schema.Boolean,
    rolloutPercentage: Schema.optional(RolloutPercentage),
    filters: Schema.optional(Schema.Struct({
      groups: Schema.Array(Schema.Struct({
        properties: Schema.optional(Schema.Array(Schema.Unknown)),
        rolloutPercentage: Schema.optional(RolloutPercentage),
      })),
      multivariate: Schema.optional(Schema.Struct({
        variants: Schema.NonEmptyArray(Schema.Struct({
          key: VariantKey,
          rolloutPercentage: RolloutPercentage,
        })),
      })),
    })),
    tags: Schema.optional(Schema.Array(Schema.String)),
  }),
  attrs: Schema.Struct({
    id: Schema.Number.pipe(Schema.int(), Schema.positive()),
    key: FlagKey,
    created_at: Schema.String,
  }),
})
```

```typescript
// lib/plg/iac/posthog/providers.ts — Composed IaC provider layer

import { Layer } from "effect"
import * as PostHog from "@packages/alchemy-posthog"

/** All PostHog IaC providers composed into a single layer */
export const PostHogIaCProviders = Layer.mergeAll(
  PostHog.FeatureFlagProvider,
  PostHog.ExperimentProvider,
  PostHog.SurveyProvider,
  PostHog.DashboardProvider,
  PostHog.InsightProvider,
  PostHog.ActionProvider,
  PostHog.CohortProvider,
)
```

### 8.5 IaC Stack Definition (Brought In by Registry)

The `@plg/stack-full` registry item includes a `plg-stack.run.ts` file that wires IaC resources to the selected providers. This is the file consumers run to converge infrastructure:

```typescript
// plg-stack.run.ts — Brought in by @plg/stack-full registry item

import { defineStack, defineStages } from "alchemy-effect"
import { Effect, Config, Layer, Schema } from "effect"
import { PostHogIaCProviders } from "@/lib/plg/iac/posthog"
import { AttioIaCProviders } from "@/lib/plg/iac/attio"
import { FeatureFlag } from "@/lib/plg/iac/posthog/feature-flag"
import { Experiment } from "@/lib/plg/iac/posthog/experiment"
import { Action } from "@/lib/plg/iac/posthog/action"
import { Dashboard } from "@/lib/plg/iac/posthog/dashboard"
import { Insight } from "@/lib/plg/iac/posthog/insight"
import { Survey } from "@/lib/plg/iac/posthog/survey"
import { Attribute } from "@/lib/plg/iac/attio/attribute"
import { SelectOption } from "@/lib/plg/iac/attio/select-option"
import {
  FlagKey, ExperimentKey, VariantKey, GoalMetric, RolloutPercentage,
  EventName, SurveyId, AttributeSlug, LifecycleStage
} from "@/lib/plg/brands"

// --- Stages: configure credentials per provider ---

const stages = defineStages(
  Effect.fn(function* () {
    return {
      posthog: {
        apiKey: yield* Config.string("POSTHOG_API_KEY"),
        projectId: yield* Config.string("POSTHOG_PROJECT_ID"),
      },
      attio: {
        apiKey: yield* Config.string("ATTIO_API_KEY"),
      },
    }
  })
)

// --- PostHog Resources ---
// All resource props use branded types — invalid values fail at decode time

const SignupAction = new Action("SignupCompleted", {
  name: "Signup Completed",
  steps: [{ event: "signup_completed" as EventName }],
  tags: ["managed-by-iac"],
})

const ActivationAction = new Action("Activation", {
  name: "Activation",
  steps: [{ event: "activation" as EventName }],
  tags: ["managed-by-iac"],
})

const NewOnboardingFlag = new FeatureFlag("NewOnboarding", {
  key: "new_onboarding" as FlagKey,
  name: "New Onboarding Flow",
  active: true,
  rolloutPercentage: 50 as RolloutPercentage,
  tags: ["managed-by-iac"],
})

const NewOnboardingExperiment = new Experiment("NewOnboardingExperiment", {
  key: "new_onboarding_experiment" as ExperimentKey,
  name: "New Onboarding A/B Test",
  featureFlagKey: "new_onboarding" as FlagKey,
  variants: ["control" as VariantKey, "test" as VariantKey],
  goalMetrics: ["activation_rate" as GoalMetric, "7_day_retention" as GoalMetric],
  tags: ["managed-by-iac"],
})

const NpsSurvey = new Survey("NpsSurvey", {
  name: "NPS Survey",
  type: "popover",
  questions: [{ type: "rating", question: "How likely are you to recommend us?", scale: 10 }],
  targetingFlagKey: "nps_survey_targeting" as FlagKey,
  tags: ["managed-by-iac"],
})

const PlgDashboard = new Dashboard("PLGDashboard", {
  name: "PLG Overview",
  description: "Key product-led growth metrics",
  tags: ["managed-by-iac"],
})

const SignupFunnel = new Insight("SignupFunnel", {
  name: "Signup → Activation Funnel",
  type: "funnel",
  query: {
    series: [
      { event: "signup_completed" },
      { event: "activation" },
    ],
  },
  dashboardId: PlgDashboard,  // Input<Dashboard> cross-reference
  tags: ["managed-by-iac"],
})

// --- Attio Resources ---

const LifecycleStageAttr = new Attribute("LifecycleStage", {
  target: "objects",
  identifier: "companies",
  title: "Lifecycle Stage",
  apiSlug: "lifecycle_stage" as AttributeSlug,
  type: "select",
})

const MrrAttr = new Attribute("MRR", {
  target: "objects",
  identifier: "companies",
  title: "Monthly Recurring Revenue",
  apiSlug: "mrr" as AttributeSlug,
  type: "number",
})

const HealthScoreAttr = new Attribute("HealthScore", {
  target: "objects",
  identifier: "companies",
  title: "Health Score",
  apiSlug: "health_score" as AttributeSlug,
  type: "number",
})

const PqlAttr = new Attribute("IsPQL", {
  target: "objects",
  identifier: "companies",
  title: "Product Qualified Lead",
  apiSlug: "is_pql" as AttributeSlug,
  type: "checkbox",
})

// Lifecycle stage select options — each value matches the LifecycleStage branded type
const lifecycleStages = [
  "lead", "trial", "activated", "pql", "customer", "expanding", "at_risk", "churned"
] as const

const lifecycleOptions = lifecycleStages.map(
  (stage) => new SelectOption(`LifecycleStage_${stage}`, {
    attribute: LifecycleStageAttr,  // Input<Attribute> cross-reference
    title: stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: stage,
  })
)

// --- Compose Stack ---

const stack = defineStack({
  name: "plg-stack",
  stages,
  resources: [
    // PostHog
    SignupAction,
    ActivationAction,
    NewOnboardingFlag,
    NewOnboardingExperiment,
    NpsSurvey,
    PlgDashboard,
    SignupFunnel,
    // Attio
    LifecycleStageAttr,
    MrrAttr,
    HealthScoreAttr,
    PqlAttr,
    ...lifecycleOptions,
  ],
  providers: Layer.mergeAll(
    PostHogIaCProviders,
    AttioIaCProviders,
  ),
})

export default stack
```

### 8.6 Consumer IaC Workflow

After `npx shadcn add @plg/stack-full`, the consumer has:

```
your-project/
├── lib/plg/
│   ├── brands/                          # Branded types
│   ├── analytics.ts                     # Abstract services
│   ├── providers/
│   │   ├── posthog/                     # Runtime layers
│   │   └── attio/
│   └── iac/
│       ├── posthog/                     # PostHog IaC resource definitions
│       │   ├── feature-flag.ts
│       │   ├── experiment.ts
│       │   ├── survey.ts
│       │   ├── dashboard.ts
│       │   ├── insight.ts
│       │   ├── action.ts
│       │   ├── cohort.ts
│       │   ├── providers.ts             # Composed PostHog IaC layer
│       │   └── index.ts
│       └── attio/                       # Attio IaC resource definitions
│           ├── attribute.ts
│           ├── select-option.ts
│           ├── status.ts
│           ├── webhook.ts
│           ├── providers.ts             # Composed Attio IaC layer
│           └── index.ts
├── plg-stack.run.ts                     # IaC stack — run to converge infrastructure
└── app/plg.ts                           # Runtime stack composition
```

Running the IaC stack:

```bash
# Deploy all PLG infrastructure (feature flags, experiments, dashboards, CRM attributes, etc.)
bun run plg-stack.run.ts

# The stack is idempotent — running again only applies diffs
bun run plg-stack.run.ts
```

This creates/updates:
- PostHog feature flags, experiments, surveys, dashboards, insights, actions, cohorts
- Attio custom attributes, select options, statuses, webhooks

The IaC resources use the same branded constants as the runtime code, so the feature flag key `"new_onboarding"` in the IaC stack is the same `FlagKey` brand used by `flags.isEnabled(flagKey, distinctId)` at runtime. Single source of truth.

---

## 9. ShadCN Registry Distribution

### 9.1 Registry Structure

```
@plg/ (registry namespace)
├── core                    # Abstract services + branded types + constants
├── posthog                 # PostHog runtime layers (Analytics, Flags, Experiments, Surveys, Dashboards)
├── posthog-iac             # PostHog IaC resource definitions (alchemy-effect)
├── attio                   # Attio runtime layers (Customers)
├── attio-iac               # Attio IaC resource definitions (alchemy-effect)
├── stack-minimal           # Minimal: core + posthog runtime (no IaC)
├── stack-growth            # Growth: core + posthog + posthog-iac + attio + attio-iac + stack file
├── stack-full              # Full: everything + automations + stack file
└── stack-enterprise        # Enterprise: multi-provider with fallback layers
```

The dependency graph:

```
stack-full
├── @plg/core
├── @plg/posthog        → @plg/core
├── @plg/posthog-iac    → @plg/core
├── @plg/attio          → @plg/core
├── @plg/attio-iac      → @plg/core
└── plg-stack.run.ts    (IaC orchestrator)
    └── lib/plg/stack.ts (runtime composition)
```

### 9.2 Registry Definition

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "@plg",
  "homepage": "https://github.com/your-org/plg-registry",
  "items": [
    {
      "name": "core",
      "type": "registry:lib",
      "title": "PLG Core Services",
      "description": "Abstract PLG service definitions (Analytics, FeatureFlags, Experiments, Surveys, Customers, Dashboards)",
      "dependencies": ["effect", "@effect/platform"],
      "files": [
        { "path": "lib/plg/brands/identity.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/events.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/flags.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/experiments.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/surveys.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/customers.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/dashboards.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/credentials.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/iac.ts", "type": "registry:lib" },
        { "path": "lib/plg/brands/index.ts", "type": "registry:lib" },
        { "path": "lib/plg/analytics.ts", "type": "registry:lib" },
        { "path": "lib/plg/feature-flags.ts", "type": "registry:lib" },
        { "path": "lib/plg/experiments.ts", "type": "registry:lib" },
        { "path": "lib/plg/surveys.ts", "type": "registry:lib" },
        { "path": "lib/plg/customers.ts", "type": "registry:lib" },
        { "path": "lib/plg/dashboards.ts", "type": "registry:lib" },
        { "path": "lib/plg/constants.ts", "type": "registry:lib" },
        { "path": "lib/plg/index.ts", "type": "registry:lib" }
      ]
    },
    {
      "name": "posthog",
      "type": "registry:lib",
      "title": "PostHog PLG Provider",
      "description": "PostHog implementation of Analytics, FeatureFlags, Experiments, Surveys, Dashboards",
      "dependencies": ["effect", "@effect/platform", "@packages/posthog"],
      "registryDependencies": ["@plg/core"],
      "files": [
        { "path": "lib/plg/providers/posthog/analytics.ts", "type": "registry:lib" },
        { "path": "lib/plg/providers/posthog/feature-flags.ts", "type": "registry:lib" },
        { "path": "lib/plg/providers/posthog/experiments.ts", "type": "registry:lib" },
        { "path": "lib/plg/providers/posthog/surveys.ts", "type": "registry:lib" },
        { "path": "lib/plg/providers/posthog/dashboards.ts", "type": "registry:lib" },
        { "path": "lib/plg/providers/posthog/index.ts", "type": "registry:lib" }
      ],
      "envVars": {
        "POSTHOG_API_KEY": "your-posthog-api-key"
      }
    },
    {
      "name": "attio",
      "type": "registry:lib",
      "title": "Attio PLG Provider",
      "description": "Attio implementation of Customers CRM service",
      "dependencies": ["effect", "@effect/platform", "@packages/attio"],
      "registryDependencies": ["@plg/core"],
      "files": [
        { "path": "lib/plg/providers/attio/customers.ts", "type": "registry:lib" },
        { "path": "lib/plg/providers/attio/index.ts", "type": "registry:lib" }
      ],
      "envVars": {
        "ATTIO_API_KEY": "your-attio-api-key"
      }
    },
    {
      "name": "posthog-iac",
      "type": "registry:lib",
      "title": "PostHog IaC Resources",
      "description": "Alchemy-effect resource definitions for PostHog infrastructure (feature flags, experiments, surveys, dashboards, insights, actions, cohorts)",
      "dependencies": ["effect", "@effect/platform", "@packages/alchemy-posthog", "alchemy-effect"],
      "registryDependencies": ["@plg/core"],
      "files": [
        { "path": "lib/plg/iac/posthog/feature-flag.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/experiment.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/survey.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/dashboard.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/insight.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/action.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/cohort.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/providers.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/posthog/index.ts", "type": "registry:lib" }
      ],
      "envVars": {
        "POSTHOG_API_KEY": "your-posthog-api-key",
        "POSTHOG_PROJECT_ID": "your-posthog-project-id"
      }
    },
    {
      "name": "attio-iac",
      "type": "registry:lib",
      "title": "Attio IaC Resources",
      "description": "Alchemy-effect resource definitions for Attio infrastructure (objects, attributes, select options, statuses, webhooks)",
      "dependencies": ["effect", "@effect/platform", "@packages/alchemy-attio", "alchemy-effect"],
      "registryDependencies": ["@plg/core"],
      "files": [
        { "path": "lib/plg/iac/attio/attribute.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/attio/select-option.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/attio/status.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/attio/webhook.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/attio/providers.ts", "type": "registry:lib" },
        { "path": "lib/plg/iac/attio/index.ts", "type": "registry:lib" }
      ],
      "envVars": {
        "ATTIO_API_KEY": "your-attio-api-key"
      }
    },
    {
      "name": "stack-minimal",
      "type": "registry:lib",
      "title": "Minimal PLG Stack",
      "description": "Analytics + feature flags only (PostHog runtime, no IaC)",
      "registryDependencies": ["@plg/core", "@plg/posthog"],
      "files": [
        { "path": "lib/plg/stack.ts", "type": "registry:lib" }
      ]
    },
    {
      "name": "stack-full",
      "type": "registry:lib",
      "title": "Full PLG Stack",
      "description": "Complete PLG stack: PostHog + Attio runtime layers AND IaC resource definitions with ready-to-run stack file",
      "dependencies": ["alchemy-effect"],
      "registryDependencies": [
        "@plg/core",
        "@plg/posthog",
        "@plg/posthog-iac",
        "@plg/attio",
        "@plg/attio-iac"
      ],
      "files": [
        { "path": "lib/plg/stack.ts", "type": "registry:lib" },
        { "path": "plg-stack.run.ts", "type": "registry:file", "target": "~/plg-stack.run.ts" }
      ],
      "envVars": {
        "POSTHOG_API_KEY": "your-posthog-api-key",
        "POSTHOG_PROJECT_ID": "your-posthog-project-id",
        "ATTIO_API_KEY": "your-attio-api-key"
      }
    }
  ]
}
```

### 9.3 Consumer Registry Configuration

```json
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "registries": {
    "@plg": "https://plg-registry.example.com/r/{name}.json"
  },
  "aliases": {
    "lib": "@/lib"
  }
}
```

### 9.4 Consumer Installation

```bash
# === Option A: Full stack (runtime + IaC for all providers) ===
# One command — pulls in core, posthog, posthog-iac, attio, attio-iac, stack file
npx shadcn add @plg/stack-full

# Set env vars, then deploy infrastructure:
bun run plg-stack.run.ts

# === Option B: Pick and choose ===

# Just the abstractions (branded types, service interfaces)
npx shadcn add @plg/core

# PostHog runtime only (no IaC — you manage PostHog config manually)
npx shadcn add @plg/posthog

# PostHog runtime + IaC (creates feature flags, experiments, etc. via alchemy-effect)
npx shadcn add @plg/posthog @plg/posthog-iac

# Attio runtime + IaC
npx shadcn add @plg/attio @plg/attio-iac

# === Option C: Minimal (just analytics + flags, no CRM, no IaC) ===
npx shadcn add @plg/stack-minimal
```

---

## 10. Plugin System Architecture

### 10.1 Provider Registration

Providers register their capabilities via a type-level plugin system:

```typescript
// @plg/core/src/plugin.ts

import { Context, Layer } from "effect"

/** Capability tags that providers can implement */
export type PLGCapability =
  | typeof Analytics
  | typeof FeatureFlags
  | typeof Experiments
  | typeof Surveys
  | typeof Customers
  | typeof Dashboards

/** Type-level registry of what a provider implements */
export interface ProviderManifest {
  readonly name: string
  readonly capabilities: ReadonlyArray<PLGCapability>
  readonly layer: Layer.Layer<any, any, any>
}

/** Validate that a stack covers all required capabilities */
export type ValidateStack<
  Required extends PLGCapability,
  Provided extends Layer.Layer<any, any, any>
> = Layer.Layer.Success<Provided> extends Context.Tag.Identifier<Required>
  ? true
  : `Missing provider for: ${Required["key"]}`
```

### 10.2 Stack Presets

Pre-composed stacks for common configurations:

```typescript
// @plg/core/src/presets.ts

/** Minimal stack: just analytics and feature flags */
export const MinimalStack = <P extends Layer.Layer<Analytics | FeatureFlags, any, any>>(
  provider: P
) => provider

/** Growth stack: analytics + flags + experiments + surveys */
export const GrowthStack = <P extends Layer.Layer<
  Analytics | FeatureFlags | Experiments | Surveys,
  any,
  any
>>(provider: P) => provider

/** Full stack: all PLG capabilities */
export const FullStack = <P extends Layer.Layer<
  Analytics | FeatureFlags | Experiments | Surveys | Customers | Dashboards,
  any,
  any
>>(provider: P) => provider
```

---

## 11. Cross-System Automations

### 11.1 Automation Service

```typescript
// @plg/core/src/automations.ts

import { Context, Effect, Data, Schema } from "effect"
import {
  DistinctId, CustomerId, MrrCents, LifecycleStage
} from "./brands/index.js"

/** Signup method — branded literal */
const SignupMethod = Schema.Literal("email", "google", "github", "saml").pipe(
  Schema.brand("SignupMethod")
)
type SignupMethod = typeof SignupMethod.Type

/** Plan identifier — branded string */
const PlanId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,49}$/),
  Schema.brand("PlanId")
)
type PlanId = typeof PlanId.Type

class Automations extends Context.Tag("PLG/Automations")<
  Automations,
  {
    /** Handle signup completion across all systems */
    readonly onSignupCompleted: (params: {
      readonly distinctId: DistinctId
      readonly customerId: CustomerId
      readonly method: SignupMethod
    }) => Effect.Effect<void, AnalyticsError | CustomerError>

    /** Handle user activation */
    readonly onActivation: (params: {
      readonly distinctId: DistinctId
      readonly customerId: CustomerId
    }) => Effect.Effect<void, AnalyticsError | CustomerError>

    /** Handle plan upgrade */
    readonly onUpgrade: (params: {
      readonly distinctId: DistinctId
      readonly customerId: CustomerId
      readonly fromPlan: PlanId
      readonly toPlan: PlanId
      readonly mrrDelta: MrrCents
    }) => Effect.Effect<void, AnalyticsError | CustomerError>

    /** Handle churn signal detection */
    readonly onChurnSignal: (params: {
      readonly customerId: CustomerId
    }) => Effect.Effect<void, CustomerError>
  }
>() {}
```

### 11.2 Default Automation Layer

```typescript
// @plg/core/src/automations-live.ts

export const AutomationsLive = Layer.effect(
  Automations,
  Effect.gen(function* () {
    const analytics = yield* Analytics
    const customers = yield* Customers

    return {
      onSignupCompleted: ({ distinctId, customerId, method }) =>
        Effect.gen(function* () {
          // Branded event names and lifecycle stages — decoded once, type-safe throughout
          const event = yield* Schema.decode(EventName)("signup_completed")
          const stage = yield* Schema.decode(LifecycleStage)("trial")
          yield* Effect.all([
            analytics.track(distinctId, event, { method }),
            customers.setLifecycleStage(customerId, stage),
          ])
        }).pipe(Effect.asVoid),

      onActivation: ({ distinctId, customerId }) =>
        Effect.gen(function* () {
          const event = yield* Schema.decode(EventName)("activation")
          const stage = yield* Schema.decode(LifecycleStage)("activated")
          yield* Effect.all([
            analytics.track(distinctId, event),
            customers.setLifecycleStage(customerId, stage),
          ])
        }).pipe(Effect.asVoid),

      onUpgrade: ({ distinctId, customerId, fromPlan, toPlan, mrrDelta }) =>
        Effect.gen(function* () {
          const event = yield* Schema.decode(EventName)("plan_upgraded")
          const stage = yield* Schema.decode(LifecycleStage)("expanding")
          yield* Effect.all([
            analytics.track(distinctId, event, { fromPlan, toPlan, mrrDelta }),
            customers.setLifecycleStage(customerId, stage),
            customers.setMrr(customerId, mrrDelta),
          ])
        }).pipe(Effect.asVoid),

      onChurnSignal: ({ customerId }) =>
        Effect.gen(function* () {
          const stage = yield* Schema.decode(LifecycleStage)("at_risk")
          yield* customers.setLifecycleStage(customerId, stage)
        }),
    }
  })
)
```

---

## 12. Package Structure

### 12.1 Monorepo Layout

```
packages/
├── plg-core/                   # @plg/core — Abstract services
│   ├── src/
│   │   ├── brands/             # Branded type taxonomy (Section 4)
│   │   │   ├── identity.ts     # DistinctId, CustomerId, GroupId, GroupType, UserEmail
│   │   │   ├── events.ts       # EventName, EventProperties, UserTraits, ActionId
│   │   │   ├── flags.ts        # FlagKey, FlagValue, RolloutPercentage
│   │   │   ├── experiments.ts  # ExperimentKey, VariantKey, GoalMetric, SampleSize
│   │   │   ├── surveys.ts      # SurveyId, QuestionText, NpsScore, CsatScore
│   │   │   ├── customers.ts    # MrrCents, HealthScore, LifecycleStage, DealValueCents
│   │   │   ├── dashboards.ts   # DashboardId, InsightId, InsightType, CohortId
│   │   │   ├── credentials.ts  # PostHogApiKey, AttioApiKey, ApiEndpointUrl
│   │   │   ├── iac.ts          # ResourceId, StackName, IaCTag
│   │   │   └── index.ts        # Re-exports all brands
│   │   ├── analytics.ts
│   │   ├── feature-flags.ts
│   │   ├── experiments.ts
│   │   ├── surveys.ts
│   │   ├── customers.ts
│   │   ├── dashboards.ts
│   │   ├── automations.ts
│   │   ├── automations-live.ts
│   │   ├── plugin.ts
│   │   ├── presets.ts
│   │   ├── constants/
│   │   │   ├── events.ts
│   │   │   ├── feature-flags.ts
│   │   │   ├── surveys.ts
│   │   │   ├── plans.ts
│   │   │   ├── user-properties.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── test/
│   ├── registry.json
│   ├── package.json
│   └── tsconfig.json
│
├── plg-posthog/                # @plg/posthog — PostHog runtime layers
│   ├── src/
│   │   ├── analytics.ts        # PostHogAnalytics Layer
│   │   ├── feature-flags.ts    # PostHogFeatureFlags Layer
│   │   ├── experiments.ts      # PostHogExperiments Layer
│   │   ├── surveys.ts          # PostHogSurveys Layer
│   │   ├── dashboards.ts       # PostHogDashboards Layer
│   │   └── index.ts            # Composed PostHogPLGLive Layer
│   ├── test/
│   ├── registry.json
│   ├── package.json
│   └── tsconfig.json
│
├── plg-posthog-iac/            # @plg/posthog-iac — PostHog IaC resources
│   ├── src/
│   │   ├── feature-flag.ts     # FeatureFlag resource definition
│   │   ├── experiment.ts       # Experiment resource definition
│   │   ├── survey.ts           # Survey resource definition
│   │   ├── dashboard.ts        # Dashboard resource definition
│   │   ├── insight.ts          # Insight resource definition
│   │   ├── action.ts           # Action resource definition
│   │   ├── cohort.ts           # Cohort resource definition
│   │   ├── providers.ts        # Composed PostHogIaCProviders Layer
│   │   └── index.ts
│   ├── test/
│   ├── registry.json
│   ├── package.json
│   └── tsconfig.json
│
├── plg-attio/                  # @plg/attio — Attio runtime layers
│   ├── src/
│   │   ├── customers.ts        # AttioCustomers Layer
│   │   └── index.ts
│   ├── test/
│   ├── registry.json
│   ├── package.json
│   └── tsconfig.json
│
├── plg-attio-iac/              # @plg/attio-iac — Attio IaC resources
│   ├── src/
│   │   ├── attribute.ts        # Attribute resource definition
│   │   ├── select-option.ts    # SelectOption resource definition
│   │   ├── status.ts           # Status resource definition
│   │   ├── webhook.ts          # Webhook resource definition
│   │   ├── providers.ts        # Composed AttioIaCProviders Layer
│   │   └── index.ts
│   ├── test/
│   ├── registry.json
│   ├── package.json
│   └── tsconfig.json
│
├── plg-builder-core/              # Shared builder logic (schemas, generators, constraints)
│   ├── src/
│   │   ├── schemas/               # Effect Schema definitions (PlgBuilderConfig, items)
│   │   ├── constraints/           # Constraint DAG, guards, cascades, availability
│   │   ├── generators/            # Code generation (pure functions: config → string)
│   │   ├── presets/               # Preset configurations
│   │   ├── utils/                 # derive-keys, to-pascal-case, compose-command
│   │   └── index.ts
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── plg-cli/                       # @effect/cli builder CLI
│   ├── src/
│   │   ├── commands/              # create, list-presets, validate
│   │   ├── prompts/               # Interactive wizard prompts
│   │   └── bin.ts                 # Entry point
│   ├── package.json               # bin: { "create-plg-stack": "./src/bin.ts" }
│   └── tsconfig.json
│
└── plg-registry/                  # Registry builder
    ├── registry.json              # Root registry definition
    ├── public/r/                  # Built registry items (output of shadcn build)
    └── package.json

apps/
└── plg/                           # TanStack Start + Fumadocs app
    ├── content/docs/              # MDX documentation
    ├── src/
    │   ├── routes/
    │   │   ├── new/index.tsx      # Interactive builder page
    │   │   ├── docs/$.tsx         # Fumadocs catch-all
    │   │   └── r/$.ts             # Dynamic registry endpoint
    │   ├── components/builder/    # Builder UI components
    │   └── lib/                   # atoms, machine, source
    ├── public/r/                  # Static registry items
    ├── source.config.ts           # Fumadocs MDX config
    ├── vite.config.ts             # TanStack Start + Fumadocs MDX + Vite
    └── package.json
```

### 12.2 Dependencies

```
@plg/core
├── effect ^3.16.0
└── @effect/platform ^0.82.0

@plg/posthog                    # Runtime layers
├── @plg/core
├── @packages/posthog           # PostHog SDK client
├── effect ^3.16.0
└── @effect/platform ^0.82.0

@plg/posthog-iac                # IaC resource definitions
├── @plg/core
├── @packages/alchemy-posthog   # PostHog alchemy-effect providers
├── alchemy-effect
├── effect ^3.16.0
└── @effect/platform ^0.82.0

@plg/attio                      # Runtime layers
├── @plg/core
├── @packages/attio             # Attio SDK client
├── effect ^3.16.0
└── @effect/platform ^0.82.0

@plg/attio-iac                  # IaC resource definitions
├── @plg/core
├── @packages/alchemy-attio     # Attio alchemy-effect providers
├── alchemy-effect
├── effect ^3.16.0
└── @effect/platform ^0.82.0

@packages/plg-builder-core      # Shared builder logic
├── effect ^3.19.0
└── @effect/platform ^0.82.0

@packages/plg-cli               # CLI builder
├── @packages/plg-builder-core
├── @effect/cli
├── @effect/platform-node
├── effect ^3.19.0
└── @effect/platform ^0.82.0

apps/plg                        # Web builder + docs
├── @packages/plg-builder-core
├── @packages/ui
├── @tanstack/react-start
├── fumadocs-core, fumadocs-mdx, fumadocs-ui
├── effect-atom ^0.5.0
├── xstate ^5.0.0
├── @xstate/react ^4.0.0
├── effect ^3.19.0
└── react ^19.0.0
```

---

## 13. Future Provider Extensions

The abstract service model is designed for extension. Potential future providers:

| Provider | Implements | Notes |
|----------|-----------|-------|
| LaunchDarkly | FeatureFlags | Alternative flag provider |
| Amplitude | Analytics, Experiments | Alternative analytics/experimentation |
| Mixpanel | Analytics | Alternative analytics |
| Segment | Analytics (CDP routing) | Routes events to multiple destinations |
| GrowthBook | FeatureFlags, Experiments | Open-source alternative |
| Stripe | Customers (billing subset) | MRR tracking, subscription management |
| HubSpot | Customers | Alternative CRM |

Adding a new provider requires:
1. Create a package implementing the relevant Context.Tags as Layers
2. Optionally create alchemy-effect IaC resources
3. Add to the ShadCN registry
4. Consumers add via `npx shadcn add @plg/new-provider`

---

## 14. Testing Strategy

### 14.1 Branded Type Tests

Branded types are tested at two levels: compile-time (type errors for misuse) and runtime (Schema.decode validation).

```typescript
// test/brands.test.ts
import { describe, it, expect } from "@effect/vitest"
import { Schema, Either } from "effect"
import {
  DistinctId, CustomerId, EventName, FlagKey, MrrCents, HealthScore,
  NpsScore, RolloutPercentage, PostHogApiKey, LifecycleStage
} from "@plg/core/brands"

describe("Identity Brands", () => {
  it("DistinctId rejects empty strings", () => {
    const result = Schema.decodeUnknownEither(DistinctId)("")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("DistinctId accepts valid identifiers", () => {
    const result = Schema.decodeUnknownEither(DistinctId)("user-123")
    expect(Either.isRight(result)).toBe(true)
  })

  it("DistinctId rejects strings over 200 chars", () => {
    const result = Schema.decodeUnknownEither(DistinctId)("a".repeat(201))
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("Event Brands", () => {
  it("EventName enforces snake_case", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(EventName)("signup_completed"))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(EventName)("SignupCompleted"))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(EventName)("signup-completed"))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(EventName)(""))).toBe(true)
  })
})

describe("Numeric Brands", () => {
  it("MrrCents rejects negative values", () => {
    expect(Either.isLeft(Schema.decodeUnknownEither(MrrCents)(-100))).toBe(true)
  })

  it("MrrCents rejects fractional values", () => {
    expect(Either.isLeft(Schema.decodeUnknownEither(MrrCents)(49.99))).toBe(true)
  })

  it("HealthScore constrains to 0-100", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(HealthScore)(0))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(HealthScore)(100))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(HealthScore)(101))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(HealthScore)(-1))).toBe(true)
  })

  it("NpsScore constrains to 0-10 integers", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(NpsScore)(0))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(NpsScore)(10))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(NpsScore)(11))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(NpsScore)(5.5))).toBe(true)
  })

  it("RolloutPercentage constrains to 0-100", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(RolloutPercentage)(0))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(RolloutPercentage)(100))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(RolloutPercentage)(101))).toBe(true)
  })
})

describe("Credential Brands", () => {
  it("PostHogApiKey requires phc_ or phx_ prefix", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(PostHogApiKey)("phc_abc123"))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(PostHogApiKey)("phx_abc123"))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(PostHogApiKey)("sk_abc123"))).toBe(true)
  })
})

describe("Literal Brands", () => {
  it("LifecycleStage only accepts valid stages", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(LifecycleStage)("trial"))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(LifecycleStage)("churned"))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(LifecycleStage)("invalid"))).toBe(true)
  })
})

// === Compile-time type safety tests ===

// @ts-expect-error — DistinctId is not assignable to CustomerId
const _crossBrand: CustomerId = "user-123" as DistinctId

// @ts-expect-error — MrrCents is not assignable to HealthScore
const _numericCross: HealthScore = 50 as MrrCents

// @ts-expect-error — raw string is not assignable to EventName
const _rawString: EventName = "signup_completed"

// @ts-expect-error — raw number is not assignable to MrrCents
const _rawNumber: MrrCents = 4900
```

### 14.2 Unit Tests

Each provider layer is tested against the abstract service interface:

```typescript
// test/analytics.test.ts
import { it } from "@effect/vitest"
import { Analytics } from "@plg/core"
import { PostHogAnalyticsLive } from "@plg/posthog"

it.effect("tracks events via PostHog", () =>
  Effect.gen(function* () {
    const analytics = yield* Analytics
    // Decode branded values — validates constraints at the boundary
    const distinctId = yield* Schema.decode(DistinctId)("user-1")
    const eventName = yield* Schema.decode(EventName)("signup_completed")
    yield* analytics.track(distinctId, eventName)
  }).pipe(
    Effect.provide(
      PostHogAnalyticsLive.pipe(
        Layer.provideMerge(/* mock PostHog credentials */),
      )
    )
  )
)
```

### 14.3 Type-Level Tests

Verify stack composition completeness at compile time:

```typescript
// test/stack-types.test.ts

// This should compile — full stack provides all capabilities
const _fullStack: Layer.Layer<
  Analytics | FeatureFlags | Experiments | Surveys | Customers | Dashboards,
  any,
  any
> = Layer.mergeAll(PostHogPLGLive, AttioCustomersLive)

// @ts-expect-error — missing Customers provider
const _incomplete: Layer.Layer<
  Analytics | FeatureFlags | Customers,
  any,
  any
> = PostHogPLGLive
```

### 14.4 Integration Tests

Use alchemy-effect test harness for IaC resources:

```typescript
// test/iac/feature-flag.test.ts
import { test } from "alchemy-effect/test"

test("creates PostHog feature flag", (scope) =>
  Effect.gen(function* () {
    const flag = new PostHogIaC.FeatureFlag("test-flag", {
      key: "test-flag",
      name: "Test Flag",
      active: true,
    })
    // alchemy-effect handles lifecycle testing
  })
)
```

---

## 15. Migration Path

### 15.1 From Current @packages/plg

The existing `@packages/plg` package serves as the migration starting point:

1. **Constants** → Move to `@plg/core/constants/` (events, feature-flags, surveys, plans, user-properties, attio)
2. **SDK track/identify** → Implement as `@plg/posthog` Analytics layer
3. **SDK attio-sync** → Implement as `@plg/attio` Customers layer
4. **SDK automations** → Implement as `@plg/core` Automations service + AutomationsLive layer
5. **plg-stack.run.ts** → Distribute as `@plg/stack-full` registry item

### 15.2 Backward Compatibility

During migration, the existing `@packages/plg` package can re-export from `@plg/core`:

```typescript
// @packages/plg/src/index.ts (during migration)
export { Events, FeatureFlags, Surveys } from "@plg/core/constants"
export { Analytics, Customers } from "@plg/core"
```

---

## 16. Open Questions

1. **Event Schema Enforcement** — Should the abstract Analytics service enforce event schemas at the type level (requiring consumers to define their event catalog), or accept arbitrary string event names?

2. ~~**IaC Coupling**~~ — **Resolved.** IaC is distributed as separate companion registry items (`@plg/posthog-iac`, `@plg/attio-iac`), keeping runtime and IaC decoupled. See Section 8.

3. **Registry Hosting** — Should the ShadCN registry be hosted as a static site (GitHub Pages), a Next.js app, or via npm? The builder (Section 17) may need a dynamic backend to generate registry-item JSON from user selections.

4. **Credential Management** — Should each provider manage its own credentials, or should there be a unified PLG credential store?

5. **Real-time vs Batch** — Should the Analytics service support both real-time tracking and batch event submission?

6. **Provider Priority** — When multiple providers implement the same capability (e.g., PostHog and LaunchDarkly both provide FeatureFlags), how should conflicts be resolved? First-wins? Explicit priority? Merge?

7. **Builder Dynamic vs Static Registry** — Should the builder generate a single dynamic registry-item JSON per user configuration (served via URL with query params), or pre-build all permutations as static registry items? Dynamic is more flexible; static is simpler to host.

8. **Non-PostHog Provider Implementations** — Sections 17-20 define the builder categories and constraints for multiple providers (Amplitude, Mixpanel, LaunchDarkly, GrowthBook, etc.), but only PostHog and Attio have concrete implementations. Which providers should be prioritized next?

9. **Builder Hosting** — Should the PLG builder web app be part of the monorepo (e.g., `apps/plg-builder/`), a standalone site, or integrated into the registry's homepage?

10. **Effect Graph Stability** — The Effect `Graph` module used for constraint resolution (Section 18.1) is experimental. Should we vendor a copy, or depend directly on the Effect package and track upstream changes?

---

## 17. Interactive PLG Builder

The PLG Builder is an interactive web application (modeled after [Better T Stack](https://www.better-t-stack.dev/new)) that lets developers visually compose their PLG stack. Selections drive code generation and produce a `shadcn` CLI command for installation.

### 17.1 Builder Categories

The builder presents **11 categories** in a linear stepper flow:

| # | Category | Type | Options |
|---|----------|------|---------|
| 1 | **Analytics Provider** | Single-select | PostHog, Amplitude, Mixpanel, Segment, None |
| 2 | **Feature Flags** | Single-select | PostHog Flags, LaunchDarkly, Statsig, GrowthBook, None |
| 3 | **Experimentation** | Single-select | PostHog Experiments, Statsig, Amplitude Experiment, GrowthBook Experiments, None |
| 4 | **Surveys** | Single-select | PostHog Surveys, Typeform, Formbricks, None |
| 5 | **CRM Provider** | Single-select | Attio, HubSpot, Salesforce, None |
| 6 | **Pricing Model** | Single-select | Free, Freemium, Free Trial, Usage-Based, Seat-Based, Custom |
| 7 | **Plans** | Dynamic form | Tier names, billing intervals, trial days (conditional on Pricing Model) |
| 8 | **Events to Track** | Multi-select | 20 lifecycle events across acquisition, engagement, monetization, churn, referral, usage |
| 9 | **Feature Flags to Create** | List input | User-defined flag keys with context-sensitive suggestions |
| 10 | **IaC Provider** | Single-select | Alchemy-Effect, Terraform, Pulumi, None |
| 11 | **Distribution** | Single-select | ShadCN Registry, npm Package, Monorepo Internal |

Categories 1-5 are **provider selections** that determine which SDK/Layer code is generated. Categories 6-9 are **domain configuration** that determines the specific constants and IaC resources. Categories 10-11 are **output configuration**.

### 17.2 State Management Architecture

Builder state is managed using **XState v5** as the state machine orchestrator and **Effect** for business logic (constraint evaluation, code generation, validation). URL query parameters (via `nuqs`) serve as the **persistence and sharing layer**, synced bidirectionally with the XState machine context.

```
https://plg-stack.dev/new?analytics=posthog&flags=posthog&experiments=posthog&surveys=posthog&crm=attio&pricing=freemium&plans=free,starter,pro,enterprise&iac=alchemy&dist=shadcn
```

**Why XState + Effect (not pure Effect SubscriptionRef):**

- **XState makes impossible states impossible** — The machine definition structurally prevents invalid state transitions. A `SubscriptionRef` is a reactive primitive but provides no structural guarantees about which transitions are valid.
- **`always` transitions handle cascading constraints** — When Analytics changes from PostHog to Amplitude, eventless (`always`) transitions with guards automatically cascade: PostHog Flags resets to None, PostHog Surveys resets to None, Experimentation cascades further. This is deterministic and loop-safe.
- **Guards map 1:1 to constraint rules** — XState v5's composable `and()`, `or()`, `not()` guards directly encode H1-H11 constraints. The UI queries `state.can(event)` to disable invalid options without sending events.
- **Effect handles the heavy lifting** — Code generation, schema validation, and IaC resource planning run as Effect programs invoked via XState's `fromPromise` actor pattern (`fromPromise(() => Effect.runPromise(generateCode(config)))`).

**Architecture layers:**

```
┌─────────────────────────────────────────────────┐
│  URL (nuqs)           Persistence & sharing      │
│  ↕ sync                                          │
│  XState Machine        States, transitions,      │
│                        guards, cascades           │
│  ↕ invoke                                        │
│  Effect Programs       Constraint DAG eval,      │
│                        code generation,           │
│                        schema validation          │
│  ↕ data                                          │
│  Effect Graph          Topological sort for       │
│                        cascade ordering,          │
│                        cycle detection            │
└─────────────────────────────────────────────────┘
```

This follows the [typeonce.dev](https://typeonce.dev) pattern established by Sandro Maglione: XState for state machine orchestration, Effect for typed business logic.

### 17.3 Builder UI Flow

```
┌──────────────────────────────────────────────────────────┐
│  PLG Stack Builder                                         │
│                                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │Minimal  │ │Growth   │ │Full     │ │Enterprise│ Presets │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                            │
│  ┌─────────────────────────┐  ┌────────────────────────┐  │
│  │ Category Cards (left)   │  │ Live Summary (right)   │  │
│  │                         │  │                        │  │
│  │ [x] PostHog Analytics   │  │ Files to generate:     │  │
│  │ [x] PostHog Flags       │  │   events.ts            │  │
│  │ [x] PostHog Experiments │  │   feature-flags.ts     │  │
│  │ [x] PostHog Surveys     │  │   plans.ts             │  │
│  │ [x] Attio CRM           │  │   surveys.ts           │  │
│  │ [x] Freemium Pricing    │  │   attio.ts             │  │
│  │ ...                     │  │   sdk/track.ts         │  │
│  │                         │  │   plg-stack.run.ts     │  │
│  └─────────────────────────┘  │                        │  │
│                                │ CLI Command:           │  │
│  ┌─────────────────────────────┤                        │  │
│  │ npx shadcn add @plg/core   │ npx shadcn add ...     │  │
│  │ @plg/posthog @plg/attio    │                        │  │
│  │ @plg/posthog-iac           │                        │  │
│  │ @plg/attio-iac             │                        │  │
│  └─────────────────────────────┴────────────────────────┘  │
│                                                            │
│  [ Copy Command ]  [ Download Config ]  [ Generate ]       │
└──────────────────────────────────────────────────────────┘
```

### 17.4 Output Generation

The builder produces two artifacts:

**1. shadcn CLI Command** — A pure function from builder state to CLI string:

```bash
# ShadCN Registry distribution
npx shadcn add @plg/core @plg/posthog @plg/posthog-iac @plg/attio @plg/attio-iac

# Alternative: dynamically-generated registry-item JSON
npx shadcn add https://plg-stack.dev/r/plg.json?analytics=posthog&flags=posthog&crm=attio
```

**2. Generated Constants and IaC** — Files with user-specific values (event names, flag keys, plan tiers) embedded as typed constants and alchemy-effect resource classes. See Section 19 (Code Generation).

---

## 18. Dependency Constraint Graph

User selections are constrained by a **directed acyclic graph** (DAG) of dependencies. The builder uses **Effect's experimental `Graph` module** (`Graph.directed`, `Graph.topo`, `Graph.isAcyclic`) to model and enforce these constraints at runtime.

### 18.1 XState + Effect Graph Architecture

The constraint system uses a **hybrid architecture**: XState v5 owns the state machine (transitions, guards, cascades), Effect's `Graph` module owns the constraint DAG (topological ordering, cycle detection), and Effect programs handle code generation as invoked promise actors.

```typescript
import { setup, assign, and, or, not, fromPromise } from "xstate"
import { Graph, Effect, Schema } from "effect"

// ── XState Machine Definition ──────────────────────────────────

const plgBuilderMachine = setup({
  types: {
    context: {} as PlgBuilderConfig,
    events: {} as
      | { type: "SELECT_ANALYTICS"; value: AnalyticsProvider }
      | { type: "SELECT_FLAGS"; value: FeatureFlagProvider }
      | { type: "SELECT_EXPERIMENTS"; value: ExperimentProvider }
      | { type: "SELECT_SURVEYS"; value: SurveyProvider }
      | { type: "SELECT_CRM"; value: CrmProvider }
      | { type: "SELECT_PRICING"; value: PricingModel }
      | { type: "APPLY_PRESET"; preset: PresetName }
      | { type: "GENERATE" },
  },
  guards: {
    // Hard constraints (H1-H11) as composable guards
    canSelectPostHogFlags: ({ context }) => context.analytics === "posthog",
    canSelectPostHogSurveys: ({ context }) => context.analytics === "posthog",
    canSelectPostHogExperiments: and(["canSelectPostHogFlags", "flagsArePostHog"]),
    flagsArePostHog: ({ context }) => context.featureFlags === "posthog",
    flagsAreGrowthBook: ({ context }) => context.featureFlags === "growthbook",
    hasAnalytics: ({ context }) => context.analytics !== "none",
    hasFlags: ({ context }) => context.featureFlags !== "none",
    analyticsIsAmplitude: ({ context }) => context.analytics === "amplitude",

    // Cascade detection guards
    needsFlagsCascade: ({ context }) =>
      context.analytics !== "posthog" && context.featureFlags === "posthog",
    needsSurveysCascade: ({ context }) =>
      context.analytics !== "posthog" && context.surveys === "posthog",
    needsExperimentsCascade: ({ context }) =>
      context.featureFlags === "none" && context.experimentation !== "none",
  },
  actors: {
    generateCode: fromPromise(async ({ input }: { input: PlgBuilderConfig }) =>
      Effect.runPromise(generatePlgCode(input))
    ),
  },
}).createMachine({
  id: "plgBuilder",
  initial: "configuring",
  context: DEFAULT_CONFIG,
  states: {
    configuring: {
      // Eventless transitions for constraint cascading
      always: [
        {
          guard: "needsFlagsCascade",
          actions: assign({ featureFlags: "none" }),
        },
        {
          guard: "needsSurveysCascade",
          actions: assign({ surveys: "none" }),
        },
        {
          guard: "needsExperimentsCascade",
          actions: assign({ experimentation: "none" }),
        },
      ],
      on: {
        SELECT_ANALYTICS: { actions: assign({ analytics: ({ event }) => event.value }) },
        SELECT_FLAGS: {
          guard: "hasAnalytics",
          actions: assign({ featureFlags: ({ event }) => event.value }),
        },
        SELECT_EXPERIMENTS: {
          guard: "hasFlags",
          actions: assign({ experimentation: ({ event }) => event.value }),
        },
        GENERATE: { target: "generating" },
        APPLY_PRESET: { actions: assign(({ event }) => PRESETS[event.preset]) },
      },
    },
    generating: {
      invoke: {
        src: "generateCode",
        input: ({ context }) => context,
        onDone: { target: "complete", actions: assign({ output: ({ event }) => event.output }) },
        onError: { target: "configuring" },
      },
    },
    complete: {
      on: { SELECT_ANALYTICS: { target: "configuring" } }, // Any edit returns to configuring
    },
  },
})

// ── Effect Graph for Constraint DAG ────────────────────────────

// The Graph module provides topological ordering for cascade evaluation
// and cycle detection for validating constraint rule definitions.
// Constraints are defined as data (edges with weights), not imperative code.

const constraintGraph = Graph.directed<string, ConstraintRule>()
  .addEdge("analytics", "featureFlags", { rule: "H1", type: "hard" })
  .addEdge("analytics", "surveys", { rule: "H3", type: "hard" })
  .addEdge("analytics", "events", { rule: "implicit", type: "soft" })
  .addEdge("featureFlags", "experimentation", { rule: "H2", type: "hard" })
  .addEdge("pricingModel", "plans", { rule: "H4", type: "hard" })
  .addEdge("pricingModel", "events", { rule: "H5", type: "hard" })
  .addEdge("crm", "iac", { rule: "S7", type: "soft" })

// Topological sort determines cascade evaluation order
const cascadeOrder = Graph.topo(constraintGraph)
// → ["analytics", "featureFlags", "experimentation", "surveys", "pricingModel", "plans", "events", "crm", "iac"]

// Cycle detection validates constraint rules at build time
const isValid = Graph.isAcyclic(constraintGraph) // must be true

// ── UI Integration ─────────────────────────────────────────────

// The UI disables invalid options by querying the machine
const canSelectPostHogFlags = state.can({ type: "SELECT_FLAGS", value: "posthog" })
// Returns false if analytics !== "posthog", greying out the option
```

**Key properties of this architecture:**

1. **Cascades are automatic and loop-safe** — XState's `always` transitions fire after every context update. Guards are designed so their corrective actions invalidate their own condition (e.g., resetting flags to "none" makes `needsFlagsCascade` false), preventing infinite loops.
2. **Constraints are data, not code** — The `constraintGraph` is a declarative data structure. Adding a new constraint means adding an edge, not writing an if-chain.
3. **Code generation is an invoked actor** — The `generateCode` actor wraps an Effect program via `fromPromise`. XState manages the loading/error/complete lifecycle; Effect handles the actual generation logic.

### 18.2 Constraint DAG

```
Analytics Provider ──────────────────────────────────────┐
  │                                                       │
  ├──[H1]──► Feature Flags ──[H2]──► Experimentation     │
  │                                                       │
  ├──[H3]──► Surveys                                      │
  │                                                       │
  └────────► Events to Track                              │
                                                          │
Pricing Model ─────────────────────────────────────────┐  │
  │                                                     │  │
  ├──[H4]──► Plans (conditional visibility)             │  │
  │                                                     │  │
  └──[H5]──► Events to Track (monetization filter)      │  │
                                                        │  │
CRM Provider ──────────────────────────────────────┐    │  │
  │                                                 │    │  │
  ├──[S7]──► IaC Provider (soft recommendation)     │    │  │
  │                                                 │    │  │
  └────────► Automation helpers                     │    │  │
                                                    │    │  │
IaC Provider ──► Output format (.run.ts / .tf)      │    │  │
Distribution ──► Output structure (registry / npm)  │    │  │
```

### 18.3 Hard Constraints (MUST)

These constraints are enforced by the builder and cannot be overridden:

| Rule | Condition | Consequence | Reason |
|------|-----------|-------------|--------|
| H1 | Analytics = None | Feature Flags = None | Flags require user identification from analytics |
| H2 | Feature Flags = None | Experimentation = None | Experiments require flags to split traffic |
| H3 | Analytics = None | Surveys ∈ {None, Typeform, Formbricks} | PostHog Surveys requires PostHog analytics |
| H4 | Pricing = Free | Plans section hidden | No plan config needed for free products |
| H5 | Pricing = Free | Monetization events excluded | checkout/payment events are irrelevant |
| H6 | Analytics ≠ PostHog | Feature Flags ≠ PostHog Flags | PostHog flags are part of the PostHog platform |
| H7 | Analytics ≠ PostHog | Surveys ≠ PostHog Surveys | PostHog surveys require PostHog analytics |
| H8 | Analytics ≠ PostHog | Experimentation ≠ PostHog Experiments | PostHog experiments require PostHog |
| H9 | Analytics ≠ Amplitude | Experimentation ≠ Amplitude Experiment | Amplitude experiments require Amplitude SDK |
| H10 | Feature Flags ≠ GrowthBook | Experimentation ≠ GrowthBook Experiments | GrowthBook experiments need GrowthBook flags |
| H11 | IaC = None ∧ CRM ≠ None | Warn: CRM attributes must be configured manually | Without IaC, CRM attributes aren't auto-provisioned |

### 18.4 Soft Constraints (SHOULD)

These produce warnings but can be overridden:

| Rule | Condition | Recommendation | Reason |
|------|-----------|----------------|--------|
| S1 | Analytics = PostHog | Feature Flags → PostHog Flags | Unified user profiles across analytics + flags |
| S2 | Analytics = PostHog ∧ Flags = PostHog | Experimentation → PostHog Experiments | Full PostHog suite for maximum integration |
| S3 | Analytics = PostHog | Surveys → PostHog Surveys | Surveys can target based on analytics cohorts |
| S4 | CRM ≠ None | ≥1 monetization event selected | CRM lifecycle tracking requires revenue events |
| S5 | Experimentation ≠ None | ≥1 experiment flag created | Experiments need at least one flag to function |
| S6 | Pricing = Free Trial | `trial_expired` event selected | Trial expiration is a critical churn signal |
| S7 | CRM ≠ None | IaC ≠ None | CRM attribute provisioning is error-prone without IaC |

### 18.5 Cascade Rules

When a parent selection changes, dependent selections are automatically adjusted:

```
CASCADE C1: Analytics changes FROM PostHog TO anything else:
  → Feature Flags = PostHog Flags? Reset to None
  → Surveys = PostHog Surveys? Reset to None
  → Experimentation cascades via C2

CASCADE C2: Feature Flags changes TO None:
  → Experimentation != None? Reset to None

CASCADE C3: Analytics changes TO PostHog:
  → Suggest Feature Flags = PostHog Flags (soft, dismissible)
  → Suggest Surveys = PostHog Surveys (soft, dismissible)

CASCADE C4: Pricing changes TO Free:
  → Remove all monetization events
  → Hide Plans section

CASCADE C5: Pricing changes FROM Free TO anything:
  → Add default monetization events
  → Show Plans section with defaults
```

### 18.6 Availability Matrix

Which options are available based on current selections:

**Feature Flags availability by Analytics Provider:**

| Analytics \ Flags | PostHog Flags | LaunchDarkly | Statsig | GrowthBook | None |
|-------------------|:---:|:---:|:---:|:---:|:---:|
| PostHog           | ✓ | ✓ | ✓ | ✓ | ✓ |
| Amplitude         | — | ✓ | ✓ | ✓ | ✓ |
| Mixpanel          | — | ✓ | ✓ | ✓ | ✓ |
| Segment           | — | ✓ | ✓ | ✓ | ✓ |
| None              | — | — | — | — | ✓ |

**Experimentation availability by Analytics + Feature Flags:**

| Analytics + Flags \ Experiments | PostHog Exp | Statsig | Amplitude Exp | GrowthBook Exp | None |
|---------------------------------|:---:|:---:|:---:|:---:|:---:|
| PostHog + PostHog Flags         | ✓ | ✓ | — | — | ✓ |
| PostHog + LaunchDarkly          | — | ✓ | — | — | ✓ |
| PostHog + GrowthBook            | — | ✓ | — | ✓ | ✓ |
| Amplitude + Any flags           | — | ✓ | ✓ | see flags | ✓ |
| Any + None flags                | — | — | — | — | ✓ |

---

## 19. Dynamic User Inputs and Code Generation

The builder lets users **add, remove, and customize** items like pricing plans, feature flags, analytics events, and CRM attributes. These dynamic inputs are validated with **Effect Schema**, persisted via `Schema.encode`/`Schema.decode`, and transformed into generated TypeScript constants and IaC resources via **pure generator functions** (string interpolation).

### 19.1 Effect Schema as Single Source of Truth

The entire builder configuration is a single Effect Schema. From this schema, we derive:

1. **TypeScript types** — `typeof PlgBuilderConfig.Type` for the codegen pipeline
2. **Runtime validation** — `Schema.decodeUnknownEither` for validating user input
3. **JSON Schema** — `JSONSchema.make()` for driving dynamic form UI (react-jsonschema-form)
4. **Serialization** — `Schema.encode`/`Schema.decode` for persistence (localStorage, URL, database)
5. **Error messages** — `ArrayFormatter` for mapping validation failures to form fields

```
Effect Schema (PlgBuilderConfig)
    │
    ├── JSONSchema.make() ──► JSON Schema ──► Dynamic Form UI
    │
    ├── Schema.decodeUnknownEither() ──► Validated config (codegen input)
    │
    ├── Schema.encode() ──► JSON ──► localStorage / URL / database
    │
    └── ArrayFormatter.formatErrorSync() ──► Form field errors
```

### 19.2 Reusable Field Schemas with Branded Types

All user-entered keys and values use branded schemas with validation constraints and user-facing error messages:

```typescript
import { Schema } from "effect"

// UPPER_SNAKE_CASE constant key (e.g., "FREE", "DARK_MODE", "SIGNUP_COMPLETED")
const ConstantKey = Schema.String.pipe(
  Schema.pattern(/^[A-Z][A-Z0-9_]*$/),
  Schema.minLength(1),
  Schema.maxLength(30),
  Schema.brand("ConstantKey"),
  Schema.annotations({
    message: () => "Must be UPPER_SNAKE_CASE (e.g., PRO, DARK_MODE)",
    title: "Constant Key",
    examples: ["FREE", "PRO", "ENTERPRISE", "DARK_MODE"],
  })
)
type ConstantKey = typeof ConstantKey.Type

// lowercase-kebab-case runtime value (e.g., "free", "dark-mode", "signup-completed")
const KebabValue = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.minLength(1),
  Schema.maxLength(50),
  Schema.brand("KebabValue"),
  Schema.annotations({
    message: () => "Must be lowercase-kebab-case (e.g., free, dark-mode)",
    title: "Value",
    examples: ["free", "pro", "dark-mode"],
  })
)
type KebabValue = typeof KebabValue.Type

// Percentage (0-100)
const Percentage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.annotations({ message: () => "Must be between 0 and 100" })
)
```

Branded types prevent accidental mixing: a `ConstantKey` cannot be passed where a `KebabValue` is expected, even though both are strings at runtime.

### 19.3 Name-to-Key Derivation

When a user types a display name (e.g., "Dark Mode"), the builder auto-derives both keys:

```typescript
function deriveKeys(displayName: string): { constantKey: string; kebabValue: string } {
  return {
    constantKey: displayName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, ""),
    kebabValue: displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  }
}

// "Dark Mode" → { constantKey: "DARK_MODE", kebabValue: "dark-mode" }
// "Pro Plan"  → { constantKey: "PRO_PLAN", kebabValue: "pro-plan" }
```

Following the **LaunchDarkly pattern**: keys auto-populate as the user types the name, with an "Edit key" toggle for manual override. Keys become immutable after generation (changing them would break code references).

Collision detection validates in real-time: if a user adds two items that generate the same key, an inline error appears immediately.

### 19.4 Item Config Schemas (Dynamic Lists)

Each user-defined item type has its own Effect Schema. Users add/remove items via the builder UI; each add validates with `Schema.decodeUnknownEither`.

**Pricing Plans:**

```typescript
const PlanConfig = Schema.Struct({
  key: ConstantKey,
  value: KebabValue,
  displayName: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  priceCents: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({ message: () => "Price must be a non-negative whole number (cents)" })
  ),
})
type PlanConfig = typeof PlanConfig.Type
```

**Feature Flags (Discriminated Union):**

Feature flags come in three variants, modeled as a `Schema.Union` with a `_tag` discriminator:

```typescript
const BooleanFlagConfig = Schema.Struct({
  _tag: Schema.Literal("boolean"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  active: Schema.Boolean,
})

const PercentageFlagConfig = Schema.Struct({
  _tag: Schema.Literal("percentage"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  rolloutPercentage: Percentage,
})

const MultivariateFlagConfig = Schema.Struct({
  _tag: Schema.Literal("multivariate"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  variants: Schema.NonEmptyArray(Schema.Struct({
    key: Schema.String.pipe(Schema.minLength(1)),
    rolloutPercentage: Percentage,
  })),
})

const FeatureFlagConfig = Schema.Union(
  BooleanFlagConfig,
  PercentageFlagConfig,
  MultivariateFlagConfig,
)
type FeatureFlagConfig = typeof FeatureFlagConfig.Type
```

The `_tag` discriminator gives **exhaustive pattern matching** in generator functions — the compiler verifies every variant is handled.

**Events with Payload Fields:**

```typescript
const EventPayloadFieldConfig = Schema.Struct({
  name: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]*$/)),
  type: Schema.Literal("string", "number", "boolean"),
  optional: Schema.Boolean,
})

const EventConfig = Schema.Struct({
  key: ConstantKey,
  value: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]*$/)),
  category: Schema.Literal("acquisition", "activation", "engagement", "monetization", "churn", "referral", "usage"),
  payloadFields: Schema.Array(EventPayloadFieldConfig),
})
```

**Survey Questions (Discriminated Union):**

```typescript
const SurveyQuestionConfig = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("rating"),
    question: Schema.String.pipe(Schema.minLength(1)),
    scale: Schema.Literal(5, 10),
  }),
  Schema.Struct({
    _tag: Schema.Literal("open"),
    question: Schema.String.pipe(Schema.minLength(1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal("single_choice"),
    question: Schema.String.pipe(Schema.minLength(1)),
    choices: Schema.NonEmptyArray(Schema.String.pipe(Schema.minLength(1))),
  }),
)

const SurveyConfig = Schema.Struct({
  key: ConstantKey,
  value: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  type: Schema.Literal("popover", "api"),
  questions: Schema.NonEmptyArray(SurveyQuestionConfig),
})
```

**CRM Attributes with Semantic Option Mapping:**

```typescript
const CrmAttributeConfig = Schema.Struct({
  key: ConstantKey,
  value: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]*$/)),
  target: Schema.Literal("companies", "people", "deals"),
  type: Schema.Literal("select", "number", "date", "checkbox", "status"),
  displayName: Schema.String.pipe(Schema.minLength(1)),
  // For select/status types: the option values belonging to this attribute
  options: Schema.optional(Schema.Array(Schema.Struct({
    key: ConstantKey,
    value: Schema.String.pipe(Schema.minLength(1)),
  }))),
})
```

### 19.5 Complete PlgBuilderConfig Schema

```typescript
export const PlgBuilderConfig = Schema.Struct({
  // Provider selections (single-select)
  analyticsProvider: Schema.Literal("posthog", "amplitude", "mixpanel", "segment", "none"),
  featureFlagProvider: Schema.Literal("posthog", "launchdarkly", "statsig", "growthbook", "none"),
  experimentProvider: Schema.Literal("posthog", "statsig", "amplitude", "growthbook", "none"),
  surveyProvider: Schema.Literal("posthog", "typeform", "formbricks", "none"),
  crmProvider: Schema.Literal("attio", "hubspot", "salesforce", "none"),
  pricingModel: Schema.Literal("free", "freemium", "free_trial", "usage_based", "seat_based", "custom"),
  iacProvider: Schema.Literal("alchemy", "terraform", "pulumi", "none"),
  distribution: Schema.Literal("shadcn", "npm", "monorepo"),

  // Dynamic user-defined lists (add/remove)
  plans: Schema.Array(PlanConfig),
  billingIntervals: Schema.Array(Schema.Struct({ key: ConstantKey, value: KebabValue })),
  events: Schema.Array(EventConfig),
  featureFlags: Schema.Array(FeatureFlagConfig),
  surveys: Schema.Array(SurveyConfig),
  crmAttributes: Schema.Array(CrmAttributeConfig),
  userProperties: Schema.Array(Schema.Struct({ key: ConstantKey, value: Schema.String })),

  // Pricing-model-specific (conditional)
  trialDays: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(90))),
  usageMetric: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  seatThresholds: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))),
}).annotations({
  title: "PLG Builder Configuration",
  description: "Complete configuration for generating a PLG stack from user selections",
})

export type PlgBuilderConfig = typeof PlgBuilderConfig.Type
```

### 19.6 Validation and Error Handling

**Per-item validation** (when user clicks "Add"):

```typescript
const validatePlan = Schema.decodeUnknownEither(PlanConfig, { errors: "all" })

function handleAddPlan(formData: unknown) {
  const result = validatePlan(formData)
  if (Either.isRight(result)) {
    dispatch({ type: "ADD_PLAN", plan: result.right })
  } else {
    // ArrayFormatter produces errors mappable to form fields
    const errors = ParseResult.ArrayFormatter.formatErrorSync(result.left)
    // [{ _tag: "Type", path: ["key"], message: "Must be UPPER_SNAKE_CASE" }, ...]
    showFieldErrors(errors)
  }
}
```

**Full config validation** (before code generation):

```typescript
const validateConfig = Schema.decodeUnknownEither(PlgBuilderConfig, { errors: "all" })
```

**React Hook Form integration** via `@hookform/resolvers/effect-ts`:

```typescript
import { effectTsResolver } from "@hookform/resolvers/effect-ts"

function PlanForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: effectTsResolver(PlanConfig),
  })
  // errors.key?.message → "Must be UPPER_SNAKE_CASE (e.g., PRO, ENTERPRISE)"
}
```

### 19.7 Persistence and Round-Trip

Builder state is serialized via `Schema.encode` and restored via `Schema.decode`, with round-trip fidelity guaranteed:

```typescript
// Save: typed config → JSON
const encoded = Schema.encodeSync(PlgBuilderConfig)(config)
localStorage.setItem("plg-config", JSON.stringify(encoded))

// Restore: JSON → typed config (validates on decode)
const raw = JSON.parse(localStorage.getItem("plg-config")!)
const restored = Schema.decodeUnknownSync(PlgBuilderConfig)(raw)

// URL sharing: base64-encoded JSON in query param
const shareUrl = `https://plg-stack.dev/new?config=${btoa(JSON.stringify(encoded))}`
```

### 19.8 Code Generation Strategy

Code generation is a **pure function**: validated `PlgBuilderConfig` in, TypeScript source strings out. String interpolation is used because the output patterns are simple (`as const` objects, type aliases, class declarations). Post-processed with Prettier/Biome.

**Constants generation** (matching the existing `@packages/plg` pattern):

```typescript
function generateConstantsFile(
  name: string, typeName: string,
  items: ReadonlyArray<{ key: string; value: string }>
): string {
  const entries = items.map(item => `  ${item.key}: "${item.value}",`).join("\n")
  return [
    `export const ${name} = {`,
    entries,
    `} as const;`,
    ``,
    `export type ${typeName} = (typeof ${name})[keyof typeof ${name}];`,
  ].join("\n")
}
```

**EventPayloads interface** (the complex case — computed property keys with typed payloads):

```typescript
function generateEventsFile(events: ReadonlyArray<typeof EventConfig.Type>): string {
  const constEntries = events.map(e => `  ${e.key}: "${e.value}",`).join("\n")

  const payloadEntries = events.map(e => {
    if (e.payloadFields.length === 0) return `  [Events.${e.key}]: {};`
    const fields = e.payloadFields
      .map(f => `    ${f.name}${f.optional ? "?" : ""}: ${f.type};`)
      .join("\n")
    return `  [Events.${e.key}]: {\n${fields}\n  };`
  }).join("\n")

  return [
    `export const Events = {`, constEntries, `} as const;`, ``,
    `export type EventName = (typeof Events)[keyof typeof Events];`, ``,
    `export interface EventPayloads {`, payloadEntries, `}`,
  ].join("\n")
}
```

**Feature flag IaC resources** (pattern-matched on `_tag` discriminator):

```typescript
function generateFeatureFlagResource(flag: typeof FeatureFlagConfig.Type): string {
  const className = toPascalCase(flag.name) + "Flag"
  const constKey = flag.key.toUpperCase().replace(/-/g, "_")

  switch (flag._tag) {
    case "boolean":
      return [
        `export class ${className} extends FeatureFlag("${className}", {`,
        `  key: FeatureFlags.${constKey},`,
        `  name: "${flag.name}",`,
        `  active: ${flag.active},`,
        `  rolloutPercentage: 100,`,
        `}) {}`,
      ].join("\n")
    case "percentage":
      return [
        `export class ${className} extends FeatureFlag("${className}", {`,
        `  key: FeatureFlags.${constKey},`,
        `  name: "${flag.name}",`,
        `  active: true,`,
        `  rolloutPercentage: ${flag.rolloutPercentage},`,
        `}) {}`,
      ].join("\n")
    case "multivariate":
      const variants = flag.variants
        .map(v => `      { key: "${v.key}", rollout_percentage: ${v.rolloutPercentage} },`)
        .join("\n")
      return [
        `export class ${className} extends FeatureFlag("${className}", {`,
        `  key: FeatureFlags.${constKey},`,
        `  name: "${flag.name}",`,
        `  active: true,`,
        `  multivariate: { variants: [\n${variants}\n    ] },`,
        `}) {}`,
      ].join("\n")
  }
}
```

**CRM attributes with semantic option mapping** (the most complex generation):

```typescript
function generateCrmFile(attributes: ReadonlyArray<typeof CrmAttributeConfig.Type>): string {
  const sections: string[] = []

  // 1. Main attributes constant
  const attrEntries = attributes.map(a => `  ${a.key}: "${a.value}",`).join("\n")
  sections.push(`export const CrmAttributes = {\n${attrEntries}\n} as const;\n`)
  sections.push(`export type CrmAttribute = (typeof CrmAttributes)[keyof typeof CrmAttributes];\n`)

  // 2. Per-attribute option constants (for select/status types)
  for (const attr of attributes) {
    if (attr.options && attr.options.length > 0) {
      const optName = toPascalCase(attr.displayName) + "s" // e.g., "LifecycleStages"
      const optType = toPascalCase(attr.displayName)       // e.g., "LifecycleStage"
      const optEntries = attr.options.map(o => `  ${o.key}: "${o.value}",`).join("\n")
      sections.push(`export const ${optName} = {\n${optEntries}\n} as const;\n`)
      sections.push(`export type ${optType} = (typeof ${optName})[keyof typeof ${optName}];\n`)
    }
  }

  return sections.join("\n")
}
```

### 19.9 Generated Artifacts per Selection

| Selection | Generated File | Contents | Complexity |
|-----------|---------------|----------|------------|
| Events to Track | `src/events.ts` | `Events` const + `EventName` type + `EventPayloads` interface | High |
| Plans (if Pricing ≠ Free) | `src/plans.ts` | `Plans` const + `BillingIntervals` const + types | Low |
| Feature Flags to Create | `src/feature-flags.ts` | `FeatureFlags` const + `FeatureFlagKey` type | Low |
| Surveys (if ≠ None) | `src/surveys.ts` | `Surveys` const + `SurveyId` type | Low |
| CRM (if ≠ None) | `src/crm.ts` | Attribute keys + per-attribute option constants | High |
| User Properties | `src/user-properties.ts` | `UserProperties` const + `UserPropertyKey` type | Low |
| Analytics (if ≠ None) | `src/sdk/track.ts` | `createPlgClient()` wrapping provider SDK | Medium |
| Analytics (if ≠ None) | `src/sdk/identify.ts` | `identify()` function for user properties | Medium |
| CRM = Attio | `src/sdk/attio-sync.ts` | Effect-based Attio record update helpers | Medium |
| CRM ≠ None ∧ Analytics ≠ None | `src/sdk/automations.ts` | Composed lifecycle helpers | Medium |
| IaC = Alchemy-Effect | `plg-stack.run.ts` | All resource classes + `defineStack` | High |
| IaC = Terraform | `main.tf` + `variables.tf` | HCL resource definitions | Medium |
| IaC = Pulumi | `index.ts` | Pulumi TypeScript program | Medium |
| Always | `src/index.ts` | Barrel re-exports (conditional on which files generated) | Low |
| Distribution = ShadCN | `registry.json` | Registry items for all generated files | Low |
| Distribution = npm | `package.json` | Exports map for all generated modules | Low |

### 19.10 End-to-End Pipeline

```
Step 1: User adds/edits items in builder UI
    → Each item validated with Schema.decodeUnknownEither(ItemConfig)
    → Errors shown via ArrayFormatter → form field mapping
    → Name-to-key auto-derivation with "Edit key" toggle

Step 2: XState machine assembles complete config
    → always transitions enforce constraint cascades
    → Guards disable invalid options via state.can(event)

Step 3: Config persisted
    → Schema.encodeSync(PlgBuilderConfig)(config) → JSON
    → Stored in localStorage + synced to URL params (nuqs)

Step 4: Config restored (page reload / shared URL)
    → Schema.decodeUnknownSync(PlgBuilderConfig)(raw) → typed config
    → Schema guarantees round-trip fidelity

Step 5: Code generation (invoked as XState fromPromise actor)
    → Pure functions: PlgBuilderConfig → Map<filename, sourceCode>
    → Pattern matching on _tag for discriminated unions
    → IaC resource classes generated alongside constants

Step 6: Output packaging
    → shadcn: wrap files in registry-item JSON
    → npm: generate package.json + files
    → monorepo: write directly to packages/plg/src/

Step 7: Post-processing
    → Format all .ts files with Prettier/Biome
    → Compose shadcn CLI command from config

Step 8: Output to user
    → Live code preview (Shiki syntax highlighting)
    → Copy CLI command to clipboard
    → Download as zip
```

### 19.11 CLI Command Composition

```typescript
function composeShadcnCommand(config: PlgBuilderConfig): string {
  const items: string[] = ["@plg/core"]
  if (config.analyticsProvider === "posthog") items.push("@plg/posthog")
  if (config.crmProvider === "attio") items.push("@plg/attio")
  if (config.iacProvider !== "none") {
    if (config.analyticsProvider === "posthog") items.push("@plg/posthog-iac")
    if (config.crmProvider === "attio") items.push("@plg/attio-iac")
  }
  return `npx shadcn add ${items.join(" ")}`
}
```

---

## 20. Builder Presets

Presets pre-fill all builder categories at once. Users can customize after selecting a preset.

### 20.1 Minimal

For early-stage products needing basic analytics only.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | None |
| Experimentation | None |
| Surveys | None |
| CRM | None |
| Pricing Model | Free |
| Events | `signup_started`, `signup_completed`, `onboarding_started`, `onboarding_completed`, `feature_used` |
| IaC | None |
| Distribution | npm Package |

**CLI:** `npx shadcn add @plg/core @plg/posthog`

### 20.2 Growth

For products adding monetization and optimizing conversion funnels.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | PostHog Flags |
| Experimentation | PostHog Experiments |
| Surveys | PostHog Surveys |
| CRM | None |
| Pricing Model | Freemium |
| Plans | `free`, `starter`, `pro`, `enterprise` |
| Events | All acquisition + engagement + monetization events |
| Feature Flags | `dark-mode`, `beta-features`, `new-onboarding-flow`, `new-pricing-page` |
| IaC | Alchemy-Effect |
| Distribution | ShadCN Registry |

**CLI:** `npx shadcn add @plg/core @plg/posthog @plg/posthog-iac`

### 20.3 Full (Default)

Complete PLG infrastructure spanning analytics and CRM.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | PostHog Flags |
| Experimentation | PostHog Experiments |
| Surveys | PostHog Surveys |
| CRM | Attio |
| Pricing Model | Freemium |
| Plans | `free`, `starter`, `pro`, `enterprise` |
| Events | All events |
| Feature Flags | `dark-mode`, `beta-features`, `new-onboarding-flow`, `new-pricing-page` |
| IaC | Alchemy-Effect |
| Distribution | Monorepo Internal |

**CLI:** `npx shadcn add @plg/core @plg/posthog @plg/posthog-iac @plg/attio @plg/attio-iac`

### 20.4 Enterprise

For products with complex sales pipelines and multi-provider needs.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | LaunchDarkly |
| Experimentation | None |
| Surveys | PostHog Surveys |
| CRM | Salesforce |
| Pricing Model | Seat-Based |
| Plans | `team`, `business`, `enterprise` |
| Events | All events + `seat_added`, `seat_removed` |
| Feature Flags | `dark-mode`, `beta-features`, `seat-management-ui`, `crm-sync-enabled` |
| IaC | Terraform |
| Distribution | Monorepo Internal |

**CLI:** `npx shadcn add @plg/core @plg/posthog @plg/posthog-iac @plg/salesforce @plg/salesforce-iac`

### 20.5 Self-Hosted / Open-Source

For teams preferring fully open-source, self-hostable tooling.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | GrowthBook |
| Experimentation | GrowthBook Experiments |
| Surveys | Formbricks |
| CRM | Attio |
| Pricing Model | Freemium |
| Plans | `free`, `pro`, `enterprise` |
| Events | All acquisition + engagement + monetization events |
| Feature Flags | `dark-mode`, `beta-features`, `new-onboarding-flow` |
| IaC | Alchemy-Effect |
| Distribution | ShadCN Registry |

**CLI:** `npx shadcn add @plg/core @plg/posthog @plg/posthog-iac @plg/growthbook @plg/attio @plg/attio-iac @plg/formbricks`

---

## 21. CLI Experience (@effect/cli)

The PLG builder provides a **CLI experience** alongside the web UI, built with `@effect/cli`. Both interfaces share the same validation schemas, constraint logic, and code generation functions — the CLI is an alternative frontend to the same `PlgBuilderConfig → codegen` pipeline.

### 21.1 Three CLI Modes

**1. Flags mode** — All options specified as CLI flags (CI/CD friendly, scriptable):

```bash
npx create-plg-stack \
  --analytics posthog \
  --flags posthog \
  --experiments posthog \
  --surveys posthog \
  --crm attio \
  --pricing freemium \
  --plans free,starter,pro,enterprise \
  --events signup_started,signup_completed,checkout_completed \
  --feature-flags dark-mode,beta-features \
  --iac alchemy \
  --distribution shadcn
```

**2. Wizard mode** (`--wizard` or missing flags) — Interactive prompts for missing options:

```bash
npx create-plg-stack --wizard

# Or hybrid: specify some flags, get prompted for the rest
npx create-plg-stack --analytics posthog --pricing freemium
# → prompted for: flags, experiments, surveys, crm, plans, events, feature-flags, iac, distribution
```

**3. Preset mode** — Apply a named preset, optionally overriding specific options:

```bash
npx create-plg-stack --preset full
npx create-plg-stack --preset growth --crm attio --iac alchemy
```

### 21.2 Command Definition

```typescript
import { Command, Options, Args, Prompt } from "@effect/cli"
import { Effect, Layer, Schema } from "effect"
import { NodeContext, NodeRuntime } from "@effect/platform-node"

// ── Provider Selection Options ─────────────────────────────────

const analyticsOption = Options.choice("analytics", [
  "posthog", "amplitude", "mixpanel", "segment", "none"
]).pipe(
  Options.withDescription("Analytics provider"),
  Options.withDefault("none"),
  Options.withFallbackPrompt(
    Prompt.select({
      message: "Which analytics provider?",
      choices: [
        { title: "PostHog", value: "posthog" },
        { title: "Amplitude", value: "amplitude" },
        { title: "Mixpanel", value: "mixpanel" },
        { title: "Segment", value: "segment" },
        { title: "None", value: "none" },
      ],
    })
  ),
)

const flagsOption = Options.choice("flags", [
  "posthog", "launchdarkly", "statsig", "growthbook", "none"
]).pipe(
  Options.withDescription("Feature flag provider"),
  Options.withDefault("none"),
  Options.withFallbackPrompt(
    Prompt.select({
      message: "Which feature flag provider?",
      choices: [
        { title: "PostHog Flags", value: "posthog" },
        { title: "LaunchDarkly", value: "launchdarkly" },
        { title: "Statsig", value: "statsig" },
        { title: "GrowthBook", value: "growthbook" },
        { title: "None", value: "none" },
      ],
    })
  ),
)

const presetOption = Options.choice("preset", [
  "minimal", "growth", "full", "enterprise", "self-hosted"
]).pipe(
  Options.optional,
  Options.withDescription("Apply a preset configuration"),
)

// ── Dynamic List Options ───────────────────────────────────────

const plansOption = Options.text("plans").pipe(
  Options.optional,
  Options.withDescription("Comma-separated plan names (e.g., free,starter,pro,enterprise)"),
  Options.withFallbackPrompt(
    Prompt.list({
      message: "Enter pricing plan names (comma-separated):",
    })
  ),
)

const eventsOption = Options.text("events").pipe(
  Options.optional,
  Options.withDescription("Comma-separated event names"),
  Options.withFallbackPrompt(
    Prompt.multiSelect({
      message: "Which events to track?",
      choices: [
        { title: "signup_started", value: "signup_started" },
        { title: "signup_completed", value: "signup_completed" },
        { title: "onboarding_started", value: "onboarding_started" },
        { title: "onboarding_completed", value: "onboarding_completed" },
        { title: "feature_used", value: "feature_used" },
        { title: "checkout_started", value: "checkout_started" },
        { title: "checkout_completed", value: "checkout_completed" },
        { title: "plan_upgraded", value: "plan_upgraded" },
        { title: "plan_downgraded", value: "plan_downgraded" },
        { title: "trial_started", value: "trial_started" },
        { title: "trial_expired", value: "trial_expired" },
        { title: "churn_signal", value: "churn_signal" },
        { title: "cancellation_requested", value: "cancellation_requested" },
      ],
    })
  ),
)

const featureFlagsOption = Options.text("feature-flags").pipe(
  Options.optional,
  Options.withDescription("Comma-separated feature flag keys (kebab-case)"),
  Options.withFallbackPrompt(
    Prompt.list({
      message: "Enter feature flag keys (comma-separated, kebab-case):",
    })
  ),
)
```

### 21.3 Wizard Flow with Conditional Branching

The interactive wizard uses `Effect.gen` for conditional questions — later prompts depend on earlier answers:

```typescript
const wizardFlow = Effect.gen(function* () {
  // Step 1: Provider selections
  const analytics = yield* Prompt.select({
    message: "Analytics provider?",
    choices: [
      { title: "PostHog (recommended)", value: "posthog" },
      { title: "Amplitude", value: "amplitude" },
      { title: "Mixpanel", value: "mixpanel" },
      { title: "Segment", value: "segment" },
      { title: "None", value: "none" },
    ],
  })

  // Step 2: Feature flags — options depend on analytics selection
  const flagChoices = [
    ...(analytics === "posthog" ? [{ title: "PostHog Flags (recommended)", value: "posthog" }] : []),
    { title: "LaunchDarkly", value: "launchdarkly" },
    { title: "Statsig", value: "statsig" },
    { title: "GrowthBook", value: "growthbook" },
    ...(analytics !== "none" ? [] : []),
    { title: "None", value: "none" },
  ]

  const flags = analytics === "none"
    ? "none"
    : yield* Prompt.select({ message: "Feature flag provider?", choices: flagChoices })

  // Step 3: Experiments — only if flags selected
  const experiments = flags === "none"
    ? "none"
    : yield* Prompt.select({
        message: "Experimentation provider?",
        choices: [
          ...(flags === "posthog" ? [{ title: "PostHog Experiments", value: "posthog" }] : []),
          ...(flags !== "none" ? [{ title: "Statsig", value: "statsig" }] : []),
          { title: "None", value: "none" },
        ],
      })

  // Step 4: Pricing model
  const pricing = yield* Prompt.select({
    message: "Pricing model?",
    choices: [
      { title: "Free", value: "free" },
      { title: "Freemium", value: "freemium" },
      { title: "Free Trial", value: "free_trial" },
      { title: "Usage-Based", value: "usage_based" },
      { title: "Seat-Based", value: "seat_based" },
    ],
  })

  // Step 5: Plans — only if pricing ≠ free
  const plans = pricing === "free"
    ? []
    : yield* Prompt.list({ message: "Enter plan names (comma-separated):" })

  // Step 6: Feature flags to create — only if flags selected
  const featureFlags = flags === "none"
    ? []
    : yield* Prompt.list({
        message: "Enter feature flag keys (comma-separated, kebab-case):",
      })

  // Step 7: CRM, IaC, Distribution...
  // ... (similar conditional prompts)

  return { analytics, flags, experiments, pricing, plans, featureFlags /* ... */ }
})
```

### 21.4 Command Composition

```typescript
const createCommand = Command.make(
  "create",
  {
    analytics: analyticsOption,
    flags: flagsOption,
    experiments: experimentsOption,
    surveys: surveysOption,
    crm: crmOption,
    pricing: pricingOption,
    plans: plansOption,
    events: eventsOption,
    featureFlags: featureFlagsOption,
    iac: iacOption,
    distribution: distributionOption,
    preset: presetOption,
    wizard: Options.boolean("wizard").pipe(
      Options.withDefault(false),
      Options.withDescription("Run interactive wizard for all options"),
    ),
  },
  (options) => Effect.gen(function* () {
    // 1. Build config from CLI options (or wizard)
    const config = options.wizard
      ? yield* wizardFlow
      : options.preset
        ? applyPreset(options.preset, options)
        : buildConfigFromOptions(options)

    // 2. Validate with Effect Schema
    const validated = yield* Schema.decodeUnknown(PlgBuilderConfig)(config)

    // 3. Generate code
    const files = yield* generatePlgCode(validated)

    // 4. Write files or compose CLI command
    yield* writeGeneratedFiles(files, validated.distribution)

    // 5. Print summary
    yield* Console.log(`\n✓ Generated ${files.size} files`)
    yield* Console.log(`\nRun: ${composeShadcnCommand(validated)}`)
  })
)

const plgCli = Command.make("plg-stack", {}).pipe(
  Command.withSubcommands([createCommand]),
  Command.withDescription("PLG Stack Builder — generate a type-safe Product-Led Growth stack"),
)

// ── Run ────────────────────────────────────────────────────────

const main = Command.run(plgCli, {
  name: "create-plg-stack",
  version: "0.1.0",
})

main(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
```

### 21.5 Key @effect/cli Features Used

| Feature | Purpose |
|---------|---------|
| `Options.choice` | Typed enum selection for providers |
| `Options.withFallbackPrompt` | Hybrid: use flag if provided, prompt if missing |
| `Options.withDefault` | Sensible defaults for CI/CD mode |
| `Prompt.select` | Single-choice interactive selection |
| `Prompt.multiSelect` | Multi-choice for events |
| `Prompt.list` | Comma-separated list input for plans, flags |
| `Prompt.confirm` | Yes/no confirmation before generation |
| `Command.withSubcommands` | Extensible: `plg-stack create`, `plg-stack list-presets`, etc. |
| `Options.withSchema` | Validate option values against Effect Schema at parse time |
| Built-in `--wizard` | Auto-prompt for all missing options (zero code) |
| Built-in `--completions` | Shell completions for bash/zsh/fish |

### 21.6 Shared Core Architecture

```
┌─────────────────────────────────────────────────┐
│  plg-builder-core (shared package)              │
│                                                  │
│  PlgBuilderConfig (Effect Schema)               │
│  Constraint rules (XState guards / Effect Graph) │
│  Code generators (pure functions)                │
│  Preset definitions                              │
│  CLI command composition                         │
└──────────┬────────────────────┬─────────────────┘
           │                    │
  ┌────────▼─────────┐  ┌──────▼──────────┐
  │  Web UI (React)  │  │  CLI (@effect/cli)│
  │                  │  │                   │
  │  XState machine  │  │  Options/Prompts  │
  │  effect-atom     │  │  Effect.gen wizard│
  │  nuqs URL state  │  │  --wizard flag    │
  │  React Hook Form │  │  --preset flag    │
  │  Shiki preview   │  │  stdout output    │
  └──────────────────┘  └───────────────────┘
```

Both interfaces consume the same `plg-builder-core`:
- **Schemas** — `PlgBuilderConfig`, `PlanConfig`, `FeatureFlagConfig`, etc.
- **Constraint evaluation** — Same constraint DAG and cascade logic
- **Code generators** — Same `generateEventsFile`, `generateFeatureFlagResource`, etc.
- **Presets** — Same `PRESETS` constant with preset configurations
- **CLI composition** — Same `composeShadcnCommand` function

---

## 22. Web UI State with effect-atom

The web builder UI uses **effect-atom** (by Tim Smart, formerly `effect-rx`) for reactive state management. effect-atom provides Jotai-style atomic state natively integrated with Effect's service/layer system — a better fit than raw `SubscriptionRef` for React UI binding.

### 22.1 Why effect-atom

| Concern | SubscriptionRef | effect-atom |
|---------|-----------------|-------------|
| React hooks | Manual bridge needed | `useAtomValue`, `useAtomSet`, `useAtom` built-in |
| Derived state | Manual `Effect.map` | `Atom.make((get) => ...)` auto-recomputes |
| Effect services | Already in Effect | `Atom.runtime(layer)` bridges Layers into atoms |
| URL persistence | Manual sync | `Atom.searchParam` built-in |
| Lifecycle | Manual fiber management | TTL, keepAlive, finalizers built-in |
| Batching | Not available | Built-in batch updates |

### 22.2 Builder State Atoms

```typescript
import { Atom, AtomProvider, useAtomValue, useAtomSet } from "effect-atom/React"
import { Effect, Layer, Schema } from "effect"

// ── Provider Selection Atoms ───────────────────────────────────

const analyticsAtom = Atom.searchParam("analytics", "none")
const flagsAtom = Atom.searchParam("flags", "none")
const experimentsAtom = Atom.searchParam("experiments", "none")
const surveysAtom = Atom.searchParam("surveys", "none")
const crmAtom = Atom.searchParam("crm", "none")
const pricingAtom = Atom.searchParam("pricing", "freemium")
const iacAtom = Atom.searchParam("iac", "none")
const distributionAtom = Atom.searchParam("dist", "shadcn")

// ── Derived Constraint Atoms ───────────────────────────────────

// Derived atom: available flag providers based on analytics selection
const availableFlagsAtom = Atom.make((get) => {
  const analytics = get(analyticsAtom)
  if (analytics === "none") return ["none"]
  if (analytics === "posthog") return ["posthog", "launchdarkly", "statsig", "growthbook", "none"]
  return ["launchdarkly", "statsig", "growthbook", "none"]
})

// Derived atom: available experiment providers based on analytics + flags
const availableExperimentsAtom = Atom.make((get) => {
  const analytics = get(analyticsAtom)
  const flags = get(flagsAtom)
  if (flags === "none") return ["none"]
  const options: string[] = []
  if (analytics === "posthog" && flags === "posthog") options.push("posthog")
  if (flags !== "none") options.push("statsig")
  if (analytics === "amplitude") options.push("amplitude")
  if (flags === "growthbook") options.push("growthbook")
  options.push("none")
  return options
})

// Derived atom: soft constraint warnings
const constraintWarningsAtom = Atom.make((get) => {
  const warnings: string[] = []
  const analytics = get(analyticsAtom)
  const flags = get(flagsAtom)
  const crm = get(crmAtom)
  const iac = get(iacAtom)

  if (analytics === "posthog" && flags !== "posthog" && flags !== "none")
    warnings.push("PostHog Flags recommended when using PostHog Analytics")
  if (crm !== "none" && iac === "none")
    warnings.push("IaC recommended when using a CRM provider")

  return warnings
})

// ── Dynamic List Atoms ─────────────────────────────────────────

const plansAtom = Atom.make<ReadonlyArray<PlanConfig>>([])
const eventsAtom = Atom.make<ReadonlyArray<EventConfig>>([])
const featureFlagsAtom = Atom.make<ReadonlyArray<FeatureFlagConfig>>([])
const surveysConfigAtom = Atom.make<ReadonlyArray<SurveyConfig>>([])
const crmAttributesAtom = Atom.make<ReadonlyArray<CrmAttributeConfig>>([])

// ── Effectful Atom: Code Generation ────────────────────────────

const generatedCodeAtom = Atom.make(
  Effect.gen(function* (get) {
    const config = yield* assembleConfig(get)
    const validated = yield* Schema.decodeUnknown(PlgBuilderConfig)(config)
    const files = yield* generatePlgCode(validated)
    const command = composeShadcnCommand(validated)
    return { files, command }
  })
)
// Returns Result<{ files, command }, ParseError>
```

### 22.3 React Component Integration

```tsx
function AnalyticsSelector() {
  const value = useAtomValue(analyticsAtom)
  const set = useAtomSet(analyticsAtom)
  const available = useAtomValue(availableFlagsAtom) // derived atom auto-recomputes

  return (
    <RadioGroup value={value} onValueChange={set}>
      <RadioGroupItem value="posthog" label="PostHog" />
      <RadioGroupItem value="amplitude" label="Amplitude" />
      <RadioGroupItem value="mixpanel" label="Mixpanel" />
      <RadioGroupItem value="segment" label="Segment" />
      <RadioGroupItem value="none" label="None" />
    </RadioGroup>
  )
}

function CodePreview() {
  const result = useAtomValue(generatedCodeAtom)
  // result is Result<{ files, command }, ParseError>
  // Auto-recomputes when any dependency atom changes

  return Result.match(result, {
    onSuccess: ({ files, command }) => (
      <div>
        <CodeBlock code={command} language="bash" />
        {[...files].map(([path, content]) => (
          <CodeBlock key={path} code={content} language="typescript" title={path} />
        ))}
      </div>
    ),
    onFailure: (error) => <ValidationErrors error={error} />,
  })
}
```

### 22.4 effect-atom + XState Integration

XState manages the wizard flow and structural state transitions; effect-atom manages the reactive data and UI binding. They connect via the XState `useActor` hook writing to effect-atom atoms:

```typescript
// XState handles: which step is active, transition guards, cascade resets
// effect-atom handles: reactive data flow, derived constraints, code generation

const [xstate, send] = useActor(plgBuilderMachine)

// When XState cascade resets a value, update the atom
useEffect(() => {
  if (xstate.context.featureFlags !== useAtomValue(flagsAtom)) {
    useAtomSet(flagsAtom)(xstate.context.featureFlags)
  }
}, [xstate.context.featureFlags])
```

### 22.5 Atom.runtime for Effect Services

effect-atom's `Atom.runtime` bridges Effect Layers/Services into the atom system, allowing atoms to access the same services used by the CLI:

```typescript
// Bridge the shared PLG services into the atom system
const PlgRuntime = Atom.runtime(
  Layer.mergeAll(
    PlgBuilderService.Live,
    CodegenService.Live,
    ConstraintService.Live,
  )
)

// Effectful atom that uses services
const validationResultAtom = Atom.make(
  Effect.gen(function* () {
    const builder = yield* PlgBuilderService
    const config = yield* builder.assembleConfig()
    return yield* builder.validate(config)
  })
)
```

---

## 23. Application Architecture (TanStack Start + Fumadocs)

The PLG builder is a **TanStack Start** application with **Fumadocs** for documentation, following the same patterns as the existing `apps/docs` in this monorepo. The app serves three roles: interactive builder, documentation site, and registry host.

### 23.1 App Structure

```
apps/plg/
├── content/
│   └── docs/                          # Fumadocs MDX content
│       ├── getting-started/
│       │   ├── index.mdx              # Quick start guide
│       │   ├── installation.mdx       # CLI + registry installation
│       │   └── first-stack.mdx        # Build your first PLG stack
│       ├── concepts/
│       │   ├── analytics.mdx          # Analytics service overview
│       │   ├── feature-flags.mdx      # Feature flags overview
│       │   ├── experiments.mdx        # Experimentation overview
│       │   ├── surveys.mdx            # Surveys overview
│       │   ├── crm.mdx               # CRM integration overview
│       │   └── iac.mdx               # Infrastructure as Code overview
│       ├── providers/
│       │   ├── posthog.mdx            # PostHog provider docs
│       │   ├── attio.mdx             # Attio provider docs
│       │   ├── launchdarkly.mdx       # LaunchDarkly provider docs
│       │   └── growthbook.mdx         # GrowthBook provider docs
│       ├── api-reference/
│       │   ├── schemas.mdx            # Effect Schema API reference
│       │   ├── branded-types.mdx      # Branded type taxonomy
│       │   └── services.mdx           # Abstract service interfaces
│       └── meta.json                  # Fumadocs navigation structure
│
├── source.config.ts                    # Fumadocs MDX configuration
│   defineDocs({
│     dir: "content/docs",
│     docs: { postprocess: { includeProcessedMarkdown: true } },
│   })
│
├── src/
│   ├── routes/
│   │   ├── __root.tsx                 # Root layout with RootProvider
│   │   ├── index.tsx                  # Landing page → redirect to /new or /docs
│   │   │
│   │   ├── new/                       # Builder routes
│   │   │   └── index.tsx              # Interactive PLG builder page
│   │   │
│   │   ├── docs/
│   │   │   └── $.tsx                  # Fumadocs catch-all (MDX pages)
│   │   │
│   │   ├── api/
│   │   │   ├── search.ts             # Fumadocs search endpoint
│   │   │   └── generate.ts           # Server function: config → generated files
│   │   │
│   │   ├── r/                         # Registry hosting
│   │   │   └── $.ts                   # Dynamic registry-item JSON endpoint
│   │   │
│   │   ├── llms[.]mdx.docs.$.ts      # LLM-friendly doc format
│   │   └── llms-full[.]txt.ts         # Full text export for LLMs
│   │
│   ├── components/
│   │   ├── builder/
│   │   │   ├── builder-page.tsx       # Main builder layout (categories + preview)
│   │   │   ├── preset-bar.tsx         # Preset selection bar
│   │   │   ├── category-card.tsx      # Reusable selection card component
│   │   │   ├── provider-selector.tsx  # Single-select provider radio group
│   │   │   ├── dynamic-list.tsx       # Add/remove item list (plans, flags, events)
│   │   │   ├── item-form.tsx          # Per-item form (uses React Hook Form + effectTsResolver)
│   │   │   ├── code-preview.tsx       # Live code preview panel (Shiki)
│   │   │   ├── cli-command.tsx        # CLI command display + copy button
│   │   │   ├── constraint-warnings.tsx # Soft constraint warning toasts
│   │   │   └── generate-button.tsx    # Generate + download/copy actions
│   │   │
│   │   ├── mdx/
│   │   │   ├── code-block.tsx         # Custom code block (from docs template)
│   │   │   └── mermaid.tsx            # Mermaid diagram renderer
│   │   │
│   │   └── ai/
│   │       └── page-actions.tsx       # LLM copy button (from docs template)
│   │
│   ├── lib/
│   │   ├── source.ts                  # Fumadocs source loader
│   │   ├── layout.shared.tsx          # Shared layout options (nav, links)
│   │   ├── atoms.ts                   # effect-atom state definitions
│   │   ├── machine.ts                 # XState builder machine
│   │   └── cn.ts                      # className utility
│   │
│   ├── router.tsx                     # TanStack Router configuration
│   ├── routeTree.gen.ts               # Auto-generated route tree
│   └── start.ts                       # Middleware (path rewriting)
│
├── public/
│   └── r/                             # Static registry items (built)
│       ├── core.json
│       ├── posthog.json
│       ├── posthog-iac.json
│       ├── attio.json
│       └── attio-iac.json
│
├── vite.config.ts                      # Vite + TanStack Start + Fumadocs MDX
├── package.json
├── tsconfig.json
└── components.json                     # shadcn configuration
```

### 23.2 Vite Configuration

Following the existing `apps/docs/vite.config.ts` pattern:

```typescript
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import mdx from "fumadocs-mdx/vite"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"
import mkcert from "vite-plugin-mkcert"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig(async ({ command }) => ({
  server: { port: 3002 },
  resolve: { conditions: ["@packages/source"] },
  plugins: [
    mdx(await import("./source.config")),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    mkcert(),
    tanstackStart({ srcDirectory: "src" }),
    viteReact(),
    command === "build"
      ? nitro({ preset: "vercel", vercel: { functions: { runtime: "bun1.x" } } })
      : null,
  ],
}))
```

### 23.3 Root Layout

```tsx
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { RootProvider } from "fumadocs-ui/provider/tanstack"
import { AtomProvider } from "effect-atom/React"

export const Route = createRootRoute({ component: RootComponent })

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <AtomProvider>
            <Outlet />
          </AtomProvider>
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

### 23.4 Builder Route (`/new`)

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { BuilderPage } from "@/components/builder/builder-page"

export const Route = createFileRoute("/new/")({
  component: BuilderPage,
  // URL query params managed by nuqs + effect-atom (Atom.searchParam)
})
```

### 23.5 Docs Route (`/docs/$`)

Identical to the existing `apps/docs/src/routes/docs/$.tsx` — Fumadocs catch-all route with `createServerFn`, `clientLoader`, and `DocsLayout`:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import browserCollections from "fumadocs-mdx:collections/browser"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page"
import defaultMdxComponents from "fumadocs-ui/mdx"
import { source } from "@/lib/source"
import { baseOptions } from "@/lib/layout.shared"

// Same pattern as apps/docs — serverFn loader + clientLoader for MDX
```

### 23.6 Dynamic Registry Endpoint (`/r/$`)

A TanStack Start server function that dynamically generates registry-item JSON from query parameters:

```typescript
import { createServerFn } from "@tanstack/react-start"
import { Schema } from "effect"

// GET /r/plg.json?analytics=posthog&flags=posthog&crm=attio
const registryHandler = createServerFn({ method: "GET" })
  .inputValidator((params: { config: string }) => params)
  .handler(async ({ data }) => {
    const config = Schema.decodeUnknownSync(PlgBuilderConfig)(
      JSON.parse(atob(data.config))
    )
    const files = generatePlgCode(config)
    return buildRegistryItemJson(config, files)
  })
```

This enables the dynamic registry URL pattern:
```bash
npx shadcn add https://plg-stack.dev/r/plg.json?config=<base64>
```

### 23.7 Navigation Structure

```tsx
// src/lib/layout.shared.tsx
export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "PLG Stack" },
    githubUrl: "https://github.com/your-org/plg-stack",
    links: [
      { text: "Builder", url: "/new", active: "nested-url" },
      { text: "Documentation", url: "/docs", active: "nested-url" },
    ],
  }
}
```

### 23.8 Package Dependencies

```json
{
  "name": "plg-app",
  "dependencies": {
    "@tanstack/react-router": "catalog:tanstack",
    "@tanstack/react-start": "catalog:tanstack",
    "fumadocs-core": "latest",
    "fumadocs-mdx": "latest",
    "fumadocs-ui": "latest",
    "effect": "^3.19.0",
    "effect-atom": "^0.5.0",
    "xstate": "^5.0.0",
    "@xstate/react": "^4.0.0",
    "@hookform/resolvers": "^3.0.0",
    "react-hook-form": "^7.0.0",
    "shiki": "^1.0.0",
    "nuqs": "^2.0.0",
    "next-themes": "^0.4.0",
    "lucide-react": "^0.468.0",
    "react": "catalog:react",
    "react-dom": "catalog:react",
    "@packages/plg-builder-core": "workspace:*",
    "@packages/ui": "workspace:*"
  }
}
```

### 23.9 Shared Core Package

The `plg-builder-core` package contains all logic shared between the web app and CLI:

```
packages/plg-builder-core/
├── src/
│   ├── schemas/                       # Effect Schema definitions
│   │   ├── config.ts                  # PlgBuilderConfig (full schema)
│   │   ├── plan.ts                    # PlanConfig schema
│   │   ├── event.ts                   # EventConfig schema
│   │   ├── feature-flag.ts            # FeatureFlagConfig (discriminated union)
│   │   ├── survey.ts                  # SurveyConfig + SurveyQuestionConfig
│   │   ├── crm.ts                     # CrmAttributeConfig schema
│   │   └── fields.ts                  # ConstantKey, KebabValue branded types
│   │
│   ├── constraints/                   # Constraint DAG + cascade rules
│   │   ├── graph.ts                   # Effect Graph constraint DAG definition
│   │   ├── guards.ts                  # XState guard functions (exported for both UI and tests)
│   │   ├── cascades.ts                # Cascade rule definitions
│   │   └── availability.ts            # Option availability matrices
│   │
│   ├── generators/                    # Code generation (pure functions)
│   │   ├── events.ts                  # generateEventsFile
│   │   ├── feature-flags.ts           # generateFeatureFlagsFile
│   │   ├── plans.ts                   # generatePlansFile
│   │   ├── surveys.ts                 # generateSurveysFile
│   │   ├── crm.ts                     # generateCrmFile
│   │   ├── iac-stack.ts               # generateIacStackFile
│   │   ├── sdk.ts                     # generateTrackFile, generateIdentifyFile
│   │   ├── barrel.ts                  # generateBarrelFile
│   │   ├── registry-item.ts           # buildRegistryItemJson
│   │   └── index.ts                   # generatePlgCode (orchestrator)
│   │
│   ├── presets/                       # Preset configurations
│   │   ├── minimal.ts
│   │   ├── growth.ts
│   │   ├── full.ts
│   │   ├── enterprise.ts
│   │   ├── self-hosted.ts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── derive-keys.ts            # Name → ConstantKey + KebabValue derivation
│   │   ├── to-pascal-case.ts
│   │   └── compose-command.ts         # composeShadcnCommand
│   │
│   └── index.ts                       # Public API barrel
│
├── test/                              # Comprehensive tests
│   ├── schemas.test.ts                # Schema validation tests
│   ├── generators.test.ts             # Snapshot tests for generated code
│   ├── constraints.test.ts            # Constraint graph + cascade tests
│   └── round-trip.test.ts             # Encode → decode round-trip tests
│
├── package.json
└── tsconfig.json
```

### 23.10 CLI Package

```
packages/plg-cli/
├── src/
│   ├── commands/
│   │   ├── create.ts                  # Main create command (flags + wizard)
│   │   ├── list-presets.ts            # List available presets
│   │   └── validate.ts               # Validate a config JSON file
│   │
│   ├── prompts/
│   │   ├── providers.ts              # Provider selection prompts
│   │   ├── pricing.ts                # Pricing + plans prompts
│   │   ├── events.ts                 # Event selection prompts
│   │   ├── flags.ts                  # Feature flag creation prompts
│   │   └── wizard.ts                 # Full wizard flow (Effect.gen)
│   │
│   ├── bin.ts                         # Entry point: Command.run(plgCli, ...)
│   └── index.ts
│
├── package.json                       # bin: { "create-plg-stack": "./src/bin.ts" }
└── tsconfig.json
```

---

## Appendix A: Research References

- [Effect TypeScript Documentation](https://effect.website)
- [ShadCN Registry Documentation](https://ui.shadcn.com/docs/registry)
- [Alchemy-Effect Framework](https://github.com/alchemy-ts/alchemy)
- [PostHog API Reference](https://posthog.com/docs/api)
- [Attio API Reference](https://docs.attio.com)
- [OpenFeature Specification](https://openfeature.dev)
- [Better T Stack Builder](https://www.better-t-stack.dev/new)
- [create-better-t-stack Source](https://github.com/AmanVarshney01/create-better-t-stack)
- [Effect Graph Module (experimental)](https://effect.website)
- [ts-morph Documentation](https://ts-morph.com/)
- [XState v5 Documentation](https://stately.ai/docs)
- [Typeonce.dev — XState + Effect patterns](https://typeonce.dev)
- [Effect Schema Error Formatters](https://effect.website/docs/schema/error-formatters/)
- [react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form)
- [@hookform/resolvers — Effect Schema resolver](https://github.com/react-hook-form/resolvers)
- [LaunchDarkly Flag Conventions](https://launchdarkly.com/docs/guides/flags/flag-conventions)
- [@effect/cli Documentation](https://effect.website/docs/platform/cli/)
- [effect-atom (formerly effect-rx)](https://github.com/tim-smart/effect-atom)

## Appendix B: Research Documents

- `prds/plg/research-codebase.md` — Existing codebase structure and patterns
- `prds/plg/research-effect-patterns.md` — Effect Layer/Service/Schema patterns + branded types
- `prds/plg/research-plg-domain.md` — PLG domain entities with Effect Schema definitions
- `prds/plg/research-shadcn-registry.md` — ShadCN registry distribution approach
- `prds/plg/research-alchemy-providers.md` — Alchemy-effect resource patterns
- `prds/plg/research-better-t-stack-builder.md` — Better T Stack builder architecture analysis
- `prds/plg/research-effect-graph-state.md` — Effect Graph/SubscriptionRef/Match primitives
- `prds/plg/research-codegen-patterns.md` — Code generation approaches and recommendations
- `prds/plg/research-plg-builder-options.md` — Builder categories, constraints, and presets
- `prds/plg/research-xstate-typeonce.md` — Typeonce.dev XState + Effect integration patterns
- `prds/plg/research-xstate-effect.md` — XState v5 guards, always transitions, and Effect hybrid architecture
- `prds/plg/research-effect-dynamic-codegen.md` — Effect Schema for dynamic user input validation and code generation
- `prds/plg/research-dynamic-builder-ux.md` — Dynamic builder UX patterns from production tools
- `prds/plg/research-effect-cli.md` — @effect/cli package: Commands, Options, Prompts, wizard flows
- `prds/plg/research-effect-atom.md` — effect-atom (Tim Smart): atomic reactive state for Effect + React
- `prds/plg/research-tanstack-fumadocs-app.md` — TanStack Start + Fumadocs app patterns from existing apps/docs
