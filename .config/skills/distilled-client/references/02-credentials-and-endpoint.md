# Credentials & Endpoint Reference

Every distilled client needs two Context tags: `Credentials` (authentication) and `Endpoint` (base URL).

## Canonical Reference

- `packages/posthog/src/credentials.ts`
- `packages/posthog/src/endpoint.ts`

## Credentials Pattern

```typescript
// src/credentials.ts
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { MissingCredentialsError } from "./errors.js";

/**
 * Credential shape. API keys MUST be Redacted<string> to prevent accidental logging.
 */
export interface <Service>Credentials {
  readonly apiKey: Redacted.Redacted<string>;
}

/**
 * Context tag for credentials. Namespace: @<service>/Credentials
 */
export class Credentials extends Context.Tag("@<service>/Credentials")<
  Credentials,
  <Service>Credentials
>() {
  /**
   * Read from environment variable <SERVICE>_API_KEY.
   * Returns Layer that fails with MissingCredentialsError if not set.
   */
  static fromEnv(): Layer.Layer<Credentials, MissingCredentialsError> {
    return Layer.effect(
      Credentials,
      Effect.gen(function* () {
        const apiKey = yield* Config.redacted("<SERVICE>_API_KEY").pipe(
          Effect.mapError(
            () =>
              new MissingCredentialsError({
                message: "<SERVICE>_API_KEY environment variable is not set",
              })
          )
        );
        return { apiKey };
      })
    );
  }

  /**
   * Create from a plain string (wraps in Redacted automatically).
   */
  static fromApiKey(apiKey: string): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey: Redacted.make(apiKey) });
  }

  /**
   * Create from a pre-redacted value.
   */
  static fromRedactedApiKey(
    apiKey: Redacted.Redacted<string>
  ): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey });
  }
}
```

### Key Rules

1. **Always use `Redacted<string>`** for secrets — `String(redacted)` returns `<redacted>`, not the value.
2. **`Config.redacted()`** reads env vars as Redacted automatically.
3. **Three factory methods**: `fromEnv()`, `fromApiKey(string)`, `fromRedactedApiKey(Redacted)`.
4. **Tag ID convention**: `@<service>/Credentials` (lowercase service name).

### Authentication Variations

For services that don't use Bearer tokens:

**OAuth2 / Bearer Token** (default pattern):
```typescript
// In api.ts:
Authorization: `Bearer ${Redacted.value(credentials.apiKey)}`
```

**API Key in Custom Header**:
```typescript
export interface ServiceCredentials {
  readonly apiKey: Redacted.Redacted<string>;
}
// In api.ts:
"X-Api-Key": Redacted.value(credentials.apiKey)
```

**Basic Auth**:
```typescript
export interface ServiceCredentials {
  readonly username: Redacted.Redacted<string>;
  readonly password: Redacted.Redacted<string>;
}
// In api.ts:
const encoded = btoa(`${Redacted.value(credentials.username)}:${Redacted.value(credentials.password)}`);
Authorization: `Basic ${encoded}`
```

**Multiple credentials** (e.g., API key + project ID):
```typescript
export interface ServiceCredentials {
  readonly apiKey: Redacted.Redacted<string>;
  readonly projectId: string;  // Not secret, no Redacted needed
}
```

## Endpoint Pattern

```typescript
// src/endpoint.ts
import * as Context from "effect/Context";

/**
 * API base URL. Consumers can override for self-hosted / regional endpoints.
 */
export class Endpoint extends Context.Tag("@<service>/Endpoint")<
  Endpoint,
  string
>() {
  static readonly DEFAULT = "https://api.<service>.com";
}
```

### Key Rules

1. **Tag ID convention**: `@<service>/Endpoint`.
2. **`DEFAULT` static field** — the standard API URL for SaaS users.
3. **Trailing slash handling** — the client strips trailing slashes from the endpoint in `api.ts`:
   ```typescript
   const baseUrl = endpoint.replace(/\/$/, "");
   ```
4. **Override examples**:
   ```typescript
   // Self-hosted
   Layer.succeed(Endpoint, "https://posthog.internal.company.com")
   // Regional
   Layer.succeed(Endpoint, "https://eu.posthog.com")
   // Local dev
   Layer.succeed(Endpoint, "http://localhost:8000")
   ```

## Usage in Client

Both tags are required dependencies of every operation:

```typescript
type Deps = HttpClient.HttpClient | Credentials | Endpoint;
```

The `api.ts` client resolves them via:
```typescript
const httpClient = yield* HttpClient.HttpClient;
const credentials = yield* Credentials;
const endpoint = yield* Endpoint;
```

## Providing Dependencies

```typescript
import { FetchHttpClient } from "@effect/platform";

// Full layer for browser/Node.js usage
const live = Layer.mergeAll(
  FetchHttpClient.layer,
  Credentials.fromEnv(),
  Layer.succeed(Endpoint, Endpoint.DEFAULT),
);

// Usage
someOperation(input).pipe(Effect.provide(live));
```
