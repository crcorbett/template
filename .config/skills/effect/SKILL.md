---
name: effect
description: "Effect TypeScript framework guidance. INVOKE THIS SKILL whenever writing TypeScript code, especially code involving logic, control flow, error handling, async operations, data validation, schemas, branching, conditionals, option or nullable handling, service patterns, dependency injection, or any business logic. Effect provides primitives that replace almost all TypeScript built-ins. Always prefer Effect patterns over native TS constructs."
---

# Effect TypeScript Framework

Effect is the missing standard library for TypeScript. Use Effect primitives instead of native TypeScript constructs wherever possible.

## Reference Repositories

Before writing code, review these repos in `.context/`:

- **`.context/effect/`** - Official Effect monorepo with all packages
- **`.context/effect-getting-started-course/`** - Beginner course with idiomatic patterns
- **`.context/effect-snippets/`** - Real-world patterns (RPC, auth, database, workers)
- **`.context/effect-utils/`** - Utility patterns and service implementations

## Core Principles

1. **Replace native constructs** - Use Effect equivalents for:
   - `try/catch` → `Effect.tryPromise`, `Effect.try`, error channels
   - `if/else` → `Effect.if`, `Match`, `Option.match`
   - `null/undefined` → `Option<A>`
   - `Promise` → `Effect<A, E, R>`
   - `throw` → `Effect.fail`, typed error channels
   - Conditionals → `Match.type`, `Match.value` for exhaustive matching

2. **Typed errors** - Never use untyped errors. Define error types with `Data.TaggedError`:

   ```ts
   class NotFoundError extends Data.TaggedError("NotFoundError")<{
     id: string;
   }> {}
   ```

3. **Schemas for everything** - **REQUIRED**: Define Schemas for all data structures, and derive types from Schemas. Never write raw TypeScript types/interfaces:

   ```ts
   // ✅ CORRECT: Schema first, type derived
   const User = Schema.Struct({
     name: Schema.String,
     age: Schema.Number,
   });
   type User = typeof User.Type; // Derive type from Schema

   // ❌ WRONG: Raw TypeScript interface
   interface User {
     name: string;
     age: number;
   }
   ```

4. **Branded types** - Use `Schema.brand()` for domain-specific types to prevent accidental misuse:

   ```ts
   // Branded types for type safety
   const EntityId = Schema.String.pipe(
     Schema.pattern(/^[a-z_]+\.[a-z0-9_]+$/),
     Schema.brand("EntityId")
   );
   type EntityId = typeof EntityId.Type; // string & Brand<"EntityId">

   const UserId = Schema.String.pipe(
     Schema.minLength(1),
     Schema.brand("UserId")
   );
   type UserId = typeof UserId.Type; // string & Brand<"UserId">
   ```

5. **Services via Context** - Use `Context.Tag` and `Layer` for dependency injection

6. **Composition** - Use `pipe` and `Effect.gen` for composing effects

## Key Packages

| Package                | Use For                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `effect`               | Core Effect type, Option, Either, Match, pipe, Data, Schema, Context, Layer |
| `@effect/platform`     | HTTP clients, HTTP server, HTTP router, cross-platform                      |
| `@effect/platform-bun` | Bun-specific HTTP server and runtime                                        |
| `@effect/cli`          | CLI applications                                                            |
| `@effect/vitest`       | Testing utilities and matchers                                              |

## Pattern Quick Reference

### Error Handling

```ts
// Instead of try/catch
Effect.tryPromise({
  try: () => fetch(url),
  catch: (e) => new FetchError({ cause: e }),
});
```

### Option/Nullable

```ts
// Instead of null checks
Option.fromNullable(value).pipe(
  Option.map(v => transform(v)),
  Option.getOrElse(() => default)
)
```

### Pattern Matching

```ts
// Instead of if/else or switch
Match.type<Input>().pipe(
  Match.tag("Success", (s) => s.value),
  Match.tag("Failure", (f) => f.error),
  Match.exhaustive
);
```

### Schemas and Types

```ts
// Always define Schemas, derive types
const User = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId")),
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/^.+@.+$/)),
  age: Schema.Number.pipe(Schema.int(), Schema.positive()),
});
type User = typeof User.Type; // Derive type from Schema

// Use Schema for parsing/validation
const parseUser = Schema.decodeUnknown(User);
```

### Branded Types

```ts
// Create branded types for domain-specific values
const EntityId = Schema.String.pipe(
  Schema.pattern(/^[a-z_]+\.[a-z0-9_]+$/),
  Schema.brand("EntityId")
);
type EntityId = typeof EntityId.Type;

// Branded types prevent accidental mixing
const userId: EntityId = "user.123"; // ✅ Valid
const entityId: EntityId = userId; // ✅ Type-safe
const wrong: EntityId = "not-an-id"; // ❌ Type error at compile time
```

### Services

```ts
class MyService extends Context.Tag("MyService")<
  MyService,
  { fetch: (id: string) => Effect.Effect<Data> }
>() {}

const MyServiceLive = Layer.succeed(MyService, {
  fetch: (id) => Effect.succeed(data),
});
```

## When Writing Code

1. **Always define Schemas first** - Never write raw TypeScript types/interfaces. Create Schemas and derive types using `typeof SchemaName.Type`
2. **Use branded types** - Apply `Schema.brand()` to domain-specific types (IDs, tokens, URLs, etc.) for type safety
3. Check `.context/effect-snippets/` for similar patterns
4. Review `.context/effect-getting-started-course/src/` for idiomatic approaches
5. Search `.context/effect/packages/` for usage examples
6. Search `.context/effect-utils` for usage examples
7. Prefer Effect constructs - if you're writing `if`, `try`, `null`, consider the Effect alternative
