# 08 — Testing

## Canonical Reference

- `packages/posthog/test/test.ts` — test harness
- `packages/posthog/test/feature-flags.test.ts` — CRUD lifecycle tests
- `packages/posthog/test/me.test.ts` — simple service test
- `packages/posthog/test/client/request-builder.test.ts` — client infra tests
- `packages/posthog/test/client/response-parser.test.ts` — client infra tests

## Test Harness — `test/test.ts`

Adapted from PostHog with these changes:

| Aspect | PostHog | Attio |
|---|---|---|
| Test-scoped ID | `TEST_PROJECT_ID` (from `POSTHOG_PROJECT_ID`) | Not needed — Attio doesn't use project scoping |
| Endpoint | `"https://us.posthog.com"` | `"https://api.attio.com"` |
| Credentials env | `POSTHOG_API_KEY` | `ATTIO_API_KEY` |
| Imports | `../src/credentials.js`, `../src/retry.js` | Same relative paths |

### Full Harness Implementation

```typescript
import { FetchHttpClient, FileSystem, HttpClient } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as PlatformConfigProvider from "@effect/platform/PlatformConfigProvider";
import * as Path from "@effect/platform/Path";
import {
  afterAll as _afterAll,
  beforeAll as _beforeAll,
  it,
  type TestContext,
} from "@effect/vitest";
import { ConfigProvider, LogLevel, pipe } from "effect";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as net from "node:net";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import * as Retry from "../src/retry.js";

// IPv6 Happy Eyeballs workaround (Node.js 20+)
net.setDefaultAutoSelectFamily(false);

type Provided =
  | Scope.Scope
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | Credentials
  | Endpoint;

const platform = Layer.mergeAll(
  NodeContext.layer,
  FetchHttpClient.layer,
  Logger.pretty
);

const resolveConfigProvider = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return (yield* fs.exists("../../.env"))
    ? ConfigProvider.orElse(
        yield* PlatformConfigProvider.fromDotEnv("../../.env"),
        ConfigProvider.fromEnv
      )
    : ConfigProvider.fromEnv();
});

const withConfigAndCredentials = <A, E, R>(
  effect: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const configProvider = yield* resolveConfigProvider;
    return yield* effect.pipe(
      Effect.provide(Credentials.fromEnv()),
      Effect.withConfigProvider(configProvider)
    );
  });

type TestCase =
  | Effect.Effect<void, unknown, Provided>
  | ((ctx: TestContext) => Effect.Effect<void, unknown, Provided>);

// Test-specific retry policy (200ms base, 2s cap, 3 retries)
const testRetryOptions: Retry.Options = {
  while: Retry.isTransientError,
  schedule: pipe(
    Schedule.exponential(Duration.millis(200), 2),
    Schedule.modifyDelay((d) =>
      Duration.toMillis(d) > 2000 ? Duration.millis(2000) : d
    ),
    Schedule.intersect(Schedule.recurs(3)),
    Schedule.jittered
  ),
};

function provideTestEnv<A, E, R extends Provided>(
  effect: Effect.Effect<A, E, R>
) {
  return effect.pipe(
    Effect.provide(platform),
    Effect.provideService(Endpoint, "https://api.attio.com"),
    Logger.withMinimumLogLevel(
      process.env.DEBUG ? LogLevel.Debug : LogLevel.Info
    ),
    Effect.provide(NodeContext.layer),
    Retry.policy(testRetryOptions)
  );
}

// --- Exported test utilities ---

export function test(name: string, options: { timeout?: number }, testCase: TestCase): void;
export function test(name: string, testCase: TestCase): void;
export function test(
  name: string,
  ...args: [{ timeout?: number }, TestCase] | [TestCase]
) {
  const [options = {}, testCase] =
    args.length === 1 ? [undefined, args[0]] : args;
  return it.scopedLive(
    name,
    (ctx) => {
      const effect = typeof testCase === "function" ? testCase(ctx) : testCase;
      return provideTestEnv(withConfigAndCredentials(effect));
    },
    options.timeout ?? 30_000
  );
}

test.skip = function (
  name: string,
  ...args: [{ timeout?: number }, TestCase] | [TestCase]
) {
  const [options = {}] = args.length === 1 ? [undefined] : args;
  return it.skip(name, () => {}, options.timeout ?? 30_000);
};

export async function run<E>(
  effect: Effect.Effect<void, E, Provided>
): Promise<void> {
  await Effect.runPromise(
    provideTestEnv(Effect.scoped(withConfigAndCredentials(effect)))
  );
}

export const beforeAll = (
  effect: Effect.Effect<void, unknown, Provided>,
  timeout?: number
) => _beforeAll(() => run(effect), timeout ?? 30_000);

export const afterAll = (
  effect: Effect.Effect<void, unknown, Provided>,
  timeout?: number
) => _afterAll(() => run(effect), timeout ?? 30_000);

export const withResource = <A, E, R>(options: {
  readonly acquire: Effect.Effect<A, E, R>;
  readonly use: (resource: A) => Effect.Effect<void, E, R>;
  readonly release: (resource: A) => Effect.Effect<void, unknown, R>;
}): Effect.Effect<void, E, R> =>
  Effect.acquireUseRelease(options.acquire, options.use, (resource) =>
    options.release(resource).pipe(Effect.catchAll(() => Effect.void))
  );

export const expectSnapshot = (
  ctx: TestContext,
  value: unknown,
  filename?: string
): Effect.Effect<void> => {
  const sanitize = (s: string) =>
    s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const suite = ctx.task.suite?.name ? sanitize(ctx.task.suite.name) : null;
  const testName = sanitize(ctx.task.name);
  const path = filename ?? (suite ? `${suite}/${testName}.json` : `${testName}.json`);
  return Effect.promise(() =>
    ctx.expect(JSON.stringify(value, null, 2)).toMatchFileSnapshot(`__snapshots__/${path}`)
  );
};
```

## Service Test Patterns

### Simple Read Test

```typescript
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { getSelf } from "../src/services/self.js";

describe("Self", () => {
  test("should identify current token", () =>
    Effect.gen(function* () {
      const result = yield* getSelf({});
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    }));
});
```

### List + Schema Validation Test

```typescript
describe("Objects", () => {
  test("should list all objects", () =>
    Effect.gen(function* () {
      const result = yield* listObjects({});
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      // System objects should always exist
      const slugs = result.data.map((o) => o.api_slug);
      expect(slugs).toContain("people");
      expect(slugs).toContain("companies");
    }));

  test("should get a specific object by slug", () =>
    Effect.gen(function* () {
      const result = yield* getObject({ object: "people" });
      expect(result.data.api_slug).toBe("people");
      expect(result.data.id.object_id).toBeDefined();
    }));
});
```

### Paginated Query Test

```typescript
describe("Records", () => {
  test("should query records with limit", () =>
    Effect.gen(function* () {
      const result = yield* queryRecords({ object: "people", limit: 5 });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);
    }));

  test("should stream pages of records", () =>
    Effect.gen(function* () {
      const pages = yield* queryRecords
        .pages({ object: "people", limit: 2 })
        .pipe(Stream.take(2), Stream.runCollect);
      expect(Chunk.toReadonlyArray(pages).length).toBeGreaterThanOrEqual(1);
    }));

  test("should stream individual record items", () =>
    Effect.gen(function* () {
      const items = yield* queryRecords
        .items({ object: "people", limit: 3 })
        .pipe(Stream.take(3), Stream.runCollect);
      expect(Chunk.toReadonlyArray(items).length).toBeLessThanOrEqual(3);
    }));
});
```

### Full CRUD Lifecycle Test with `withResource`

```typescript
describe("Notes", () => {
  test("should perform full CRUD", () =>
    Effect.gen(function* () {
      // Need a record to attach the note to
      const people = yield* queryRecords({ object: "people", limit: 1 });
      const person = people.data[0]!;

      yield* withResource({
        acquire: createNote({
          parent_object: "people",
          parent_record_id: person.id.record_id,
          title: `Test Note ${Date.now()}`,
          format: "plaintext",
          content: "Test content",
        }),
        use: (created) =>
          Effect.gen(function* () {
            expect(created.data.id.note_id).toBeDefined();

            // Read back
            const fetched = yield* getNote({ note_id: created.data.id.note_id });
            expect(fetched.data.title).toBe(created.data.title);

            // Update
            const updated = yield* updateNote({
              note_id: created.data.id.note_id,
              title: "Updated Title",
            });
            expect(updated.data.title).toBe("Updated Title");
          }),
        release: (created) =>
          deleteNote({ note_id: created.data.id.note_id }).pipe(
            Effect.catchAll(() => Effect.void)
          ),
      });
    }));
});
```

### Error Handling Test

```typescript
test("should handle not found", () =>
  Effect.gen(function* () {
    const result = yield* getRecord({
      object: "people",
      record_id: "00000000-0000-0000-0000-000000000000",
    }).pipe(Effect.either);
    expect(result._tag).toBe("Left");
  }));
```

## Client Infrastructure Tests

### request-builder.test.ts

Test cases:

- **Path parameter substitution**: `/v2/objects/{object}` with `object: "people"` → `/v2/objects/people`
- **Multiple path params**: `/v2/{target}/{identifier}/attributes/{attribute}` → correct substitution
- **Query params**: `limit`, `offset` with `T.HttpQuery()` → query string
- **POST body fields**: Fields without `T.HttpQuery()` → JSON body
- **PUT with query param**: `matching_attribute` as query param + body data
- **Empty request**: No params → correct path, no body
- **Missing HTTP trait**: Schema without `T.Http()` → `MissingHttpTraitError`

### response-parser.test.ts

Test cases:

- **Success (200)**: Body with `{ "data": [...] }` → decoded via output schema
- **Success (200) single item**: Body with `{ "data": { ... } }` → decoded
- **Empty body (204)**: → `{}`
- **Error 400**: → parsed with `message` field from Attio error format
- **Error 401**: → `AttioError` with code "401"
- **Error 404**: → `AttioError` with code "404"
- **Error 409**: → `AttioError` with code "409"
- **Error 429**: → `AttioError` with code "429", check retryAfter extraction
- **Error 500**: → `AttioError` with code "500"
- **Malformed JSON**: → error with "Failed to parse JSON"
- **Schema mismatch**: Valid JSON but wrong shape → `PARSE_ERROR`

## Environment Setup

### .env (at monorepo root)

```
ATTIO_API_KEY=your_attio_api_key_here
```

The test harness reads `.env` from `../../.env` (two levels up from `packages/attio/test/`).

### Running Tests

```bash
# All tests
cd packages/attio && bun run test

# Specific test file
cd packages/attio && npx vitest run test/objects.test.ts

# With debug logging
DEBUG=1 cd packages/attio && bun run test

# Watch mode
cd packages/attio && bun run test:watch
```
