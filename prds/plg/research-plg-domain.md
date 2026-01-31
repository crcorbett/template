# PLG Domain Model Research

## What is PLG?

PLG (Product-Led Growth) is a business strategy where the product itself is the primary driver of customer acquisition, activation, retention, revenue expansion, and referral. Rather than relying on sales teams or marketing campaigns as the primary growth engine, PLG companies instrument their product to convert free users into paying customers through the product experience.

## AARRR Pirate Metrics Framework

PLG maps to the AARRR funnel:

| Stage | Metric | Example |
|-------|--------|---------|
| **Acquisition** | How users find the product | Signup rate, landing page conversion |
| **Activation** | First "aha moment" | Completed onboarding, first key action |
| **Retention** | Users coming back | DAU/MAU, session frequency |
| **Revenue** | Users paying | Conversion rate, MRR, ARPU |
| **Referral** | Users inviting others | Invite rate, viral coefficient |

## Core PLG Stack Components

### 1. Analytics (Event Tracking, User Identification, Sessions)

The foundation of PLG. Every user action is captured as a typed event with properties.

**Tools**: PostHog, Amplitude, Mixpanel, Google Analytics

```typescript
// Typed event tracking
track("feature_used", {
  feature_name: "dashboard_builder",
  plan: "pro",
  session_duration_seconds: 342,
})
```

### 2. Feature Flags (Boolean/Multivariate Toggles, Rollout, Targeting)

Control feature visibility based on user properties, cohort membership, or percentage rollout.

**Tools**: PostHog, LaunchDarkly, Statsig, Unleash

```typescript
// Boolean flag
if (isFeatureEnabled("new_onboarding_flow", user)) {
  showNewOnboarding()
}

// Multivariate flag
const variant = getFeatureFlag("pricing_page", user)
// variant: "control" | "variant_a" | "variant_b"
```

### 3. Experimentation (A/B Tests, Statistical Analysis, Goal Metrics)

Run controlled experiments to measure the impact of changes on key metrics.

**Tools**: PostHog, Amplitude Experiment, Optimizely, Statsig

```typescript
// Experiment definition
{
  name: "Onboarding Flow v2",
  feature_flag_key: "new_onboarding_flow",
  parameters: {
    variants: ["control", "test"],
    goal_metrics: ["activation_rate", "7_day_retention"],
    minimum_sample_size: 1000,
  }
}
```

### 4. Surveys (NPS, CSAT, Exit Surveys, In-App Feedback)

Collect qualitative feedback directly in the product experience.

**Tools**: PostHog Surveys, Hotjar, Typeform, Delighted

```typescript
// Survey targeting
{
  name: "NPS Survey",
  type: "popover",
  questions: [{ type: "rating", scale: 10 }],
  targeting: {
    cohort: "active_users_30d",
    trigger: "page_view",
    url_match: "/dashboard",
  }
}
```

### 5. CRM (Contacts, Companies, Deals, Pipelines, Lifecycle Stages)

Track and manage customer relationships, enriched with product usage data.

**Tools**: Attio, HubSpot, Salesforce, Pipedrive

```typescript
// CRM record enriched with product data
{
  contact: {
    email: "user@company.com",
    lifecycle_stage: "product_qualified_lead",
    health_score: 85,
    mrr: 49,
    last_active: "2025-01-15",
    feature_adoption: ["dashboards", "experiments", "api"],
  }
}
```

### 6. Customer Data Platform (Event Routing, Identity Resolution, Audiences)

Unifies user data across tools and routes events to downstream systems.

**Tools**: Segment, RudderStack, mParticle, Jitsu

```typescript
// CDP event routing
identify("user_123", { email: "user@company.com", plan: "pro" })
// -> PostHog (analytics)
// -> Attio (CRM)
// -> Intercom (support)
// -> Stripe (billing)
```

### 7. Dashboards/Insights (Funnels, Retention, Cohort Analysis, Trends)

Visualize product usage data to inform decisions.

**Tools**: PostHog, Amplitude, Mixpanel, Metabase

```typescript
// Insight types
type InsightKind =
  | "TrendsQuery"       // Time series of event counts
  | "FunnelsQuery"      // Multi-step conversion rates
  | "RetentionQuery"    // Cohort retention curves
  | "PathsQuery"        // User navigation flows
  | "StickinessQuery"   // How often users perform action
  | "LifecycleQuery"    // New/returning/dormant/resurrecting
```

## Common Abstractions Across Tools

These domain entities appear across virtually all PLG tools, making them good candidates for a unified abstraction layer. All abstractions below use **Effect Schema with branded types** — no raw TypeScript interfaces. Types are derived from schemas via `typeof Schema.Type`.

### Event
A tracked user action with typed properties. All identifiers are branded.

```typescript
import { Schema } from "effect"

const EventName = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,99}$/),
  Schema.brand("EventName")
)
type EventName = typeof EventName.Type

const DistinctId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(200),
  Schema.brand("DistinctId")
)
type DistinctId = typeof DistinctId.Type

const EventProperties = Schema.Record({ key: Schema.String, value: Schema.Unknown })
type EventProperties = typeof EventProperties.Type

const EventTimestamp = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  Schema.brand("EventTimestamp")
)
type EventTimestamp = typeof EventTimestamp.Type

const Event = Schema.Struct({
  name: EventName,
  distinctId: DistinctId,
  properties: EventProperties,
  timestamp: EventTimestamp,
})
type Event = typeof Event.Type
```

### User / Person
An identified individual with traits/properties.

```typescript
const UserEmail = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("UserEmail")
)
type UserEmail = typeof UserEmail.Type

const PlanId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,49}$/),
  Schema.brand("PlanId")
)
type PlanId = typeof PlanId.Type

const UserTraits = Schema.Record({ key: Schema.String, value: Schema.Unknown })
type UserTraits = typeof UserTraits.Type

const Person = Schema.Struct({
  distinctId: DistinctId,
  email: Schema.optional(UserEmail),
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  plan: Schema.optional(PlanId),
  createdAt: Schema.DateTimeUtc,
  traits: Schema.optional(UserTraits),
})
type Person = typeof Person.Type
```

### Cohort / Segment
A group of users defined by behavior or traits.

```typescript
const CohortId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("CohortId")
)
type CohortId = typeof CohortId.Type

const Cohort = Schema.Struct({
  id: Schema.optional(CohortId),
  name: Schema.String.pipe(Schema.minLength(1)),
  groups: Schema.Array(Schema.Struct({
    properties: Schema.Array(Schema.Unknown),  // PropertyFilter[]
    actions: Schema.Array(Schema.Unknown),     // ActionFilter[]
  })),
})
type Cohort = typeof Cohort.Type
```

### Feature Flag
Conditional feature visibility with targeting rules.

```typescript
const FlagKey = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,99}$/),
  Schema.brand("FlagKey")
)
type FlagKey = typeof FlagKey.Type

const RolloutPercentage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("RolloutPercentage")
)
type RolloutPercentage = typeof RolloutPercentage.Type

const VariantKey = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,49}$/),
  Schema.brand("VariantKey")
)
type VariantKey = typeof VariantKey.Type

const FeatureFlag = Schema.Struct({
  key: FlagKey,
  name: Schema.String.pipe(Schema.minLength(1)),
  active: Schema.Boolean,
  filters: Schema.Struct({
    groups: Schema.Array(Schema.Struct({
      properties: Schema.Array(Schema.Unknown),
      rolloutPercentage: RolloutPercentage,
    })),
    multivariate: Schema.optional(Schema.Struct({
      variants: Schema.NonEmptyArray(Schema.Struct({
        key: VariantKey,
        rolloutPercentage: RolloutPercentage,
      })),
    })),
  }),
})
type FeatureFlag = typeof FeatureFlag.Type
```

### Experiment
A controlled test with variants and goal metrics.

```typescript
const ExperimentKey = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,99}$/),
  Schema.brand("ExperimentKey")
)
type ExperimentKey = typeof ExperimentKey.Type

const GoalMetric = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,99}$/),
  Schema.brand("GoalMetric")
)
type GoalMetric = typeof GoalMetric.Type

const SampleSize = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("SampleSize")
)
type SampleSize = typeof SampleSize.Type

const Experiment = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  key: ExperimentKey,
  featureFlagKey: FlagKey,
  startDate: Schema.DateTimeUtc,
  endDate: Schema.optional(Schema.DateTimeUtc),
  variants: Schema.NonEmptyArray(VariantKey),
  goalMetrics: Schema.NonEmptyArray(GoalMetric),
  minimumSampleSize: Schema.optional(SampleSize),
})
type Experiment = typeof Experiment.Type
```

### Survey
User feedback collection mechanism.

```typescript
const SurveyId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("SurveyId")
)
type SurveyId = typeof SurveyId.Type

const QuestionText = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(1000),
  Schema.brand("QuestionText")
)
type QuestionText = typeof QuestionText.Type

const SurveyDisplayType = Schema.Literal(
  "popover", "widget", "full_screen", "email", "api"
).pipe(Schema.brand("SurveyDisplayType"))
type SurveyDisplayType = typeof SurveyDisplayType.Type

const SurveyQuestionType = Schema.Literal(
  "open", "rating", "nps", "csat", "single_choice", "multiple_choice"
).pipe(Schema.brand("SurveyQuestionType"))
type SurveyQuestionType = typeof SurveyQuestionType.Type

const NpsScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(10),
  Schema.brand("NpsScore")
)
type NpsScore = typeof NpsScore.Type

const CsatScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(5),
  Schema.brand("CsatScore")
)
type CsatScore = typeof CsatScore.Type

const Survey = Schema.Struct({
  id: Schema.optional(SurveyId),
  name: Schema.String.pipe(Schema.minLength(1)),
  displayType: SurveyDisplayType,
  questions: Schema.NonEmptyArray(Schema.Struct({
    type: SurveyQuestionType,
    text: QuestionText,
    choices: Schema.optional(Schema.Array(Schema.String.pipe(Schema.minLength(1)))),
  })),
  targeting: Schema.optional(Schema.Struct({
    cohort: Schema.optional(CohortId),
    urlMatch: Schema.optional(Schema.String),
    trigger: Schema.optional(EventName),
  })),
})
type Survey = typeof Survey.Type
```

### Dashboard
A collection of insights/charts.

```typescript
const DashboardId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("DashboardId")
)
type DashboardId = typeof DashboardId.Type

const InsightId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("InsightId")
)
type InsightId = typeof InsightId.Type

const TilePosition = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("TilePosition")
)
type TilePosition = typeof TilePosition.Type

const TileDimension = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("TileDimension")
)
type TileDimension = typeof TileDimension.Type

const Dashboard = Schema.Struct({
  id: Schema.optional(DashboardId),
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  tiles: Schema.Array(Schema.Struct({
    insightId: InsightId,
    layout: Schema.Struct({
      x: TilePosition,
      y: TilePosition,
      w: TileDimension,
      h: TileDimension,
    }),
  })),
})
type Dashboard = typeof Dashboard.Type
```

### Insight
A single analytics visualization.

```typescript
const InsightType = Schema.Literal(
  "trend", "funnel", "retention", "paths", "stickiness", "lifecycle", "formula"
).pipe(Schema.brand("InsightType"))
type InsightType = typeof InsightType.Type

const Insight = Schema.Struct({
  id: Schema.optional(InsightId),
  name: Schema.String.pipe(Schema.minLength(1)),
  type: InsightType,
  query: Schema.Unknown,  // Provider-specific query format
  dashboardId: Schema.optional(DashboardId),
})
type Insight = typeof Insight.Type
```

### Action
A server-side event definition (groups raw events into meaningful actions).

```typescript
const ActionId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("ActionId")
)
type ActionId = typeof ActionId.Type

const UrlMatchType = Schema.Literal("exact", "contains", "regex").pipe(
  Schema.brand("UrlMatchType")
)
type UrlMatchType = typeof UrlMatchType.Type

const Action = Schema.Struct({
  id: Schema.optional(ActionId),
  name: Schema.String.pipe(Schema.minLength(1)),
  steps: Schema.NonEmptyArray(Schema.Struct({
    event: EventName,
    url: Schema.optional(Schema.String),
    urlMatching: Schema.optional(UrlMatchType),
    properties: Schema.optional(Schema.Array(Schema.Unknown)),
  })),
})
type Action = typeof Action.Type
```

### Customer / Contact (CRM)
A CRM entity with branded attributes for all business metrics.

```typescript
const CustomerId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("CustomerId")
)
type CustomerId = typeof CustomerId.Type

const LifecycleStage = Schema.Literal(
  "lead", "trial", "activated", "pql", "customer", "expanding", "at_risk", "churned"
).pipe(Schema.brand("LifecycleStage"))
type LifecycleStage = typeof LifecycleStage.Type

const HealthScore = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("HealthScore")
)
type HealthScore = typeof HealthScore.Type

const MrrCents = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("MrrCents")
)
type MrrCents = typeof MrrCents.Type

const Contact = Schema.Struct({
  id: CustomerId,
  email: UserEmail,
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  company: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  lifecycleStage: LifecycleStage,
  healthScore: HealthScore,
  mrr: MrrCents,
  traits: Schema.optional(UserTraits),
})
type Contact = typeof Contact.Type
```

### Deal / Opportunity (CRM)
A revenue pipeline entity with branded monetary values.

```typescript
const DealValueCents = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("DealValueCents")
)
type DealValueCents = typeof DealValueCents.Type

const PipelineStage = Schema.Literal(
  "discovery", "evaluation", "negotiation", "closed_won", "closed_lost"
).pipe(Schema.brand("PipelineStage"))
type PipelineStage = typeof PipelineStage.Type

const Deal = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  contactId: CustomerId,
  companyId: CustomerId,
  stage: PipelineStage,
  value: DealValueCents,
  closeDate: Schema.DateTimeUtc,
})
type Deal = typeof Deal.Type
```

### Summary: Branded Type Coverage

| Entity | Branded Fields | Protection Provided |
|--------|---------------|-------------------|
| Event | EventName, DistinctId, EventTimestamp | No raw strings for events/IDs |
| Person | DistinctId, UserEmail, PlanId | Email validation, ID safety |
| Cohort | CohortId | ID integrity |
| FeatureFlag | FlagKey, VariantKey, RolloutPercentage | Key format, 0-100 range |
| Experiment | ExperimentKey, GoalMetric, SampleSize | Key format, positive integer |
| Survey | SurveyId, QuestionText, NpsScore, CsatScore | Score ranges, text length |
| Dashboard | DashboardId, InsightId, TilePosition, TileDimension | Positive dimensions |
| Action | ActionId, EventName, UrlMatchType | Enum safety |
| Contact | CustomerId, UserEmail, LifecycleStage, HealthScore, MrrCents | Score/money ranges |
| Deal | DealValueCents, PipelineStage, CustomerId | Money can't be confused with scores |

## Data Flow

```
User Actions
    |
Event Tracking (Analytics)
    |
Insights & Dashboards (Visualization)
    |
Cohort Building (Segmentation)
    |
Experiments (Testing)          Surveys (Feedback)
    |                              |
Feature Flags (Delivery)       Product Improvements
    |
User Experience
    |
(cycle repeats)
```

## Cross-System Sync

A critical PLG pattern is syncing analytics data into the CRM:

```
PostHog Event (e.g., "upgraded_plan")
    | webhook / automation
Attio CRM Update:
    - lifecycle_stage -> "customer"
    - mrr -> 49
    - plan -> "pro"
    - last_active -> now()
    - health_score -> recalculate()
```

Common sync triggers:
- **Signup** -- Create CRM contact, set lifecycle_stage = "lead"
- **Activation** -- Update lifecycle_stage = "activated"
- **Feature adoption** -- Update feature_adoption array, recalculate health score
- **Upgrade** -- Update lifecycle_stage = "customer", set MRR
- **Churn signals** -- Update health_score, flag for outreach
- **NPS response** -- Attach survey response to CRM contact

## Provider Mapping

| Capability | PostHog | Attio | Segment | LaunchDarkly |
|-----------|---------|-------|---------|-------------|
| Analytics | Yes | - | Routing | - |
| Feature Flags | Yes | - | - | Yes |
| Experiments | Yes | - | - | - |
| Surveys | Yes | - | - | - |
| Dashboards | Yes | - | - | - |
| Insights | Yes | - | - | - |
| CRM | - | Yes | - | - |
| CDP | - | - | Yes | - |

PostHog covers the largest surface area for a PLG stack (analytics + flags + experiments + surveys + dashboards + insights), making it the natural primary provider. Attio provides the CRM layer. Segment handles cross-tool event routing.
