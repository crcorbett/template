import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import type * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";

import {
  isThrottlingError,
  isTransientError,
} from "./category.js";

export interface Options {
  readonly while?: (error: unknown) => boolean;
  readonly schedule?: Schedule.Schedule<unknown>;
}

/**
 * A factory function that creates retry policy options with access to the last error ref.
 * This allows dynamic policies that can inspect the last error for retry-after headers, etc.
 */
export type Factory = (lastError: Ref.Ref<unknown>) => Options;

/**
 * A retry policy can be either static options or a factory that receives the last error ref.
 */
export type Policy = Options | Factory;

export class Retry extends Context.Tag("@posthog/Retry")<Retry, Policy>() {}

export { isThrottlingError, isTransientError };

export const policy: {
  (
    options: Options
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, Retry>>;
  (
    factory: Factory
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, Retry>>;
} = (optionsOrFactory: Options | Factory) =>
  Effect.provide(Layer.succeed(Retry, optionsOrFactory));

export const none: <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<A, E, Exclude<R, Retry>> = Effect.provide(
  Layer.succeed(Retry, { while: () => false })
);

/**
 * Creates the default retry policy used by the PostHog SDK.
 *
 * This policy:
 * - Retries transient errors (throttling, server, HTTP transport)
 * - Uses exponential backoff starting at 100ms with a factor of 2
 * - Respects retryAfter from RateLimitError when present
 * - Ensures at least 500ms delay for throttling errors
 * - Limits to 5 retry attempts
 * - Applies jitter to avoid thundering herd
 */
export const makeDefault: Factory = (lastError) => ({
  while: (error) => isTransientError(error) || isThrottlingError(error),
  schedule: pipe(
    Schedule.exponential(100, 2),
    Schedule.modifyDelayEffect(
      Effect.fnUntraced(function* (duration) {
        const error = yield* lastError;
        if (
          isThrottlingError(error) &&
          Predicate.isObject(error) &&
          "retryAfter" in error
        ) {
          const retryAfter = Number(error.retryAfter);
          if (!isNaN(retryAfter) && retryAfter > 0) {
            return Duration.toMillis(Duration.seconds(retryAfter));
          }
        }
        if (isThrottlingError(error)) {
          if (Duration.toMillis(duration) < 500) {
            return Duration.toMillis(Duration.millis(500));
          }
        }
        return Duration.toMillis(duration);
      }),
    ),
    Schedule.intersect(Schedule.recurs(5)),
    Schedule.jittered,
  ),
});

export const transientOptions: Options = {
  while: isTransientError,
  schedule: pipe(
    Schedule.exponential(1000, 2),
    Schedule.modifyDelay((duration) =>
      Duration.toMillis(duration) > 5000 ? Duration.millis(5000) : duration
    ),
    Schedule.jittered
  ),
};

export const transient: <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<A, E, Exclude<R, Retry>> = policy(transientOptions);

export const throttlingOptions: Options = {
  while: isThrottlingError,
  schedule: pipe(
    Schedule.exponential(1000, 2),
    Schedule.modifyDelay((duration) =>
      Duration.toMillis(duration) > 5000 ? Duration.millis(5000) : duration
    ),
    Schedule.jittered
  ),
};

export const throttling: <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<A, E, Exclude<R, Retry>> = policy(throttlingOptions);
