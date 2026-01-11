# Effect TS HTTP API Integration

> Research and architecture documentation for adding an Effect TS based HTTP API to the monorepo.

## Overview

This document outlines the architecture and implementation plan for integrating Effect TS HTTP API into our monorepo. The API will be hosted on a separate Bun server, with shared types between the server and the TanStack Start web application.

## Key Findings

### Package Selection

| Package | Purpose | Status |
|---------|---------|--------|
| `@effect/platform` | Core HTTP API modules (HttpApi, HttpApiGroup, HttpApiEndpoint, HttpApiBuilder, HttpApiClient) | **Recommended** |
| `@effect/platform-bun` | Bun runtime adapter (BunHttpServer, BunRuntime) | **Recommended** |
| `effect` | Core Effect library with Schema | **Required** |
| `effect-http` | Community HTTP library | **Deprecated** - use @effect/platform instead |

### Architecture Decision

We will use the **declarative HttpApi approach** rather than the lower-level HttpRouter approach because:

1. **Type Safety**: API contracts are defined once and shared between server and client
2. **Auto-generated Clients**: `HttpApiClient.make()` derives fully-typed clients from API definitions
3. **Schema Validation**: Automatic request/response validation with detailed error messages
4. **OpenAPI Support**: Built-in OpenAPI/Swagger documentation generation
5. **Middleware System**: Type-safe middleware at endpoint, group, or API level

## Proposed Architecture

```
apps/
├── api/                      # NEW: Bun Effect HTTP server
│   ├── src/
│   │   ├── handlers/         # HttpApiBuilder group implementations
│   │   │   ├── users.ts
│   │   │   ├── posts.ts
│   │   │   └── index.ts
│   │   ├── services/         # Business logic layers
│   │   │   └── ...
│   │   ├── api.ts            # HttpApiBuilder.api composition
│   │   └── main.ts           # BunHttpServer entry point
│   ├── package.json
│   └── tsconfig.json
│
└── web/                      # EXISTING: TanStack Start
    └── src/
        └── lib/
            └── api-client.ts # NEW: HttpApiClient wrapper

packages/
├── types/                    # NEW: Shared types and API contracts
│   ├── src/
│   │   ├── schemas/          # Effect Schema definitions
│   │   │   ├── user.ts
│   │   │   ├── post.ts
│   │   │   └── index.ts
│   │   ├── errors.ts         # Shared error types
│   │   ├── api.ts            # HttpApi + HttpApiGroup definitions
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── core/                     # EXISTING: Core utilities
└── ui/                       # EXISTING: UI components
```

## Implementation Details

### 1. Shared Types Package (`@packages/types`)

```typescript
// packages/types/src/schemas/user.ts
import { Schema } from "effect"

export const UserId = Schema.Number.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const UserIdFromString = Schema.NumberFromString.pipe(
  Schema.compose(UserId)
)

export class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.NonEmptyTrimmedString,
  email: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

// packages/types/src/errors.ts
import { Schema } from "effect"

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { userId: Schema.Number }
) {}

// packages/types/src/api.ts
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { User, UserIdFromString } from "./schemas/user.js"
import { UserNotFound } from "./errors.js"

const idParam = HttpApiSchema.param("id", UserIdFromString)

export class UsersApiGroup extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("getAll", "/users")
      .addSuccess(Schema.Array(User))
  )
  .add(
    HttpApiEndpoint.get("getById")`/users/${idParam}`
      .addSuccess(User)
      .addError(UserNotFound, { status: 404 })
  )
  .add(
    HttpApiEndpoint.post("create", "/users")
      .setPayload(Schema.Struct({
        name: Schema.NonEmptyTrimmedString,
        email: Schema.String
      }))
      .addSuccess(User, { status: 201 })
  )
{}

export class Api extends HttpApi.make("api")
  .add(UsersApiGroup)
{}
```

### 2. API Server Application (`apps/api`)

```typescript
// apps/api/src/handlers/users.ts
import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { Api } from "@packages/types"
import { UsersService } from "../services/users.js"

export const UsersHandlers = HttpApiBuilder.group(Api, "users", (handlers) =>
  Effect.gen(function* () {
    const users = yield* UsersService
    
    return handlers
      .handle("getAll", () => users.getAll())
      .handle("getById", ({ path: { id } }) => users.getById(id))
      .handle("create", ({ payload }) => users.create(payload))
  })
)

// apps/api/src/api.ts
import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { Api } from "@packages/types"
import { UsersHandlers } from "./handlers/users.js"
import { UsersServiceLive } from "./services/users.js"

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(UsersHandlers),
  Layer.provide(UsersServiceLive)
)

// apps/api/src/main.ts
import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import { ApiLive } from "./api.js"

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: 3001 }))
)

BunRuntime.runMain(Layer.launch(HttpLive))
```

### 3. Client Integration (`apps/web`)

```typescript
// apps/web/src/lib/api-client.ts
import { FetchHttpClient, HttpApiClient } from "@effect/platform"
import { Effect } from "effect"
import { Api } from "@packages/types"

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

// Create a reusable client effect
export const apiClient = HttpApiClient.make(Api, { baseUrl }).pipe(
  Effect.provide(FetchHttpClient.layer)
)

// Helper to run API calls
export const runApi = <A, E>(
  effect: Effect.Effect<A, E, never>
): Promise<A> => Effect.runPromise(effect)

// Usage example in a server function
import { createServerFn } from "@tanstack/react-start"

export const getUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    return Effect.gen(function* () {
      const client = yield* apiClient
      return yield* client.users.getAll()
    }).pipe(Effect.runPromise)
  })
```

## Dependencies

### @packages/types
```json
{
  "name": "@packages/types",
  "dependencies": {
    "@effect/platform": "^0.77.0",
    "effect": "^3.13.0"
  }
}
```

### apps/api
```json
{
  "name": "api",
  "dependencies": {
    "@effect/platform": "^0.77.0",
    "@effect/platform-bun": "^0.56.0",
    "@packages/types": "workspace:*",
    "effect": "^3.13.0"
  }
}
```

### apps/web (additions)
```json
{
  "dependencies": {
    "@effect/platform": "^0.77.0",
    "@packages/types": "workspace:*",
    "effect": "^3.13.0"
  }
}
```

## Development Workflow

### Running the Stack

```bash
# Start both API server and web app
bun run dev

# Or individually
bun run dev --filter=api   # API on :3001
bun run dev --filter=web   # Web on :3000
```

### Adding New Endpoints

1. **Define schema** in `@packages/types/src/schemas/`
2. **Add endpoint** to appropriate `HttpApiGroup` in `@packages/types/src/api.ts`
3. **Implement handler** in `apps/api/src/handlers/`
4. **Use in web app** - client is automatically typed!

## Benefits

1. **Single Source of Truth**: API contract defined once, used everywhere
2. **End-to-End Type Safety**: From database to UI with no manual type syncing
3. **Runtime Validation**: Automatic request/response validation
4. **Error Handling**: Typed errors propagate through the entire stack
5. **OpenAPI Generation**: Free API documentation
6. **Developer Experience**: Full autocomplete and type checking

## Related Issues

- [DEV-5](https://linear.app/coopers-projects/issue/DEV-5) - Research (this document)
- [DEV-6](https://linear.app/coopers-projects/issue/DEV-6) - Create @packages/types
- [DEV-7](https://linear.app/coopers-projects/issue/DEV-7) - Create apps/api
- [DEV-8](https://linear.app/coopers-projects/issue/DEV-8) - Integrate HttpApiClient in web app
- [DEV-9](https://linear.app/coopers-projects/issue/DEV-9) - Turbo pipeline configuration

## References

- [Effect Platform Documentation](https://effect.website/docs/platform/introduction/)
- [Effect Platform README](https://github.com/Effect-TS/effect/tree/main/packages/platform)
- [Effect Examples Monorepo](https://github.com/Effect-TS/examples/tree/main/templates/monorepo)
- [Effect Platform Bun Examples](https://github.com/Effect-TS/effect/tree/main/packages/platform-bun/examples)
