# Progress Log

## ACT-001: Implement Action resource contract
- Created `src/posthog/actions/action.ts` with `ActionStepDef`, `ActionProps`, `ActionAttrs` interfaces and `Action` resource
- Updated `src/posthog/actions/index.ts` barrel export
- `bun tsc -b` passes with no type errors

## ACT-002: Implement Action provider with CRUD lifecycle
- Created `src/posthog/actions/action.provider.ts` with full CRUD lifecycle
- Maps ActionStepDef camelCase props to snake_case API format
- Soft delete via `deleteAction` (internally patches `deleted: true`)
- Updated `actions/index.ts` barrel and `posthog/index.ts` with Actions namespace + `actionProvider()` in `resources()`
- Added `@packages/posthog/actions` alias to `vitest.config.ts`
- `bun tsc -b` passes with no type errors

## ACT-003: Action provider integration tests
- Created `test/posthog/actions/action.provider.test.ts` with create/update/delete lifecycle test
- Action uses soft delete (PATCH `deleted: true` via `updateAction`)
- `assertActionDeleted` checks for `deleted: true` field, `NotFoundError`, or `PostHogError` 404 with retry/backoff
- `bun tsc -b` passes
- `bun vitest run test/posthog/actions/action.provider.test.ts` passes (1 test, ~3.4s)

## ANN-001: Implement Annotation resource contract
- Created `src/posthog/annotations/annotation.ts` with `AnnotationProps`, `AnnotationAttrs` interfaces and `Annotation` resource
- AnnotationProps: content, dateMarker, creationType ('USR' | 'GIT'), dashboardItem, scope
- AnnotationAttrs: id (number, stable), content, dateMarker, scope, createdAt
- Updated `src/posthog/annotations/index.ts` barrel export
- `bun tsc -b` passes with no type errors

## ANN-002: Implement Annotation provider with CRUD lifecycle
- Created `src/posthog/annotations/annotation.provider.ts` with full CRUD lifecycle
- Maps camelCase props to snake_case API params (dateMarker -> date_marker, creationType -> creation_type, dashboardItem -> dashboard_item)
- Diff always returns undefined (no replacement triggers)
- Delete uses hard HTTP DELETE via `deleteAnnotation`
- Updated `annotations/index.ts` barrel and `posthog/index.ts` with Annotations namespace + `annotationProvider()` in `resources()`
- Added `@packages/posthog/annotations` alias to `vitest.config.ts`
- `bun tsc -b` passes with no type errors

## ANN-003: Implement Annotation provider integration tests
- Created `test/posthog/annotations/annotation.provider.test.ts` with create/update/delete lifecycle test
- DISCOVERY: PostHog annotations do NOT reliably support HTTP DELETE (returns PostHogError)
- Fixed `annotation.provider.ts` to use soft delete via `updateAnnotation({ deleted: true })` instead of `deleteAnnotation()`
- `assertAnnotationDeleted` checks for `deleted: true` field, `NotFoundError`, or `PostHogError` 404 with retry/backoff
- `bun tsc -b` passes
- `bun vitest run test/posthog/annotations/annotation.provider.test.ts` passes (1 test, ~2.5s)

## INS-001: Implement Insight resource contract
- Created `src/posthog/insights/insight.ts` with `InsightProps`, `InsightAttrs` interfaces and `Insight` resource
- InsightProps: name (string|null), description (string|null), query (unknown), filters (unknown), dashboards (number[]), saved (boolean)
- InsightAttrs: id (number, stable), shortId (string|undefined), name, description, createdAt, favorited, saved
- Updated `src/posthog/insights/index.ts` barrel export
- `bun tsc -b` passes with no type errors

## INS-002: Implement Insight provider with CRUD lifecycle
- Created `src/posthog/insights/insight.provider.ts` with full CRUD lifecycle
- Stables: `['id', 'shortId']`
- No camelCase->snake_case mapping needed (Insight props match API field names)
- Diff always returns undefined (no replacement triggers)
- Delete uses soft delete via `deleteInsight` (internally PATCHes `deleted: true`)
- Updated `insights/index.ts` barrel and `posthog/index.ts` with Insights namespace + `insightProvider()` in `resources()`
- Added `@packages/posthog/insights` alias to `vitest.config.ts`
- `bun tsc -b` passes with no type errors

## INS-003: Implement Insight provider integration tests
- Created `test/posthog/insights/insight.provider.test.ts` with create/update/delete lifecycle test
- Test creates insight with `name` and `saved: true`, verifies via API, updates description, destroys (soft delete), verifies deletion
- `assertInsightDeleted` helper checks for `deleted: true`, `NotFoundError`, or `PostHogError` 404 with retry/backoff
- `bun tsc -b` passes
- `bun vitest run test/posthog/insights/insight.provider.test.ts` passes (1 test, ~3.1s)
