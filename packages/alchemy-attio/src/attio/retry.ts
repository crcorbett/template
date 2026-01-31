import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

function isRetryable(error: { readonly _tag: string }): boolean {
  switch (error._tag) {
    case "RateLimitError":
    case "ServerError":
    case "UnknownAttioError":
      return true;
    default:
      return false;
  }
}

/**
 * Centralized retry policy for all Attio API operations.
 * Exponential backoff: 200ms base, max 5 retries.
 * Only retries transient errors (429, 5xx, unknown).
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
