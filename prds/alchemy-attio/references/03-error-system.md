# 03 — Error System

## Canonical Reference

- `packages/posthog/src/errors.ts`
- `packages/posthog/src/category.ts`

## Attio Error Response Format

All Attio API errors return a consistent JSON structure:

```json
{
  "status_code": 400,
  "type": "validation_error",
  "code": "specific_error_code",
  "message": "Human-readable description"
}
```

This is cleaner than PostHog's variable error format.

## HTTP Status → Error Class Mapping

| Status | Attio `type` | SDK Error Class | Category |
|---|---|---|---|
| 400 | `validation_error` | `ValidationError` | `ValidationError` |
| 401 | `unauthorized_error` | `AuthenticationError` | `AuthError` |
| 403 | `forbidden_error` | `AuthorizationError` | `AuthError` |
| 404 | `not_found_error` | `NotFoundError` | `NotFoundError` |
| 409 | `conflict_error` | `ConflictError` | `ValidationError` |
| 429 | `rate_limit_error` | `RateLimitError` | `ThrottlingError` |
| 500 | `server_error` | `ServerError` | `ServerError` |

## errors.ts — Full Implementation

```typescript
import * as S from "effect/Schema";

import {
  withAuthError,
  withNotFoundError,
  withServerError,
  withThrottlingError,
  withValidationError,
} from "./category.js";

/** Base error for unknown Attio API errors */
export class UnknownAttioError extends S.TaggedError<UnknownAttioError>()(
  "UnknownAttioError",
  {
    errorTag: S.String,
    errorData: S.optional(S.Unknown),
    message: S.optional(S.String),
  }
) {}

/** Authentication error — Invalid or missing API key (401) */
export class AuthenticationError extends S.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withAuthError) {}

/** Authorization error — Valid key but insufficient scopes (403) */
export class AuthorizationError extends S.TaggedError<AuthorizationError>()(
  "AuthorizationError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withAuthError) {}

/** Not found error — Resource does not exist (404) */
export class NotFoundError extends S.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withNotFoundError) {}

/** Validation error — Invalid request data (400) */
export class ValidationError extends S.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withValidationError) {}

/** Conflict error — Unique attribute violation (409). Attio-specific. */
export class ConflictError extends S.TaggedError<ConflictError>()(
  "ConflictError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withValidationError) {}

/** Rate limit error — Too many requests (429) */
export class RateLimitError extends S.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
    retryAfter: S.optional(S.Number),
  }
).pipe(withThrottlingError) {}

/** Server error — Internal Attio server error (500) */
export class ServerError extends S.TaggedError<ServerError>()(
  "ServerError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withServerError) {}

/** Missing HTTP trait error — Schema programming mistake */
export class MissingHttpTraitError extends S.TaggedError<MissingHttpTraitError>()(
  "MissingHttpTraitError",
  { message: S.String }
) {}

/** Missing credentials error — Env var not set */
export class MissingCredentialsError extends S.TaggedError<MissingCredentialsError>()(
  "MissingCredentialsError",
  { message: S.String }
) {}

/** Common errors for list/create operations */
export const COMMON_ERRORS = [
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  ServerError,
] as const;

/** Common errors for get/update/delete (adds NotFoundError) */
export const COMMON_ERRORS_WITH_NOT_FOUND = [
  ...COMMON_ERRORS,
  NotFoundError,
] as const;

/** Common errors for assert/upsert operations (adds ConflictError) */
export const COMMON_ERRORS_WITH_CONFLICT = [
  ...COMMON_ERRORS,
  ConflictError,
] as const;

/** Generic Attio API error with code, message, and optional details */
export class AttioError extends S.TaggedError<AttioError>()(
  "AttioError",
  {
    code: S.String,
    message: S.String,
    details: S.optional(S.Unknown),
  }
) {}

/** Union of all error types */
export type AttioErrorType =
  | AttioError
  | UnknownAttioError
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | ValidationError
  | ConflictError
  | RateLimitError
  | ServerError
  | MissingHttpTraitError
  | MissingCredentialsError;
```

## Differences from PostHog

| Aspect | PostHog | Attio |
|---|---|---|
| Error fields | `message`, `detail` | `message`, `type`, `code` |
| Conflict (409) | Not present | `ConflictError` (unique attribute violation) |
| Error list constants | `COMMON_ERRORS`, `COMMON_ERRORS_WITH_NOT_FOUND` | Same + `COMMON_ERRORS_WITH_CONFLICT` |
| Generic error class | `PostHogError` | `AttioError` |
| Error type union | `PostHogErrorType` | `AttioErrorType` |
| Error field `detail` | `S.optional(S.String)` | Not used (Attio uses `message` consistently) |

## category.ts

**Copy verbatim from PostHog**, changing only the symbol namespace:

```diff
- const categoriesKey = Symbol.for("distilled-posthog/categories");
+ const categoriesKey = Symbol.for("distilled-attio/categories");
```

All exports remain identical — the category system is fully generic:
- Category constants: `ThrottlingError`, `ServerError`, `AuthError`, `ValidationError`, `NotFoundError`, `NetworkError`, `TimeoutError`
- `withCategory(...categories)` decorator
- Convenience decorators: `withThrottlingError`, `withServerError`, `withAuthError`, `withValidationError`, `withNotFoundError`
- Predicates: `isThrottlingError`, `isServerError`, `isAuthError`, `isTransientError`, etc.
- Catchers: `catchAuthError`, `catchNotFoundError`, etc.

## Rate Limiting Context

Attio has explicit rate limits:
- **Read requests:** 100/second
- **Write requests:** 25/second

The `retryAfter` field on `RateLimitError` is populated from the `Retry-After` HTTP response header. The retry policy's `makeDefault` factory reads this field to determine wait time before retrying.

429 response body example:
```json
{
  "status_code": 429,
  "type": "rate_limit_error",
  "code": "rate_limit_exceeded",
  "message": "You have exceeded the rate limit..."
}
```
