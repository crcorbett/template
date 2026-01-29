# Testing Reference

Tests are integration tests that hit the real API. The test harness provides Effect-aware helpers for setup, teardown, and resource cleanup.

## Canonical Reference

- `packages/posthog/test/test.ts` — test harness
- `packages/posthog/test/dashboards.test.ts` — full CRUD test example
- `packages/posthog/test/me.test.ts` — simple GET test + schema tests
- `packages/posthog/test/credentials.test.ts` — unit tests for credentials
- `packages/posthog/test/client/request-builder.test.ts` — client infrastructure tests
- `packages/posthog/test/client/response-parser.test.ts` — client infrastructure tests

## Test Harness (`test/test.ts`)

### Core Exports

```typescript
// Main test function — wraps Effect in vitest's it.scopedLive()
export function test(name: string, testCase: TestCase): void;
export function test(name: string, options: { timeout?: number }, testCase: TestCase): void;

// Resource cleanup guarantee via Effect.acquireUseRelease
export const withResource: <A, E, R>(options: {
  readonly acquire: Effect.Effect<A, E, R>;
  readonly use: (resource: A) => Effect.Effect<void, E, R>;
  readonly release: (resource: A) => Effect.Effect<void, unknown, R>;
}) => Effect.Effect<void, E, R>;

// Setup/teardown fixtures
export const beforeAll: (effect, timeout?) => void;
export const afterAll: (effect, timeout?) => void;

// Standalone runner (for non-test scripts)
export async function run<E>(effect): Promise<void>;

// Snapshot testing
export const expectSnapshot: (ctx, value, filename?) => Effect.Effect<void>;

// Project ID from environment
export const TEST_PROJECT_ID: Effect.Effect<string, Error>;
```

### Environment Setup

The harness automatically:
1. Reads `.env` from monorepo root via `PlatformConfigProvider.fromDotEnv("../../.env")`
2. Falls back to `ConfigProvider.fromEnv()` if no .env file
3. Provides `Credentials.fromEnv()` layer
4. Provides `FetchHttpClient.layer` + `NodeContext.layer`
5. Provides test endpoint URL
6. Applies test-specific retry policy (shorter backoff)
7. Sets `net.setDefaultAutoSelectFamily(false)` for IPv6 workaround

### Adaptation Points

When creating a new service's test harness:

```typescript
// 1. Change env var name
export const TEST_PROJECT_ID = Config.string("<SERVICE>_PROJECT_ID").pipe(
  Effect.mapError(() => new Error("<SERVICE>_PROJECT_ID is required"))
);

// 2. Change imports
import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import * as Retry from "../src/retry.js";

// 3. Change endpoint URL
Effect.provideService(Endpoint, "https://api.<service>.com"),

// 4. Keep everything else the same
```

## Test Pattern: Full CRUD Lifecycle

Use `withResource` to guarantee cleanup even on test failure:

```typescript
import { describe, expect } from "@effect/vitest";
import { Chunk, Effect, Stream } from "effect";
import { test, TEST_PROJECT_ID, withResource } from "./test.js";

describe("Dashboards", () => {
  test("should perform full CRUD lifecycle", () =>
    Effect.gen(function* () {
      const projectId = yield* TEST_PROJECT_ID;
      const name = `test-dashboard-${Date.now()}`;

      yield* withResource({
        // CREATE
        acquire: createDashboard({
          project_id: projectId,
          name,
          description: "Integration test",
        }),

        // READ + UPDATE assertions
        use: (created) =>
          Effect.gen(function* () {
            expect(created.id).toBeDefined();
            expect(created.name).toBe(name);

            // READ
            const fetched = yield* getDashboard({
              project_id: projectId,
              id: created.id,
            });
            expect(fetched.id).toBe(created.id);

            // UPDATE
            const updated = yield* updateDashboard({
              project_id: projectId,
              id: created.id,
              name: `${name}-updated`,
            });
            expect(updated.name).toBe(`${name}-updated`);
          }),

        // DELETE (always runs, even on failure)
        release: (created) =>
          deleteDashboard({ project_id: projectId, id: created.id })
            .pipe(Effect.catchAll(() => Effect.void)),
      });
    }));
});
```

### Why `withResource` Instead of `let` + `afterAll`

The naive pattern is broken:

```typescript
// BAD — `createdId` is undefined when cleanup evaluates (eager evaluation)
let createdId: number | undefined;
test("create", () => { /* set createdId */ });
afterAll(() => deleteResource(createdId!));  // createdId is still undefined!
```

`withResource` uses `Effect.acquireUseRelease` which is lazy — cleanup runs with the actual created resource.

## Test Pattern: List + Pagination

```typescript
test("should list resources", () =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    const result = yield* listDashboards({
      project_id: projectId,
      limit: 10,
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  }));

test("should paginate", () =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    const firstPage = yield* listDashboards({
      project_id: projectId,
      limit: 2,
      offset: 0,
    });
    expect(firstPage.results.length).toBeLessThanOrEqual(2);

    if (firstPage.next) {
      const secondPage = yield* listDashboards({
        project_id: projectId,
        limit: 2,
        offset: 2,
      });
      expect(secondPage.results).toBeDefined();
    }
  }));
```

## Test Pattern: Stream Pages and Items

```typescript
test("should stream pages", () =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    const pages = yield* listDashboards
      .pages({ project_id: projectId, limit: 2 })
      .pipe(Stream.take(2), Stream.runCollect);

    const pageArray = Chunk.toReadonlyArray(pages);
    expect(pageArray.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(pageArray[0].results)).toBe(true);
  }));

test("should stream items", () =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    const items = yield* listDashboards
      .items({ project_id: projectId, limit: 2 })
      .pipe(Stream.take(3), Stream.runCollect);

    const itemArray = Chunk.toReadonlyArray(items);
    expect(itemArray.length).toBeGreaterThanOrEqual(1);
  }));
```

## Test Pattern: Error Handling

```typescript
test("should handle not found", () =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    const result = yield* getDashboard({
      project_id: projectId,
      id: 999999999,
    }).pipe(Effect.either);

    expect(result._tag).toBe("Left");
  }));
```

## Test Pattern: Schema Structure (Unit Tests)

These don't hit the API — they validate schema definitions:

```typescript
import { describe, expect, it } from "@effect/vitest";

describe("schema structure", () => {
  it("should have correct request class structure", () => {
    const request = new GetMeRequest({});
    expect(request).toBeDefined();
  });

  it("should have correct response schema fields", () => {
    const response = new MeResponse({
      id: 1, uuid: "test", distinct_id: "test", first_name: "Test", email: "test@example.com",
    });
    expect(response.id).toBe(1);
  });

  it("should handle optional fields", () => {
    const response = new MeResponse({
      id: 1, uuid: "test", distinct_id: "test", first_name: "Test", email: "test@example.com",
      pending_email: null,
      email_opt_in: true,
    });
    expect(response.pending_email).toBe(null);
    expect(response.email_opt_in).toBe(true);
  });
});
```

## Test Pattern: Invalid API Key

```typescript
it.live("should fail with invalid API key", () =>
  Effect.gen(function* () {
    const InvalidLayer = Layer.mergeAll(
      FetchHttpClient.layer,
      Credentials.fromApiKey("invalid_key_12345"),
      Layer.succeed(Endpoint, "https://api.example.com"),
    );

    const error = yield* Effect.flip(
      getMe({}).pipe(Effect.provide(InvalidLayer))
    );

    expect(error).toBeDefined();
    expect(error._tag).toBe("ServiceError");
  })
);
```

## Client Infrastructure Tests

### Request Builder Tests (`test/client/request-builder.test.ts`)

Test each HTTP trait annotation in isolation. No API calls — uses `makeRequestBuilder` directly:

- GET request with no body
- Path parameters (`HttpLabel`) with URL encoding
- Query parameters (`HttpQuery`) — single, optional, array
- Custom headers (`HttpHeader`)
- JSON body serialization (omits undefined fields)
- Payload body (`HttpPayload`) — single field as entire body
- Combined request parts (path + query + headers + body)
- Date serialization in headers and body
- Error: missing HTTP trait → `MissingHttpTraitError`

### Response Parser Tests (`test/client/response-parser.test.ts`)

Test response parsing with mock `ReadableStream` responses. No API calls:

```typescript
const createMockResponse = (status: number, body: unknown): Response => {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const encoder = new TextEncoder();
  return {
    status,
    statusText: status >= 400 ? "Error" : "OK",
    headers: { "content-type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(bodyStr));
        controller.close();
      },
    }),
  };
};
```

Tests cover:
- Valid JSON responses with required/optional fields
- Empty body → `{}`
- HTTP error codes: 400, 401, 403, 404, 429, 500
- Error message extraction from: `message`, `error`, `detail`, `details`, `error_description`, `error.message`
- Schema validation errors (wrong type, missing required field)
- Nested/complex response structures
- Malformed JSON handling
- Error schema matching (typed vs. fallback)

## Test Checklist per Service

- [ ] List with default parameters
- [ ] List with pagination (limit/offset)
- [ ] Stream `.pages()` (take 1-2 pages)
- [ ] Stream `.items()` (take a few items)
- [ ] Full CRUD lifecycle with `withResource`
- [ ] Error handling (not found / invalid input)
- [ ] Schema structure tests (no API calls)
- [ ] Service-specific edge cases
