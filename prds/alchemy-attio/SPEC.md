# `@packages/attio` — Distilled Client Specification

This is the implementation specification for the Attio distilled client package. It follows the `/distilled-client` skill pattern and uses `@packages/posthog` as the canonical reference.

## Reference Documents

Read these reference files for complete code examples, templates, and Attio-specific adaptations:

| # | Reference File | Topic | What It Contains |
|---|---|---|---|
| 01 | [`references/01-package-scaffold.md`](references/01-package-scaffold.md) | Package Scaffolding | Full directory tree, `package.json`, `tsconfig.json`, `vitest.config.ts`, export conventions, monorepo registration |
| 02 | [`references/02-credentials-and-endpoint.md`](references/02-credentials-and-endpoint.md) | Auth & Endpoint | `@attio/Credentials` Context tag, `ATTIO_API_KEY` env var, `fromEnv`/`fromApiKey` factories, Bearer token auth, endpoint `https://api.attio.com` |
| 03 | [`references/03-error-system.md`](references/03-error-system.md) | Error System | All error classes (including Attio-specific `ConflictError`), error categories, `AttioError`/`AttioErrorType`, HTTP status → error class mapping, rate limit context |
| 04 | [`references/04-client-infrastructure.md`](references/04-client-infrastructure.md) | Client Engine | `operation.ts` pagination mode extension, `response-parser.ts` adaptations, `api.ts` three-mode pagination (url/offset/cursor), architecture flow |
| 05 | [`references/05-common-schemas.md`](references/05-common-schemas.md) | Common Schemas | `ActorReference`, composite ID types (`ObjectId`, `RecordId`, etc.), `LinkedRecord`, `Assignee`, `NoteTag`, `WebhookSubscription`, design decisions on values/filters |
| 06 | [`references/06-service-authoring.md`](references/06-service-authoring.md) | Service Definitions | Complete Objects and Records service examples, response envelope pattern, POST-body pagination, assert/upsert, hard delete, multi-label paths, all endpoint URIs |
| 07 | [`references/07-retry-and-traits.md`](references/07-retry-and-traits.md) | Retry & Traits | Copy instructions (namespace changes only), trait annotation reference, Attio rate limit context |
| 08 | [`references/08-testing.md`](references/08-testing.md) | Testing | Full test harness implementation, service test patterns (read, list, CRUD lifecycle, pagination, errors), client infrastructure test cases, environment setup |
| 09 | [`references/09-barrel-exports.md`](references/09-barrel-exports.md) | Barrel Exports | Complete `index.ts`, consumer import styles, export conventions |

## Key Differences from PostHog

| Aspect | PostHog | Attio | Reference |
|---|---|---|---|
| Response envelope | None (single) / `{ results, next, count }` (list) | Always `{ "data": ... }` | [06](references/06-service-authoring.md) |
| Pagination (offset) | `next` URL in response → parse offset from URL | No `next` URL → auto-increment offset, stop when items < limit | [04](references/04-client-infrastructure.md) |
| Pagination (cursor) | Not used | `pagination.next_cursor` (meetings, call recordings) | [04](references/04-client-infrastructure.md) |
| Error format | Variable | Consistent `{ status_code, type, code, message }` | [03](references/03-error-system.md) |
| Conflict errors (409) | Not present | `ConflictError` for unique attribute violations | [03](references/03-error-system.md) |
| IDs | Flat integers | Composite objects `{ workspace_id, resource_id }` | [05](references/05-common-schemas.md) |
| Query endpoints | GET with query params | POST with JSON body (records/entries) | [06](references/06-service-authoring.md) |
| Delete response | Soft delete (returns resource) | Hard delete (returns `{}`) | [06](references/06-service-authoring.md) |
| Assert/upsert | Not present | PUT with `matching_attribute` query param | [06](references/06-service-authoring.md) |

## Files Copied Verbatim from PostHog

These need only symbol namespace changes (`"distilled-posthog"` → `"distilled-attio"`):

| File | Change |
|---|---|
| `src/category.ts` | `Symbol.for("distilled-attio/categories")` |
| `src/traits.ts` | `const prefix = "distilled-attio"` |
| `src/retry.ts` | `Context.Tag("@attio/Retry")` |
| `src/client/operation.ts` | Add `mode?` to pagination (see [04](references/04-client-infrastructure.md)) |
| `src/client/request.ts` | None |
| `src/client/response.ts` | None |
| `src/client/request-builder.ts` | Error import path only |

## Files Requiring Adaptation

| File | Adaptations | Reference |
|---|---|---|
| `src/credentials.ts` | Tag `@attio/Credentials`, env `ATTIO_API_KEY`, interface `AttioCredentials` | [02](references/02-credentials-and-endpoint.md) |
| `src/endpoint.ts` | Tag `@attio/Endpoint`, default `https://api.attio.com` | [02](references/02-credentials-and-endpoint.md) |
| `src/errors.ts` | Add `ConflictError`, `COMMON_ERRORS_WITH_CONFLICT`, `AttioError`, `AttioErrorType` | [03](references/03-error-system.md) |
| `src/client/api.ts` | Three-mode pagination, `AttioError` imports, items default `"data"` | [04](references/04-client-infrastructure.md) |
| `src/client/response-parser.ts` | `AttioError` imports | [04](references/04-client-infrastructure.md) |
| `src/common.ts` | All Attio shared schemas | [05](references/05-common-schemas.md) |
| `src/services/*.ts` | All 12 services authored from Attio API | [06](references/06-service-authoring.md) |
| `src/index.ts` | Barrel exports for all Attio modules | [09](references/09-barrel-exports.md) |
| `test/test.ts` | Endpoint, env var, remove project ID | [08](references/08-testing.md) |
| `test/*.test.ts` | All 15 test files | [08](references/08-testing.md) |

## Implementation Checklist

### Phase 1: Scaffold + Infrastructure

- [ ] Create `packages/attio/` directory structure
- [ ] Create `package.json`, `tsconfig.json`, `vitest.config.ts`
- [ ] Implement `src/credentials.ts`
- [ ] Implement `src/endpoint.ts`
- [ ] Copy + adapt `src/category.ts`
- [ ] Implement `src/errors.ts`
- [ ] Copy + adapt `src/retry.ts`
- [ ] Copy + adapt `src/traits.ts`

### Phase 2: Client Engine

- [ ] Copy + extend `src/client/operation.ts` (add `mode` to pagination)
- [ ] Copy `src/client/request.ts`, `response.ts`
- [ ] Copy + adapt `src/client/request-builder.ts`
- [ ] Adapt `src/client/response-parser.ts`
- [ ] Adapt `src/client/api.ts` (three-mode pagination)

### Phase 3: Common Schemas + Services

- [ ] Implement `src/common.ts`
- [ ] Implement all 12 service files:
  - [ ] `self.ts`, `objects.ts`, `records.ts`, `lists.ts`, `entries.ts`
  - [ ] `attributes.ts`, `select-options.ts`
  - [ ] `notes.ts`, `tasks.ts`, `comments.ts`, `webhooks.ts`, `workspace-members.ts`

### Phase 4: Barrel + Registration

- [ ] Implement `src/index.ts`
- [ ] Add to root `tsconfig.json` references
- [ ] `bun install` + `tsc --noEmit`

### Phase 5: Tests

- [ ] Implement `test/test.ts` harness
- [ ] Implement `test/client/request-builder.test.ts`
- [ ] Implement `test/client/response-parser.test.ts`
- [ ] Implement all 12 service test files
- [ ] All tests pass: `vitest run`

### Phase 6: Verification

- [ ] `bun run check-types` passes
- [ ] `bun run test` passes in `packages/attio`
- [ ] Consumer imports work: `import { Records, Objects } from "@packages/attio"`
- [ ] Direct service imports work: `import { queryRecords } from "@packages/attio/records"`
