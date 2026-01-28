/**
 * Error Category System
 *
 * Symbol-based error classification matching distilled-aws.
 * Categories are stamped onto error class prototypes via decorators,
 * enabling predicate-based retry policies and error handling.
 */

import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";

// ============================================================================
// Category constants
// ============================================================================

export const ThrottlingError = "ThrottlingError";
export const ServerError = "ServerError";
export const AuthError = "AuthError";
export const ValidationError = "ValidationError";
export const NotFoundError = "NotFoundError";

export type Category =
  | typeof ThrottlingError
  | typeof ServerError
  | typeof AuthError
  | typeof ValidationError
  | typeof NotFoundError;

export const categoriesKey = "@posthog/error/categories";

// ============================================================================
// Core decorator
// ============================================================================

export const withCategory =
  <Categories extends Array<Category>>(...categories: Categories) =>
  <Args extends Array<any>, Ret, C extends { new (...args: Args): Ret }>(
    C: C,
  ): C & {
    new (
      ...args: Args
    ): Ret & { [categoriesKey]: { [Cat in Categories[number]]: true } };
  } => {
    for (const category of categories) {
      if (!(categoriesKey in C.prototype)) {
        C.prototype[categoriesKey] = {};
      }
      C.prototype[categoriesKey][category] = true;
    }
    return C as any;
  };

// ============================================================================
// Category decorators (for annotating error classes with .pipe())
// ============================================================================

export const withThrottlingError = withCategory(ThrottlingError);
export const withServerError = withCategory(ServerError);
export const withAuthError = withCategory(AuthError);
export const withValidationError = withCategory(ValidationError);
export const withNotFoundError = withCategory(NotFoundError);

// ============================================================================
// Predicates
// ============================================================================

/**
 * Check if an error has a specific category
 */
export const hasCategory = (error: unknown, category: Category): boolean => {
  if (
    Predicate.isObject(error) &&
    Predicate.hasProperty(categoriesKey)(error)
  ) {
    // @ts-expect-error - categoriesKey is a string key on the prototype
    return category in error[categoriesKey];
  }
  return false;
};

export const isThrottlingError = (error: unknown): boolean =>
  hasCategory(error, ThrottlingError);

export const isServerError = (error: unknown): boolean =>
  hasCategory(error, ServerError);

export const isAuthError = (error: unknown): boolean =>
  hasCategory(error, AuthError);

export const isValidationError = (error: unknown): boolean =>
  hasCategory(error, ValidationError);

export const isNotFoundError = (error: unknown): boolean =>
  hasCategory(error, NotFoundError);

/**
 * Check if an error is an @effect/platform HTTP client transport error.
 * These are network-level failures: connection timeouts, DNS failures,
 * socket errors, TLS failures, connection refused.
 *
 * Detects `RequestError` with `reason: 'Transport'` from @effect/platform's HttpClient.
 */
export const isHttpClientTransportError = (error: unknown): boolean =>
  Predicate.isObject(error) &&
  "_tag" in error &&
  error._tag === "RequestError" &&
  "reason" in error &&
  error.reason === "Transport";

/**
 * Check if an error is transient and should be automatically retried.
 * Transient errors include throttling, server, and HTTP transport errors.
 */
export const isTransientError = (error: unknown): boolean =>
  isThrottlingError(error) || isServerError(error) || isHttpClientTransportError(error);

// ============================================================================
// Category catchers (for use with .pipe(Category.catchAuthError(...)))
// ============================================================================

const makeCatcher =
  (category: Category) =>
  <A2, E2, R2>(f: (err: any) => Effect.Effect<A2, E2, R2>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.catchIf(effect, (e) => hasCategory(e, category), f) as Effect.Effect<
      A | A2,
      E | E2,
      R | R2
    >;

/**
 * Catch errors matching any of the specified categories.
 */
export const catchErrors =
  <Categories extends Category[], A2, E2, R2>(
    ...args: [...Categories, (err: any) => Effect.Effect<A2, E2, R2>]
  ) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) => {
    const handler = args.pop() as (err: any) => Effect.Effect<A2, E2, R2>;
    const categories = args as unknown as Categories;
    return Effect.catchIf(
      effect,
      (e) => categories.some((cat) => hasCategory(e, cat)),
      handler,
    ) as Effect.Effect<A | A2, E | E2, R | R2>;
  };

export { catchErrors as catch };

export const catchThrottlingError = makeCatcher(ThrottlingError);
export const catchServerError = makeCatcher(ServerError);
export const catchAuthError = makeCatcher(AuthError);
export const catchValidationError = makeCatcher(ValidationError);
export const catchNotFoundError = makeCatcher(NotFoundError);
