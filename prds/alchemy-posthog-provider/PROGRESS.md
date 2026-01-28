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
