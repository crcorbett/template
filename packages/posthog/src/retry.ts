import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";

import type { RateLimitError, ServerError } from "./errors.js";

export interface Options {
  readonly while?: (error: unknown) => boolean;
  readonly schedule?: Schedule.Schedule<unknown>;
}

export class Retry extends Context.Tag("@posthog/Retry")<Retry, Options>() {}

const hasTag =
  <T extends { readonly _tag: string }>(tag: T["_tag"]) =>
  (error: unknown): error is T =>
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === tag;

export const isRateLimitError: (error: unknown) => error is RateLimitError =
  hasTag<RateLimitError>("RateLimitError");

export const isServerError: (error: unknown) => error is ServerError =
  hasTag<ServerError>("ServerError");

export const isTransientError = (error: unknown): boolean =>
  isRateLimitError(error) || isServerError(error);

export const policy: {
  (
    options: Options
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, Retry>>;
} = (options: Options) => Effect.provide(Layer.succeed(Retry, options));

export const none: <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<A, E, Exclude<R, Retry>> = Effect.provide(
  Layer.succeed(Retry, { while: () => false })
);

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
  while: isRateLimitError,
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
