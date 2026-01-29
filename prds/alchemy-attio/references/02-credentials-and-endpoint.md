# 02 — Credentials & Endpoint

## Canonical Reference

- `packages/posthog/src/credentials.ts`
- `packages/posthog/src/endpoint.ts`

## Attio Authentication

Attio uses **Bearer token** authentication, identical to PostHog's pattern. API keys are generated in Workspace Settings > Developers > Create Integration.

```
Authorization: Bearer <access_token>
```

OAuth 2.0 is also supported but not needed for the distilled client (single-workspace SDK).

## Credentials — `src/credentials.ts`

```typescript
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { MissingCredentialsError } from "./errors.js";

export interface AttioCredentials {
  readonly apiKey: Redacted.Redacted<string>;
}

export class Credentials extends Context.Tag("@attio/Credentials")<
  Credentials,
  AttioCredentials
>() {
  static fromEnv(): Layer.Layer<Credentials, MissingCredentialsError> {
    return Layer.effect(
      Credentials,
      Effect.gen(function* () {
        const apiKey = yield* Config.redacted("ATTIO_API_KEY").pipe(
          Effect.mapError(
            () =>
              new MissingCredentialsError({
                message: "ATTIO_API_KEY environment variable is not set",
              })
          )
        );
        return { apiKey };
      })
    );
  }

  static fromApiKey(apiKey: string): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey: Redacted.make(apiKey) });
  }

  static fromRedactedApiKey(
    apiKey: Redacted.Redacted<string>
  ): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey });
  }
}
```

### Key Details

| Aspect | Value |
|---|---|
| Context tag ID | `"@attio/Credentials"` |
| Interface name | `AttioCredentials` |
| Env var | `ATTIO_API_KEY` |
| Auth type | Bearer token |
| API key storage | `Redacted.Redacted<string>` (prevents accidental logging) |

### Factory Methods

| Method | Use Case |
|---|---|
| `Credentials.fromEnv()` | Production — reads `ATTIO_API_KEY` from environment |
| `Credentials.fromApiKey("atk_...")` | Programmatic — wraps string in Redacted |
| `Credentials.fromRedactedApiKey(redacted)` | When you already have a Redacted value |

## Endpoint — `src/endpoint.ts`

```typescript
import * as Context from "effect/Context";

export class Endpoint extends Context.Tag("@attio/Endpoint")<
  Endpoint,
  string
>() {
  static readonly DEFAULT = "https://api.attio.com";
}
```

### Key Details

| Aspect | Value |
|---|---|
| Context tag ID | `"@attio/Endpoint"` |
| Default URL | `"https://api.attio.com"` |
| API version prefix | `/v2/` (part of service URI templates, NOT the endpoint) |

The endpoint is just the base URL. The `/v2/` version prefix is encoded in each service's URI template (e.g., `T.Http({ method: "GET", uri: "/v2/objects" })`).

## Auth Header in api.ts

The `executeWithInit` function in `api.ts` applies the Bearer token:

```typescript
const apiKey = Redacted.value(credentials.apiKey);
const baseRequest = HttpClientRequest.make(request.method)(fullUrl).pipe(
  HttpClientRequest.setHeaders({
    ...request.headers,
    Authorization: `Bearer ${apiKey}`,
  })
);
```

This is identical to the PostHog pattern. No changes needed in the auth header logic.
