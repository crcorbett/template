# Retry Policy Reference

The retry system provides automatic retries with exponential backoff, rate-limit awareness, and jitter.

## Canonical Reference

- `packages/posthog/src/retry.ts`

## Architecture

Retry is a **Context tag** containing either static options or a factory function. This allows:
- Default behavior with no configuration
- Custom policies provided per-call or globally
- Access to last error for retry-after header inspection

```typescript
export interface Options {
  readonly while?: (error: unknown) => boolean;   // Predicate: should retry?
  readonly schedule?: Schedule.Schedule<unknown>;   // Backoff schedule
}

export type Factory = (lastError: Ref.Ref<unknown>) => Options;
export type Policy = Options | Factory;

export class Retry extends Context.Tag("@<service>/Retry")<Retry, Policy>() {}
```

## Default Policy

```typescript
export const makeDefault: Factory = (lastError) => ({
  while: (error) => isTransientError(error) || isThrottlingError(error),
  schedule: pipe(
    Schedule.exponential(100, 2),           // 100ms, 200ms, 400ms, 800ms, 1600ms
    Schedule.modifyDelayEffect(
      Effect.fnUntraced(function* (duration) {
        const error = yield* lastError;
        // Respect Retry-After header from 429 responses
        if (isThrottlingError(error) && Predicate.isObject(error) && "retryAfter" in error) {
          const retryAfter = Number(error.retryAfter);
          if (!isNaN(retryAfter) && retryAfter > 0) {
            return Duration.toMillis(Duration.seconds(retryAfter));
          }
        }
        // Minimum 500ms for throttling errors
        if (isThrottlingError(error) && Duration.toMillis(duration) < 500) {
          return Duration.toMillis(Duration.millis(500));
        }
        return Duration.toMillis(duration);
      }),
    ),
    Schedule.intersect(Schedule.recurs(5)), // Max 5 retries
    Schedule.jittered,                       // Random jitter to prevent thundering herd
  ),
});
```

### Default Behavior

| Error Type | Action | Backoff |
|-----------|--------|---------|
| `RateLimitError` (429) | Retry | Respect `retryAfter`, min 500ms |
| `ServerError` (5xx) | Retry | Exponential from 100ms |
| `NetworkError` | Retry | Exponential from 100ms |
| `HttpClientTransportError` | Retry | Exponential from 100ms |
| `AuthenticationError` (401) | **Fail immediately** | — |
| `AuthorizationError` (403) | **Fail immediately** | — |
| `NotFoundError` (404) | **Fail immediately** | — |
| `ValidationError` (400) | **Fail immediately** | — |

## Pre-built Policies

```typescript
// Disable retry completely
export const none = Effect.provide(Layer.succeed(Retry, { while: () => false }));

// Only retry transient errors (no throttling awareness)
export const transient = policy({
  while: isTransientError,
  schedule: pipe(
    Schedule.exponential(1000, 2),
    Schedule.modifyDelay((d) => Duration.toMillis(d) > 5000 ? Duration.millis(5000) : d),
    Schedule.jittered,
  ),
});

// Only retry throttling errors
export const throttling = policy({
  while: isThrottlingError,
  schedule: pipe(
    Schedule.exponential(1000, 2),
    Schedule.modifyDelay((d) => Duration.toMillis(d) > 5000 ? Duration.millis(5000) : d),
    Schedule.jittered,
  ),
});
```

## Usage

```typescript
import * as Retry from "@packages/<service>/Retry";

// Default (automatic — no configuration needed)
someOperation(input)

// Disable retry for a single call
someOperation(input).pipe(Retry.none)

// Custom policy for a single call
someOperation(input).pipe(Retry.policy({
  while: Retry.isTransientError,
  schedule: Schedule.recurs(3),
}))

// Custom policy via Layer (applies to all operations in scope)
Effect.provide(Layer.succeed(Retry.Retry, { while: () => false }))
```

## How Retry is Resolved in api.ts

```typescript
const resolveRetryPolicy = Effect.gen(function* () {
  const lastError = yield* Ref.make<unknown>(undefined);
  const policy = (yield* Effect.serviceOption(Retry)).pipe(
    Option.map((value) =>
      typeof value === "function" ? value(lastError) : value
    ),
    Option.getOrElse(() => makeDefault(lastError)),
  );
  return { lastError, policy };
});
```

1. Create a `Ref<unknown>` to track the last error
2. Try to read `Retry` from context (optional — may not be provided)
3. If provided and is a Factory, call it with the error ref
4. If not provided, use `makeDefault` factory
5. Return the resolved policy + error ref

The error ref enables the retry schedule to inspect the last error's `retryAfter` field dynamically.

## Test-Specific Retry Policy

Tests use shorter backoff to avoid test timeouts:

```typescript
const testRetryOptions: Retry.Options = {
  while: Retry.isTransientError,
  schedule: pipe(
    Schedule.exponential(Duration.millis(200), 2),  // Faster start
    Schedule.modifyDelay((d) =>
      Duration.toMillis(d) > 2000 ? Duration.millis(2000) : d  // Lower cap
    ),
    Schedule.intersect(Schedule.recurs(3)),  // Fewer retries
    Schedule.jittered,
  ),
};
```
