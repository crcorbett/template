# Research Notes

## ACT-001
- Action resource follows same pattern as Cohort: `name` is `string | null`, `tags` in attrs is `unknown[] | undefined`
- ActionStepDef has 10 optional fields for matching steps (event, properties, selector, tagName, text, textMatching, href, hrefMatching, url, urlMatching)
- No replacement triggers for Actions - all prop changes are updates

## ACT-002
- PostHog Actions use soft delete: `deleteAction` internally calls `updateAction` with `deleted: true`
- API response `tags` is `readonly unknown[]` from Effect Schema, needs cast to mutable `unknown[]` for ActionAttrs
- ActionStep API uses snake_case: `tag_name`, `text_matching`, `href_matching`, `url_matching`

## ANN-003
- PostHog annotations do NOT reliably support HTTP DELETE - the `deleteAnnotation` endpoint returns a `PostHogError` (non-2xx response)
- The `@packages/posthog` tests all wrap `deleteAnnotation` with `Effect.catchAll(() => Effect.void)`, confirming known unreliability
- Solution: Use soft delete via `updateAnnotation({ deleted: true })` instead of `deleteAnnotation()`
- The `UpdateAnnotationRequest` schema includes `deleted: S.optional(S.Boolean)` field, so soft delete is supported
- After soft delete, `getAnnotation()` returns the annotation with `deleted: true`
- Fixed `annotation.provider.ts` delete method to use `updateAnnotation` with `deleted: true`
