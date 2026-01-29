# Error System Reference

The error system has two parts: **Error Classes** (typed errors) and **Error Categories** (predicate-based classification for retry/catch policies).

## Canonical Reference

- `packages/posthog/src/errors.ts`
- `packages/posthog/src/category.ts`

## Error Classes (`errors.ts`)

Errors are defined as Effect Schema `TaggedError` classes. Each class is decorated with a category via `.pipe()`:

```typescript
import * as S from "effect/Schema";
import {
  withAuthError,
  withNotFoundError,
  withServerError,
  withThrottlingError,
  withValidationError,
} from "./category.js";

// ── Base / Catch-all Errors ──────────────────────────────────────────

/** Catch-all for unrecognized API errors */
export class UnknownServiceError extends S.TaggedError<UnknownServiceError>()(
  "UnknownServiceError",
  {
    errorTag: S.String,
    errorData: S.optional(S.Unknown),
    message: S.optional(S.String),
  }
) {}

/** Generic error with code + message + details */
export class ServiceError extends S.TaggedError<ServiceError>()(
  "ServiceError",
  {
    code: S.String,
    message: S.String,
    details: S.optional(S.Unknown),
  }
) {}

// ── HTTP Status Errors (with categories) ─────────────────────────────

/** 401 - Invalid or missing API key */
export class AuthenticationError extends S.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withAuthError) {}

/** 403 - Valid key but insufficient permissions */
export class AuthorizationError extends S.TaggedError<AuthorizationError>()(
  "AuthorizationError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withAuthError) {}

/** 404 - Resource does not exist */
export class NotFoundError extends S.TaggedError<NotFoundError>()(
  "NotFoundError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withNotFoundError) {}

/** 400/422 - Invalid request data */
export class ValidationError extends S.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.Unknown),
    errors: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  }
).pipe(withValidationError) {}

/** 429 - Rate limit exceeded */
export class RateLimitError extends S.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.String),
    retryAfter: S.optional(S.Number),
  }
).pipe(withThrottlingError) {}

/** 5xx - Server-side failure */
export class ServerError extends S.TaggedError<ServerError>()(
  "ServerError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withServerError) {}

// ── Internal Errors (no category) ────────────────────────────────────

/** Schema missing required HTTP annotation (programming error) */
export class MissingHttpTraitError extends S.TaggedError<MissingHttpTraitError>()(
  "MissingHttpTraitError",
  { message: S.String }
) {}

/** Environment variable not set */
export class MissingCredentialsError extends S.TaggedError<MissingCredentialsError>()(
  "MissingCredentialsError",
  { message: S.String }
) {}

// ── Error Lists for Operations ───────────────────────────────────────

/** For list/create operations (no 404) */
export const COMMON_ERRORS = [
  AuthenticationError, AuthorizationError, ValidationError, RateLimitError, ServerError,
] as const;

/** For get/update/delete operations (includes 404) */
export const COMMON_ERRORS_WITH_NOT_FOUND = [...COMMON_ERRORS, NotFoundError] as const;

/** Union of all error types */
export type ServiceErrorType =
  | ServiceError | UnknownServiceError | AuthenticationError | AuthorizationError
  | NotFoundError | ValidationError | RateLimitError | ServerError
  | MissingHttpTraitError | MissingCredentialsError;
```

### Adaptation Notes

When adapting for a new API:

1. **Error field names** — Some APIs use `error` instead of `message`, or `status_code` instead of `code`. Match the API's actual error response shape.
2. **Additional error types** — Add API-specific errors (e.g., `ConflictError` for 409, `PaymentRequiredError` for 402).
3. **Rename prefixes** — Change `PostHogError` / `ServiceError` to `StripeError` etc.

## Error Categories (`category.ts`)

**Copy this file verbatim** with only namespace changes.

Categories are string constants stamped onto error class prototypes. They enable predicate-based retry and catch without `instanceof` checks:

```typescript
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";

// ── Category Constants ───────────────────────────────────────────────

export const ThrottlingError = "ThrottlingError";
export const ServerError = "ServerError";
export const AuthError = "AuthError";
export const ValidationError = "ValidationError";
export const NotFoundError = "NotFoundError";
export const NetworkError = "NetworkError";
export const TimeoutError = "TimeoutError";

export type Category =
  | typeof ThrottlingError | typeof ServerError | typeof AuthError
  | typeof ValidationError | typeof NotFoundError | typeof NetworkError
  | typeof TimeoutError;

export const categoriesKey = "@<service>/error/categories";

// ── Core Decorator ───────────────────────────────────────────────────

export const withCategory =
  <Categories extends Array<Category>>(...categories: Categories) =>
  <Args extends Array<any>, Ret, C extends { new (...args: Args): Ret }>(C: C) => {
    for (const category of categories) {
      if (!(categoriesKey in C.prototype)) {
        C.prototype[categoriesKey] = {};
      }
      C.prototype[categoriesKey][category] = true;
    }
    return C as any;
  };

// ── Category Decorators (used with .pipe()) ──────────────────────────

export const withThrottlingError = withCategory(ThrottlingError);
export const withServerError = withCategory(ServerError);
export const withAuthError = withCategory(AuthError);
export const withValidationError = withCategory(ValidationError);
export const withNotFoundError = withCategory(NotFoundError);
export const withNetworkError = withCategory(NetworkError);
export const withTimeoutError = withCategory(TimeoutError);

// ── Predicates ───────────────────────────────────────────────────────

export const hasCategory = (error: unknown, category: Category): boolean => {
  if (Predicate.isObject(error) && Predicate.hasProperty(categoriesKey)(error)) {
    return category in (error as any)[categoriesKey];
  }
  return false;
};

export const isThrottlingError = (error: unknown) => hasCategory(error, ThrottlingError);
export const isServerError = (error: unknown) => hasCategory(error, ServerError);
export const isAuthError = (error: unknown) => hasCategory(error, AuthError);
export const isValidationError = (error: unknown) => hasCategory(error, ValidationError);
export const isNotFoundError = (error: unknown) => hasCategory(error, NotFoundError);
export const isNetworkError = (error: unknown) => hasCategory(error, NetworkError);
export const isTimeoutError = (error: unknown) => hasCategory(error, TimeoutError);

/** Detects @effect/platform HTTP transport errors (DNS, TLS, connection refused) */
export const isHttpClientTransportError = (error: unknown): boolean =>
  Predicate.isObject(error) && "_tag" in error && error._tag === "RequestError"
  && "reason" in error && error.reason === "Transport";

/** Transient = should retry automatically */
export const isTransientError = (error: unknown): boolean =>
  isThrottlingError(error) || isServerError(error) || isNetworkError(error)
  || isHttpClientTransportError(error);

// ── Category Catchers ────────────────────────────────────────────────

const makeCatcher = (category: Category) =>
  <A2, E2, R2>(f: (err: any) => Effect.Effect<A2, E2, R2>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.catchIf(effect, (e) => hasCategory(e, category), f);

export const catchThrottlingError = makeCatcher(ThrottlingError);
export const catchServerError = makeCatcher(ServerError);
export const catchAuthError = makeCatcher(AuthError);
export const catchValidationError = makeCatcher(ValidationError);
export const catchNotFoundError = makeCatcher(NotFoundError);
export const catchNetworkError = makeCatcher(NetworkError);
export const catchTimeoutError = makeCatcher(TimeoutError);
```

### Only Change

Replace `categoriesKey = "@posthog/error/categories"` with `"@<service>/error/categories"`.

### How Categories Drive Retry

The retry system uses `isTransientError()` to decide what to retry:
- `ThrottlingError` (429) → retry with backoff, respect Retry-After
- `ServerError` (5xx) → retry with backoff
- `NetworkError` → retry with backoff
- `HttpClientTransportError` → retry with backoff
- Everything else → fail immediately (auth, validation, not found)
