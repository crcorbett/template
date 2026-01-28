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
