# PostHog Provider Conformance Specification

## Overview

This PRD addresses conformance gaps between the `alchemy-posthog` provider implementation and the canonical provider patterns established in `alchemy-effect`. The gaps were identified by systematic comparison of provider lifecycle methods, error handling, composition patterns, and resource contract definitions across AWS and Cloudflare providers in alchemy-effect.

## Reference Material

- **alchemy-effect provider contract**: `.context/alchemy-effect/alchemy-effect/src/provider.ts`
- **alchemy-effect resource contract**: `.context/alchemy-effect/alchemy-effect/src/resource.ts`
- **Reference providers**: AWS S3 Bucket, AWS Lambda Function, AWS SQS Queue, Cloudflare KV Namespace, Cloudflare R2 Bucket
- **PostHog providers**: `packages/alchemy-posthog/src/posthog/*/`

## Gap Categories

### Critical (CRIT-001 through CRIT-006): Parameter Destructuring

All lifecycle methods in PostHog providers destructure a subset of available parameters. The alchemy-effect provider contract defines:

| Method | Full Signature | PostHog Uses |
|--------|---------------|--------------|
| `diff` | `{ id, olds, instanceId, news, output }` | `{ news, olds }` |
| `read` | `{ id, instanceId, olds, output, bindings }` | `{ olds, output }` |
| `create` | `{ id, instanceId, news, session, bindings }` | `{ news, session }` |
| `update` | `{ id, instanceId, news, olds, output, session, bindings }` | `{ news, output, session }` |
| `delete` | `{ id, instanceId, olds, output, session, bindings }` | `{ output, session }` |

**Guideline**: Destructure parameters that are referenced in the method body. Do not destructure unused parameters (no `_id` prefixing). The goal is awareness that the full set is available, not cargo-culting unused parameters.

### Critical (CRIT-002): Diff Semantics

The diff method has three valid return states:
1. `{ action: "replace" }` — immutable property changed, delete-then-create
2. `{ action: "update" }` — mutable property changed, call update method
3. `undefined` / `void` — no changes detected, engine decides (typically no-op)

PostHog providers incorrectly return `{ action: "update" }` even when nothing changed, causing unnecessary update API calls.

### High (HIGH-001 through HIGH-004): Behavioral Gaps

- **Stables redundancy**: Top-level `stables` is sufficient; diff should not re-declare
- **Broad error catching**: Only catch specific error tags, never catch-all `PostHogError`
- **List API efficiency**: Use search parameters where available; paginate all list calls

### Medium (MED-001 through MED-006): Pattern Alignment

- **DRY composition**: `bareProviders()` should delegate to `config()`
- **Dead generics**: Remove unused `_Props` type parameter from `mapResponseToAttrs`
- **Input<T>**: Wrap cross-resource reference fields
- **Type naming**: Two-level convention (`PostHog.Dashboard` not `PostHog.Dashboards.Dashboard`)
- **Attrs nullability**: Remove `| undefined` from always-present fields
- **Effect.fnUntraced**: Use for diff methods (hot path during plan phase)

### Low (LOW-001 through LOW-005): Polish

- Session note identifiers, `as const` cleanup, retry documentation, precreate documentation

## Execution Order

Tasks should be executed in ID order. CRIT tasks first (parameter destructuring is mechanical and safe), then HIGH (behavioral changes), then MED (pattern changes that may require more research), then LOW (polish).

MED-004 (type naming) is a breaking change for state files and should be evaluated carefully.
