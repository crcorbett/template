# Reference: Retry Policy

Source: `packages/alchemy-posthog/src/posthog/retry.ts`

Centralized retry policy for all API operations.

```typescript
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

/**
 * Determines if an error is retryable based on its tag.
 *
 * Retryable: RateLimitError, ServerError, UnknownPostHogError
 * Non-retryable: AuthenticationError, AuthorizationError, NotFoundError, ValidationError
 */
function isRetryable(error: { readonly _tag: string }): boolean {
  switch (error._tag) {
    case "RateLimitError":
    case "ServerError":
    case "UnknownPostHogError":
      return true;
    default:
      return false;
  }
}

/**
 * PostHog API retry policy with exponential backoff.
 *
 * - Base delay: 200ms
 * - Max retries: 5
 * - Only retries transient errors (429 rate limits, 5xx server errors)
 * - Does NOT retry client errors (400, 401, 403, 404)
 *
 * Design decision: All PostHog API operations share a uniform retry policy.
 * Per-operation customization (e.g. more retries for create, fewer for read) is
 * not currently needed because PostHog's rate limits and transient failures apply
 * uniformly across endpoints. If per-operation tuning becomes necessary, add an
 * optional overrides parameter (e.g. { maxRetries?, schedule? }) rather than
 * inlining Effect.retry in each provider method.
 */
export const retryPolicy = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.retry({
      while: isRetryable,
      schedule: Schedule.intersect(
        Schedule.recurs(5),
        Schedule.exponential("200 millis"),
      ),
    }),
  );
```
