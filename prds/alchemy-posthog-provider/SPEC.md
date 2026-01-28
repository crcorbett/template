# alchemy-effect PostHog Provider

**Status**: Design Complete - Ready for Implementation  
**Created**: 2025-01-28  
**Updated**: 2025-01-28  
**Owner**: Platform Team  
**Priority**: High  
**Epic**: Infrastructure-as-Effects Provider Expansion

---

## 1. Overview

### 1.1 Purpose

Create a PostHog cloud provider for alchemy-effect that enables PostHog resources (feature flags, dashboards, experiments, surveys, cohorts, actions, annotations, insights) to be managed as Infrastructure-as-Effects, following the same zero-wrapping pattern used by the existing AWS and Cloudflare providers.

### 1.2 Problem Statement

Currently, PostHog resources (feature flags, experiments, dashboards, etc.) are managed manually through the PostHog UI or ad-hoc API scripts:

1. **No declarative management** — Feature flags and experiments cannot be version-controlled as code
2. **No lifecycle management** — No automated create/update/delete with drift detection
3. **No cross-resource dependencies** — Cannot express that an experiment depends on a feature flag
4. **Inconsistent state** — Manual changes can drift from intended configuration

### 1.3 Solution

1. **PostHog cloud provider** for alchemy-effect with 8 resource types
2. **Direct consumption** of `distilled-posthog` (`@packages/posthog`) — zero wrapping
3. **Stage config integration** — PostHog credentials, endpoint, and project ID from alchemy-effect's config system
4. **Full CRUD lifecycle** — create, read, update, delete, diff for each resource
5. **Integration tests** — TDD approach with real PostHog API verification

### 1.4 Scope

**In Scope:**
- PostHog provider infrastructure (config, credentials, endpoint, project)
- 8 resource types: FeatureFlag, Dashboard, Experiment, Survey, Cohort, Action, Annotation, Insight
- Resource contracts (Props, Attrs, Resource declarations)
- Resource providers (CRUD lifecycle implementations)
- Integration tests for each resource
- Package.json export entries

**Out of Scope:**
- Read-only resources (Events, Persons) — future phase
- Runtime bindings/capabilities (PostHog is SaaS, no IAM)
- Auto-generated documentation (docs/{cloud}/{service}/{resource}.md)
- UI components for PostHog resource management

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                PostHog Provider for alchemy-effect                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Code (alchemy-effect stack definition)                         │
│      │                                                               │
│      ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              alchemy-effect Engine                              │  │
│  │  apply() / destroy() / plan()                                  │  │
│  │  Resolves Resource → Provider → Lifecycle Operation             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                           │
│         ┌────────────────┼────────────────┐                         │
│         ▼                ▼                ▼                         │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐                 │
│  │ FeatureFlag │ │  Dashboard  │ │  Experiment  │  ... (8 total)   │
│  │  Provider   │ │  Provider   │ │   Provider   │                  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘                 │
│         │               │               │                           │
│         └───────────────┼───────────────┘                           │
│                         ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │            distilled-posthog (@packages/posthog)               │  │
│  │  Effect-native PostHog SDK                                     │  │
│  │  Functions: createFeatureFlag(), updateDashboard(), etc.       │  │
│  │  Requirements: HttpClient | Credentials | Endpoint             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                         │                                           │
│                         ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  PostHog REST API                               │  │
│  │  https://us.posthog.com/api/projects/{project_id}/...          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Package Structure

```
alchemy-effect/
  src/posthog/
    index.ts                              # Cloud-level composition
    config.ts                             # StageConfig module augmentation
    project.ts                            # Project Context.Tag (project_id)
    credentials.ts                        # Credentials bridge from stage config
    endpoint.ts                           # Endpoint bridge from stage config
    feature-flags/
      index.ts                            # Barrel exports
      feature-flag.ts                     # Resource contract
      feature-flag.provider.ts            # Provider implementation
    dashboards/
      index.ts
      dashboard.ts
      dashboard.provider.ts
    experiments/
      index.ts
      experiment.ts
      experiment.provider.ts
    surveys/
      index.ts
      survey.ts
      survey.provider.ts
    cohorts/
      index.ts
      cohort.ts
      cohort.provider.ts
    actions/
      index.ts
      action.ts
      action.provider.ts
    annotations/
      index.ts
      annotation.ts
      annotation.provider.ts
    insights/
      index.ts
      insight.ts
      insight.provider.ts
  test/posthog/
    feature-flags/
      feature-flag.provider.test.ts
    dashboards/
      dashboard.provider.test.ts
    experiments/
      experiment.provider.test.ts
    surveys/
      survey.provider.test.ts
    cohorts/
      cohort.provider.test.ts
    actions/
      action.provider.test.ts
    annotations/
      annotation.provider.test.ts
    insights/
      insight.provider.test.ts
```

### 2.3 Layer Architecture

```
providers()
  │
  ├── resources()
  │     ├── featureFlagProvider()
  │     ├── dashboardProvider()
  │     ├── experimentProvider()
  │     ├── surveyProvider()
  │     ├── cohortProvider()
  │     ├── actionProvider()
  │     ├── annotationProvider()
  │     └── insightProvider()
  │
  ├── Project.fromStageConfig()         # PostHog project ID
  ├── Credentials.fromStageConfig()     # PostHog API key (→ distilled-posthog Credentials)
  ├── Endpoint.fromStageConfig()        # PostHog API URL (→ distilled-posthog Endpoint)
  └── FetchHttpClient.layer             # HTTP client for @effect/platform
```

---

## 3. Functional Requirements

### 3.1 Shared Infrastructure

#### 3.1.1 Stage Config Augmentation (`config.ts`)

Augments `StageConfig` with PostHog-specific configuration:

```typescript
interface PostHogStageConfig {
  projectId: string;    // Required: PostHog project ID
  apiKey?: string;      // Optional: falls back to POSTHOG_API_KEY env var
  endpoint?: string;    // Optional: defaults to https://us.posthog.com
}
```

#### 3.1.2 Project Context.Tag (`project.ts`)

Provides PostHog project ID from stage config or `POSTHOG_PROJECT_ID` environment variable. Analogous to `AWS::AccountID` and `cloudflare/account-id`.

#### 3.1.3 Credentials Bridge (`credentials.ts`)

Reads API key from stage config (`posthog.apiKey`) or `POSTHOG_API_KEY` environment variable. Returns `distilled-posthog` `Credentials` Context.Tag value.

#### 3.1.4 Endpoint Bridge (`endpoint.ts`)

Reads endpoint from stage config (`posthog.endpoint`) or defaults to `https://us.posthog.com`. Returns `distilled-posthog` `Endpoint` Context.Tag value.

### 3.2 Resource Specifications

#### 3.2.1 FeatureFlag

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.FeatureFlags.FeatureFlag` | |
| **Delete** | Soft (PATCH `deleted: true`) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `key` | `string` | Yes | Yes | Unique feature flag key |
| `name` | `string` | No | No | Human-readable name |
| `active` | `boolean` | No | No | Whether flag is active |
| `filters` | `Record<string, unknown>` | No | No | Filter/rollout configuration |
| `rolloutPercentage` | `number \| null` | No | No | Rollout percentage (0-100) |
| `ensureExperienceContinuity` | `boolean \| null` | No | No | Session continuity |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `key` | `string` | Yes | Feature flag key |
| `name` | `string \| undefined` | No | Human-readable name |
| `active` | `boolean \| undefined` | No | Whether active |
| `filters` | `unknown \| undefined` | No | Filter config |
| `createdAt` | `string \| undefined` | No | ISO creation timestamp |

**Diff:** `key` change → `replace`. All other changes → update.

#### 3.2.2 Dashboard

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Dashboards.Dashboard` | |
| **Delete** | Soft (PATCH `deleted: true`) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `name` | `string` | Yes | No | Dashboard name |
| `description` | `string` | No | No | Description |
| `pinned` | `boolean` | No | No | Whether pinned |
| `tags` | `string[]` | No | No | Tags |
| `restrictionLevel` | `number` | No | No | Access restriction |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `name` | `string` | No | Dashboard name |
| `description` | `string \| undefined` | No | Description |
| `pinned` | `boolean \| undefined` | No | Whether pinned |
| `createdAt` | `string \| undefined` | No | ISO creation timestamp |

**Diff:** All prop changes → update. No replacement triggers.

#### 3.2.3 Experiment

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Experiments.Experiment` | |
| **Delete** | Hard (HTTP DELETE) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `name` | `string` | Yes | No | Experiment name |
| `description` | `string \| null` | No | No | Description |
| `featureFlagKey` | `string` | Yes | Yes | Associated feature flag key |
| `startDate` | `string \| null` | No | No | ISO start date |
| `endDate` | `string \| null` | No | No | ISO end date |
| `parameters` | `unknown \| null` | No | No | Variant configuration |
| `filters` | `unknown` | No | No | Filter configuration |
| `holdoutId` | `number \| null` | No | No | Holdout group ID |
| `type` | `"web" \| "product"` | No | No | Experiment type |
| `metrics` | `unknown \| null` | No | No | Primary metrics |
| `metricsSecondary` | `unknown \| null` | No | No | Secondary metrics |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `name` | `string` | No | Experiment name |
| `featureFlagKey` | `string \| undefined` | Yes | Feature flag key |
| `startDate` | `string \| null \| undefined` | No | ISO start date |
| `endDate` | `string \| null \| undefined` | No | ISO end date |
| `archived` | `boolean \| undefined` | No | Whether archived |
| `createdAt` | `string \| undefined` | No | ISO creation timestamp |

**Diff:** `featureFlagKey` change → `replace`. All other changes → update.

#### 3.2.4 Survey

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Surveys.Survey` | |
| **Delete** | Hard (HTTP DELETE) | |
| **ID type** | `string` (UUID, server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `name` | `string` | Yes | No | Survey name |
| `description` | `string` | No | No | Description |
| `type` | `"popover" \| "widget" \| "external_survey" \| "api"` | Yes | Yes | Survey type |
| `questions` | `unknown[]` | No | No | Survey questions |
| `appearance` | `unknown` | No | No | Visual appearance |
| `startDate` | `string \| null` | No | No | ISO start date |
| `endDate` | `string \| null` | No | No | ISO end date |
| `responsesLimit` | `number \| null` | No | No | Max responses |
| `linkedFlagId` | `number \| null` | No | No | Linked feature flag |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `string` | Yes | Server-generated UUID |
| `name` | `string` | No | Survey name |
| `type` | `string` | Yes | Survey type |
| `startDate` | `string \| null \| undefined` | No | ISO start date |
| `endDate` | `string \| null \| undefined` | No | ISO end date |
| `archived` | `boolean \| undefined` | No | Whether archived |
| `createdAt` | `string \| undefined` | No | ISO creation timestamp |

**Diff:** `type` change → `replace`. All other changes → update.

#### 3.2.5 Cohort

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Cohorts.Cohort` | |
| **Delete** | Soft (PATCH `deleted: true`) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `name` | `string \| null` | Yes | No | Cohort name |
| `description` | `string` | No | No | Description |
| `groups` | `unknown` | No | No | Group definitions |
| `filters` | `unknown` | No | No | Filter configuration |
| `isStatic` | `boolean` | No | Yes | Whether static (uploaded) cohort |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `name` | `string \| null \| undefined` | No | Cohort name |
| `description` | `string \| undefined` | No | Description |
| `isCalculating` | `boolean \| undefined` | No | Whether calculating |
| `count` | `number \| null \| undefined` | No | Person count |
| `createdAt` | `string \| null \| undefined` | No | ISO creation timestamp |

**Diff:** `isStatic` change → `replace`. All other changes → update.

#### 3.2.6 Action

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Actions.Action` | |
| **Delete** | Soft (PATCH `deleted: true`) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `name` | `string \| null` | Yes | No | Action name |
| `description` | `string` | No | No | Description |
| `tags` | `string[]` | No | No | Tags |
| `postToSlack` | `boolean` | No | No | Slack notification |
| `slackMessageFormat` | `string` | No | No | Slack message format |
| `steps` | `ActionStepDef[]` | No | No | Match steps |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `name` | `string \| null` | No | Action name |
| `description` | `string \| undefined` | No | Description |
| `tags` | `unknown[] \| undefined` | No | Tags |
| `createdAt` | `string \| undefined` | No | ISO creation timestamp |

**Diff:** All prop changes → update. No replacement triggers.

#### 3.2.7 Annotation

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Annotations.Annotation` | |
| **Delete** | Hard (HTTP DELETE) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `content` | `string \| null` | No | No | Annotation text |
| `dateMarker` | `string \| null` | No | No | ISO date position |
| `creationType` | `"USR" \| "GIT"` | No | No | Creation type |
| `dashboardItem` | `number \| null` | No | No | Attached insight ID |
| `scope` | `"dashboard_item" \| "dashboard" \| "project" \| "organization" \| "recording"` | No | No | Annotation scope |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `content` | `string \| null \| undefined` | No | Content text |
| `dateMarker` | `string \| null \| undefined` | No | ISO date marker |
| `scope` | `string \| undefined` | No | Scope |
| `createdAt` | `string \| null \| undefined` | No | ISO creation timestamp |

**Diff:** All prop changes → update. No replacement triggers.

#### 3.2.8 Insight

| Field | Type | Description |
|-------|------|-------------|
| **Type** | `PostHog.Insights.Insight` | |
| **Delete** | Soft (PATCH `deleted: true`) | |
| **ID type** | `number` (server-generated) | |

**Props:**

| Property | Type | Required | Replaces | Description |
|----------|------|----------|----------|-------------|
| `name` | `string \| null` | No | No | Insight name |
| `description` | `string \| null` | No | No | Description |
| `query` | `unknown` | No | No | HogQL/legacy query |
| `filters` | `unknown` | No | No | Legacy filters |
| `dashboards` | `number[]` | No | No | Attached dashboard IDs |
| `saved` | `boolean` | No | No | Whether saved |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `id` | `number` | Yes | Server-generated ID |
| `shortId` | `string \| undefined` | No | Short ID |
| `name` | `string \| null \| undefined` | No | Insight name |
| `description` | `string \| null \| undefined` | No | Description |
| `createdAt` | `string \| null \| undefined` | No | ISO creation timestamp |
| `favorited` | `boolean \| undefined` | No | Whether favorited |
| `saved` | `boolean \| undefined` | No | Whether saved |

**Diff:** All prop changes → update. No replacement triggers.

---

## 4. Non-Functional Requirements

### 4.1 Type Safety
- All resource contracts must be fully typed with Props and Attrs interfaces
- Provider implementations must satisfy the `ProviderService` interface
- Props → API request mapping must use explicit camelCase → snake_case conversion

### 4.2 Idempotency
- **Create**: Must handle "already exists" gracefully — PostHog generates IDs server-side, so the provider stores the ID in output attrs for subsequent operations
- **Delete**: Must catch `NotFoundError` and treat as success (already deleted)
- **Soft delete**: Resources using soft delete must PATCH with `deleted: true`, not call a nonexistent DELETE endpoint

### 4.3 Error Handling
- All lifecycle operations must use `Effect.catchTag("NotFoundError", ...)` for idempotency
- Never use `Effect.orDie` — this crashes the IaC engine
- Use `session.note()` for progress reporting during create/update

### 4.4 Build Verification
- All files must pass `bun tsc -b` (TypeScript build mode)
- Tests must pass `bun vitest run test/posthog/`

---

## 5. Technical Design

### 5.1 Property Mapping Convention

Props use camelCase; API requests use snake_case. Mapping is explicit in each provider:

| Props (camelCase) | API (snake_case) |
|---|---|
| `featureFlagKey` | `feature_flag_key` |
| `rolloutPercentage` | `rollout_percentage` |
| `startDate` | `start_date` |
| `endDate` | `end_date` |
| `responsesLimit` | `responses_limit` |
| `linkedFlagId` | `linked_flag_id` |
| `postToSlack` | `post_to_slack` |
| `slackMessageFormat` | `slack_message_format` |
| `dashboardItem` | `dashboard_item` |
| `dateMarker` | `date_marker` |
| `creationType` | `creation_type` |
| `restrictionLevel` | `restriction_level` |
| `isStatic` | `is_static` |
| `isCalculating` | `is_calculating` |
| `shortId` | `short_id` |
| `createdAt` | `created_at` |

### 5.2 Delete Strategy per Resource

| Resource | Strategy | Implementation |
|----------|----------|---------------|
| FeatureFlag | Soft | `FeatureFlags.deleteFeatureFlag()` (internally PATCHes deleted:true) |
| Dashboard | Soft | `Dashboards.deleteDashboard()` (internally PATCHes deleted:true) |
| Experiment | Hard | `Experiments.deleteExperiment()` (HTTP DELETE) |
| Survey | Hard | `Surveys.deleteSurvey()` (HTTP DELETE) |
| Cohort | Soft | `Cohorts.deleteCohort()` (internally PATCHes deleted:true) |
| Action | Soft | `Actions.deleteAction()` (internally PATCHes deleted:true) |
| Annotation | Hard | `Annotations.deleteAnnotation()` (HTTP DELETE) |
| Insight | Soft | `Insights.deleteInsight()` (internally PATCHes deleted:true) |

### 5.3 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTHOG_API_KEY` | Yes (if not in stage config) | — | PostHog personal API key |
| `POSTHOG_PROJECT_ID` | Yes (if not in stage config) | — | PostHog project ID |
| `POSTHOG_ENDPOINT` | No | `https://us.posthog.com` | PostHog API endpoint |

### 5.4 Dependencies

New dependency for alchemy-effect `package.json`:

```json
{
  "dependencies": {
    "distilled-posthog": "workspace:*"
  }
}
```

---

## 6. Testing Strategy

### 6.1 Integration Tests

Each resource has a provider test file that exercises the full create → update → destroy lifecycle against the real PostHog API.

**Pattern:**
```typescript
test("create, update, delete {resource}",
  Effect.gen(function* () {
    // Create
    class TestRes extends Resource("TestRes", { ...props }) {}
    const stack = yield* apply(TestRes);
    expect(stack.TestRes.id).toBeDefined();

    // Verify via direct API
    const actual = yield* API.getResource({ project_id, id: stack.TestRes.id });
    expect(actual.field).toEqual(expected);

    // Update
    class UpdatedRes extends Resource("TestRes", { ...updatedProps }) {}
    yield* apply(UpdatedRes);

    // Destroy
    yield* destroy();
    yield* assertDeleted(stack.TestRes.id, projectId);
  }).pipe(Effect.provide(PostHog.providers())),
);
```

### 6.2 Test Environment

Tests require:
- `POSTHOG_API_KEY` — Personal API key with project write access
- `POSTHOG_PROJECT_ID` — Project to create test resources in
- Network access to PostHog API

### 6.3 Test Coverage per Resource

Each resource test file covers:
1. **Create + Delete** — Basic lifecycle
2. **Create + Update + Delete** — Full CRUD with property changes
3. **Replacement** (where applicable) — Verify immutable prop change triggers replace

---

## 7. Implementation Order

| Phase | Tasks | Description |
|-------|-------|-------------|
| **Phase 1** | SETUP-001 to SETUP-003 | Infrastructure: config, project, credentials, endpoint, index, package.json |
| **Phase 2** | FF-001 to FF-003 | FeatureFlag: contract, provider, tests |
| **Phase 3** | DASH-001 to DASH-003 | Dashboard: contract, provider, tests |
| **Phase 4** | EXP-001 to EXP-003 | Experiment: contract, provider, tests |
| **Phase 5** | SRV-001 to SRV-003 | Survey: contract, provider, tests |
| **Phase 6** | COH-001 to COH-003 | Cohort: contract, provider, tests |
| **Phase 7** | ACT-001 to ACT-003 | Action: contract, provider, tests |
| **Phase 8** | ANN-001 to ANN-003 | Annotation: contract, provider, tests |
| **Phase 9** | INS-001 to INS-003 | Insight: contract, provider, tests |
| **Phase 10** | FINAL-001 to FINAL-002 | Final type check, smoke test |

---

## 8. Appendix

### A. File Manifest

**37 new files** + **2 modified files**

**Infrastructure (5 files):**
1. `src/posthog/config.ts`
2. `src/posthog/project.ts`
3. `src/posthog/credentials.ts`
4. `src/posthog/endpoint.ts`
5. `src/posthog/index.ts`

**Per-resource (3 files each x 8 resources = 24 files):**
- `src/posthog/{service}/index.ts`
- `src/posthog/{service}/{resource}.ts`
- `src/posthog/{service}/{resource}.provider.ts`

**Tests (8 files):**
- `test/posthog/{service}/{resource}.provider.test.ts`

**Modified:**
- `package.json` — dependency + exports
- `src/index.ts` — optional re-export
