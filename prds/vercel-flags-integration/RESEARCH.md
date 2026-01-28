# Vercel Flags SDK + PostHog Integration Research

**Date:** 2026-01-28
**Goal:** Understand how to use PostHog feature flags (managed by `@packages/posthog` and `@packages/alchemy-posthog`) with the Vercel Flags SDK so feature flags appear in the Vercel Toolbar on deployed apps.

---

## Executive Summary

The Vercel Flags SDK (`flags` package, v3.x) provides a standardized way to define, evaluate, and override feature flags in Next.js apps. An official PostHog adapter (`@flags-sdk/posthog`) already exists and uses `posthog-node` under the hood. The Vercel Toolbar's **Flags Explorer** reads flag definitions from a `/.well-known/vercel/flags` discovery endpoint and allows team members to override flag values via an encrypted cookie.

Our `@packages/posthog` SDK and `@packages/alchemy-posthog` IaC package manage PostHog feature flags via the PostHog HTTP API using Effect TS. The integration opportunity is to either (a) use the existing `@flags-sdk/posthog` adapter directly, or (b) build a custom Effect-aware adapter that leverages our typed SDK instead of `posthog-node`.

---

## 1. Vercel Flags SDK Architecture

### Core Concept

The Flags SDK treats feature flags as **server-side functions** that resolve values during request handling. Flags are never evaluated on the client -- only the resolved value is passed to React components.

### The `flag()` Function

```typescript
import { flag } from "flags/next";

export const myFlag = flag<boolean>({
  key: "my-flag",                     // Unique identifier
  defaultValue: false,                // Fallback if decide() returns undefined
  description: "My feature flag",     // Shown in Flags Explorer
  options: [                          // Shown in Flags Explorer for overrides
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  identify: async ({ cookies }) => {  // Resolve user identity from request
    return { distinctId: cookies.get("user-id")?.value ?? "anon" };
  },
  decide: async ({ entities }) => {   // Evaluate the flag
    // Call your provider here
    return false;
  },
  // OR use an adapter instead of decide:
  // adapter: postHogAdapter.isFeatureEnabled(),
});
```

**Evaluation lifecycle:**
1. Check for override in `vercel-flag-overrides` cookie (set by Toolbar) -- if found, skip `decide`
2. Resolve entities via `identify()`
3. Call `decide()` (or adapter's `decide`) with entities, headers, cookies
4. If undefined, fall back to `defaultValue`
5. Report value to Vercel Runtime Logs

**Calling a flag** in a React Server Component:
```typescript
const value = await myFlag(); // Returns the resolved value
```

### Adapter Interface

Adapters encapsulate provider-specific evaluation logic:

```typescript
interface Adapter<ValueType, EntitiesType> {
  initialize?: () => Promise<void>;
  identify?: Identify<EntitiesType>;
  origin?: Origin | string | ((key: string) => Origin | string | undefined);
  decide: (params: {
    key: string;
    entities?: EntitiesType;
    headers: ReadonlyHeaders;
    cookies: ReadonlyRequestCookies;
    defaultValue?: ValueType;
  }) => Promise<ValueType> | ValueType;
}
```

Key points:
- `decide` is the only required method
- `origin` provides a link back to the flag in the provider's dashboard (shown in Flags Explorer)
- `identify` on the adapter can be overridden by `identify` on the flag definition

---

## 2. Existing PostHog Adapter: `@flags-sdk/posthog`

### Package Details

- **npm:** `@flags-sdk/posthog` (v0.2.2)
- **Dependency:** `posthog-node` (PostHog's official Node.js SDK)
- **Source:** `github.com/vercel/flags` → `packages/adapter-posthog/`

### Three Evaluation Methods

```typescript
import { postHogAdapter } from "@flags-sdk/posthog";

// 1. Boolean evaluation
postHogAdapter.isFeatureEnabled()
// → Adapter<boolean, PostHogEntities>

// 2. Multivariate string/boolean value
postHogAdapter.featureFlagValue()
// → Adapter<string | boolean, PostHogEntities>

// 3. JSON payload attached to flag
postHogAdapter.featureFlagPayload((payload) => transform(payload))
// → Adapter<T, PostHogEntities>
```

### Entity Requirements

The adapter requires `{ distinctId: string }` from the `identify` function:

```typescript
interface PostHogEntities {
  distinctId: string;
}
```

### Default Client Configuration

When using the singleton `postHogAdapter`, the adapter auto-configures from environment variables:

```
NEXT_PUBLIC_POSTHOG_KEY       → PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST      → e.g., https://us.i.posthog.com
POSTHOG_PERSONAL_API_KEY      → Personal API key (for getProviderData)
```

Custom initialization:

```typescript
import { createPostHogAdapter } from "@flags-sdk/posthog";

const adapter = createPostHogAdapter({
  postHogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY!,
  postHogOptions: {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
    featureFlagsPollingInterval: 10_000,
    disableGeoip: true,
  },
});
```

### `getProviderData` (for Flags Explorer)

The adapter includes a `getProviderData` function that fetches flag definitions from PostHog's API and formats them for the Flags Explorer:

```typescript
import { getProviderData } from "@flags-sdk/posthog";

const providerData = await getProviderData({
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
  projectId: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID!,
  appHost: "https://us.posthog.com", // optional
});
// Returns: { definitions, hints }
```

This function:
- Calls `GET /api/projects/{projectId}/feature_flags` (paginated, 100/page)
- Maps each flag to `{ origin, description, createdAt, options }`
- `origin` links back to the flag in the PostHog dashboard

---

## 3. Vercel Toolbar Integration

### Discovery Endpoint

The Toolbar discovers flags via `/.well-known/vercel/flags`:

```typescript
// app/.well-known/vercel/flags/route.ts
import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import { getProviderData as getPostHogProviderData } from "@flags-sdk/posthog";
import { mergeProviderData } from "flags";
import * as flags from "../../../../flags";

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return mergeProviderData([
    getProviderData(flags),           // Local flag definitions
    getPostHogProviderData({          // PostHog remote definitions
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      projectId: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID!,
    }),
  ]);
});
```

This endpoint:
- Validates `Authorization` header using `FLAGS_SECRET`
- Returns flag definitions, options, and hints as JSON
- The Toolbar reads this to populate the Flags Explorer UI

### Override Mechanism

1. User clicks a flag in the Toolbar's Flags Explorer
2. Toolbar sets an **encrypted cookie** (`vercel-flag-overrides`) using `FLAGS_SECRET`
3. On next request, `flag()` checks the cookie **before** calling `decide()`
4. If an override exists, it's returned immediately -- `decide()` is skipped

### Required Environment Variable

```bash
# Generate with: node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
FLAGS_SECRET=<32 random bytes, base64url>
```

---

## 4. Precomputation Pattern

For static pages that need feature flags, the Flags SDK supports precomputation via middleware:

```typescript
// middleware.ts
import { precompute } from "flags/next";
import { marketingFlags } from "./flags";

export async function middleware(request: NextRequest) {
  const code = await precompute(marketingFlags);
  return NextResponse.rewrite(new URL(`/${code}${request.nextUrl.pathname}`, request.url));
}

// app/[code]/page.tsx
export default async function Page({ params }) {
  const { code } = await params;
  const banner = await showBanner(code, marketingFlags);
  // ...
}
```

**Limitation:** `posthog-node` does not support Edge Runtime. Middleware must use `export const runtime = 'nodejs'` or use a different evaluation strategy for edge.

---

## 5. Our Packages vs. the Official Adapter

### What We Have

| Package | Purpose | Key Capability |
|---|---|---|
| `@packages/posthog` | Typed PostHog HTTP API client (Effect TS) | CRUD for feature flags, dashboards, experiments, etc. |
| `@packages/alchemy-posthog` | IaC resource provisioning | Declarative feature flag management via Alchemy Effect |

### What the Official Adapter Uses

| Dependency | Purpose |
|---|---|
| `posthog-node` | PostHog's official Node.js SDK for flag evaluation |

### Key Difference

Our `@packages/posthog` is an **admin/management API client** -- it creates, updates, lists, and deletes feature flags. The official adapter's `posthog-node` is a **runtime evaluation client** -- it evaluates flags for a specific user (distinct ID) using PostHog's `/decide` endpoint.

These serve different purposes:
- **Admin API** (`@packages/posthog`): "Create a flag called `beta-feature` with 50% rollout"
- **Runtime evaluation** (`posthog-node`): "Is `beta-feature` enabled for user `abc123`?"

### Integration Opportunities

#### Option A: Use `@flags-sdk/posthog` Directly

The simplest path. Use the existing adapter for runtime evaluation and our packages for flag management/IaC:

```typescript
// Flag definition uses official adapter
import { flag } from "flags/next";
import { postHogAdapter } from "@flags-sdk/posthog";

export const betaFeature = flag({
  key: "beta-feature",
  defaultValue: false,
  adapter: postHogAdapter.isFeatureEnabled(),
  identify: async ({ cookies }) => ({
    distinctId: cookies.get("user-id")?.value ?? "anon",
  }),
});

// Flag provisioning uses our IaC
// alchemy.run.ts
class BetaFeature extends FeatureFlag("BetaFeature", {
  key: "beta-feature",
  name: "Beta Feature",
  active: true,
  rolloutPercentage: 50,
});
```

**Pros:** Minimal effort, well-tested, maintained by Vercel
**Cons:** Adds `posthog-node` dependency, not Effect-aware, no type-level integration with our SDK

#### Option B: Custom Effect-Aware Adapter

Build an adapter that uses our `@packages/posthog` SDK or calls the PostHog `/decide` endpoint directly via Effect:

```typescript
import type { Adapter } from "flags";

// Note: Our SDK currently only has admin API operations.
// For runtime evaluation, we'd need to add a /decide endpoint call
// or use posthog-node internally.
export function createEffectPostHogAdapter(): PostHogAdapter {
  return {
    isFeatureEnabled: () => ({
      origin: (key) => `https://us.posthog.com/feature_flags/${key}`,
      async decide({ key, entities, defaultValue }) {
        // Would need to call PostHog's /decide endpoint
        // or use posthog-node under the hood
      },
    }),
  };
}
```

**Pros:** Full Effect integration, no `posthog-node` dependency, type-safe
**Cons:** More work, need to implement `/decide` evaluation, need to maintain

#### Option C: Custom `getProviderData` Using Our SDK

Replace only the `getProviderData` function (used by the Flags Explorer) with one that uses our typed SDK, while keeping the official adapter for evaluation:

```typescript
import { FeatureFlags, Credentials, Endpoint } from "@packages/posthog";
import { Effect } from "effect";
import type { ProviderData } from "flags";

export function getProviderData(config: {
  projectId: string;
  apiKey: string;
  endpoint?: string;
}): Promise<ProviderData> {
  return Effect.gen(function* () {
    const flags = yield* FeatureFlags.listFeatureFlags({
      project_id: config.projectId,
    });

    const definitions = Object.fromEntries(
      (flags.results ?? []).map((f) => [
        f.key,
        {
          origin: `${config.endpoint ?? "https://us.posthog.com"}/feature_flags/${f.id}`,
          description: f.name ?? "",
          createdAt: f.created_at ? new Date(f.created_at) : undefined,
          options: [
            { value: true, label: "Enabled" },
            { value: false, label: "Disabled" },
          ],
        },
      ])
    );

    return { definitions };
  }).pipe(
    Effect.provideService(Credentials, { apiKey: config.apiKey }),
    Effect.provideService(Endpoint, { url: config.endpoint ?? "https://us.posthog.com" }),
    Effect.runPromise,
  );
}
```

**Pros:** Uses our typed SDK, no extra dependency for discovery, consistent with IaC
**Cons:** Only covers discovery, still needs `posthog-node` for evaluation

---

## 6. Known Issues and Limitations

1. **Edge Runtime:** `posthog-node` does not support Edge Runtime. Middleware using the PostHog adapter must set `export const runtime = 'nodejs'`.

2. **Only active flags loaded:** The adapter originally filtered to only active flags (fixed in PR #153). Disabled flags in PostHog wouldn't appear in the Flags Explorer unless you updated the adapter.

3. **`identify` is mandatory:** Omitting the `identify` function throws a runtime error. Every flag must provide a way to resolve `{ distinctId: string }`.

4. **Key trimming:** The adapter's `trimKey` function splits keys on `.`, supporting patterns like `my-flag.is-enabled`. Our flag keys should not contain dots.

5. **Polling interval:** The default `posthog-node` client polls for flag updates every 10 seconds. This is configurable via `featureFlagsPollingInterval`.

---

## 7. Required Setup for Vercel Toolbar

### Minimal Setup Checklist

1. Install packages:
   ```bash
   pnpm i flags @flags-sdk/posthog
   ```

2. Set environment variables (Vercel project settings + `.env.local`):
   ```
   FLAGS_SECRET=<generated>
   NEXT_PUBLIC_POSTHOG_KEY=<project API key>
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   POSTHOG_PERSONAL_API_KEY=<personal API key>
   NEXT_PUBLIC_POSTHOG_PROJECT_ID=<project ID>
   ```

3. Define flags in `flags.ts`:
   ```typescript
   import { flag } from "flags/next";
   import { postHogAdapter } from "@flags-sdk/posthog";

   export const myFlag = flag({
     key: "my-flag",
     defaultValue: false,
     adapter: postHogAdapter.isFeatureEnabled(),
     identify: async ({ cookies }) => ({
       distinctId: cookies.get("ph-id")?.value ?? "anon",
     }),
   });
   ```

4. Create discovery endpoint at `app/.well-known/vercel/flags/route.ts`:
   ```typescript
   import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
   import { getProviderData as getPostHogProviderData } from "@flags-sdk/posthog";
   import { mergeProviderData } from "flags";
   import * as flags from "../../../../flags";

   export const GET = createFlagsDiscoveryEndpoint(async () => {
     return mergeProviderData([
       getProviderData(flags),
       getPostHogProviderData({
         personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
         projectId: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID!,
       }),
     ]);
   });
   ```

5. Use flags in Server Components:
   ```typescript
   import { myFlag } from "@/flags";

   export default async function Page() {
     const enabled = await myFlag();
     return enabled ? <NewFeature /> : <OldFeature />;
   }
   ```

6. Deploy to Vercel -- the Toolbar automatically discovers flags via the endpoint.

---

## 8. How This Relates to `alchemy-posthog`

The `@packages/alchemy-posthog` IaC layer manages feature flag **definitions** in PostHog (create/update/delete). The Vercel Flags SDK manages feature flag **evaluation** at runtime. These are complementary:

```
┌─────────────────────────┐     ┌────────────────────────────┐
│  alchemy-posthog (IaC)  │     │   Vercel Flags SDK (App)   │
│                         │     │                            │
│  Defines flags in       │────▶│  Evaluates flags for       │
│  PostHog via API        │     │  users at request time     │
│                         │     │                            │
│  FeatureFlag("beta", {  │     │  flag({ key: "beta",       │
│    key: "beta",         │     │    adapter: posthog...      │
│    active: true,        │     │  })                        │
│    rolloutPercentage:50 │     │                            │
│  })                     │     │  const v = await beta();   │
└─────────────────────────┘     └────────────────────────────┘
         ▲                                   │
         │                                   │
         │         ┌──────────────┐          │
         └─────────│   PostHog    │◀─────────┘
                   │   (remote)   │
                   └──────────────┘
```

The IaC layer ensures flags exist with the right configuration. The Flags SDK ensures they're evaluated correctly at runtime. The Vercel Toolbar provides a UI to inspect and override them during development/QA.

---

## 9. Open Questions

1. **Do we want a custom adapter or the official one?** The official `@flags-sdk/posthog` adapter is functional and maintained. Building a custom Effect-aware adapter is more work but would avoid the `posthog-node` dependency.

2. **Should `getProviderData` use our SDK?** We could replace the adapter's `getProviderData` with one built on `@packages/posthog`, giving us typed access to flag definitions without `posthog-node`.

3. **Code generation?** Could we generate `flag()` definitions from `alchemy-posthog` resource declarations? e.g., `FeatureFlag("Beta", { key: "beta" })` auto-generates a corresponding `flag({ key: "beta", ... })` definition.

4. **Edge Runtime?** If we need middleware-based precomputation, we'll need to solve the Edge Runtime limitation (either use Node.js runtime or build a lightweight `/decide` client).

---

## Sources

- [Flags SDK Official Docs](https://flags-sdk.dev)
- [PostHog Provider Docs](https://flags-sdk.dev/providers/posthog)
- [Custom Adapters Docs](https://flags-sdk.dev/providers/custom-adapters)
- [Vercel Flags SDK GitHub](https://github.com/vercel/flags)
- [@flags-sdk/posthog on npm](https://www.npmjs.com/package/@flags-sdk/posthog)
- [PostHog Vercel Integration Docs](https://posthog.com/docs/libraries/vercel)
- [Vercel Toolbar Feature Flags Docs](https://vercel.com/docs/feature-flags)
- [GitHub Issue #152: PostHog Provider Issues](https://github.com/vercel/flags/issues/152)
