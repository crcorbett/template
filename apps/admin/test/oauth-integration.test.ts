/**
 * Integration tests for OAuth flow with mocked providers
 *
 * Tests:
 * 1. OAuth provider configuration
 * 2. Session creation and validation flow
 * 3. Token refresh patterns
 * 4. Provider-specific handling (Google, Microsoft)
import type { AuthContext } from "@packages/types";

import {
  getSession,
  requireSession,
  validateToken,
  SessionValidationError,
} from "$/lib/effect/services/auth";
import { Account } from "@packages/types";
import { Effect, Exit, Option, Schema } from "effect";
 */
import { describe, expect, it } from "vitest";

import {
  createMockAuthContext,
  createMockAuthLayer,
  createMockUser,
  createMockSession,
  TEST_USER_ID,
  TEST_SESSION_ID,
} from "./setup";

// =============================================================================
// OAuth Account Schema Tests
// =============================================================================

describe("OAuth Account Schema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const nowIso = new Date().toISOString();
  const futureHourIso = new Date(Date.now() + 3600000).toISOString();
  const futureDayIso = new Date(Date.now() + 86400000).toISOString();

  const makeAccount = (overrides: Record<string, unknown> = {}) => ({
    id: validUuid,
    userId: validUuid,
    accountId: "provider-account-123",
    providerId: "google",
    accessToken: "ya29.access-token",
    refreshToken: "1//refresh-token",
    accessTokenExpiresAt: futureHourIso,
    refreshTokenExpiresAt: futureDayIso,
    scope: "openid profile email",
    idToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.id-token",
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  });

  describe("Google OAuth Account", () => {
    it("should accept valid Google OAuth account", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({ providerId: "google" })
      );
      expect(result._tag).toBe("Right");
    });

    it("should accept account with all optional fields null", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({
          providerId: "google",
          accessToken: null,
          refreshToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
          idToken: null,
        })
      );
      expect(result._tag).toBe("Right");
    });

    it("should validate account with offline access token", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({
          providerId: "google",
          refreshToken: "1//offline-refresh-token",
        })
      );
      expect(result._tag).toBe("Right");
    });
  });

  describe("Microsoft OAuth Account", () => {
    it("should accept valid Microsoft OAuth account", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({
          providerId: "microsoft",
          accessToken: "EwB...microsoft-token",
          scope: "openid profile email User.Read",
        })
      );
      expect(result._tag).toBe("Right");
    });

    it("should accept Microsoft account with graph API scope", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({
          providerId: "microsoft",
          scope: "User.Read Mail.Read Calendars.Read",
        })
      );
      expect(result._tag).toBe("Right");
    });
  });

  describe("Provider Validation", () => {
    it("should reject unsupported provider", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({ providerId: "github" })
      );
      expect(result._tag).toBe("Left");
    });

    it("should reject empty provider", () => {
      const result = Schema.decodeUnknownEither(Account)(
        makeAccount({ providerId: "" })
      );
      expect(result._tag).toBe("Left");
    });
  });
});

// =============================================================================
// OAuth Session Flow Tests
// =============================================================================

describe("OAuth Session Flow", () => {
  describe("Session creation after OAuth callback", () => {
    it("should create session with OAuth user data", async () => {
      // Simulate a session created after OAuth callback using mock helpers
      // which already decode and validate the data
      const oauthUser = createMockUser({
        id: TEST_USER_ID,
        email: "oauth.user@gmail.com",
        emailVerified: true,
        name: "OAuth User",
      });
      const oauthSession = createMockSession({ userId: TEST_USER_ID });
      const authContext = {
        user: oauthUser,
        session: oauthSession,
      } as AuthContext;

      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        const result = yield* requireSession(new Headers());
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.user.email).toBe("oauth.user@gmail.com");
      expect(result.user.emailVerified).toBe(true);
      expect(result.user.name).toBe("OAuth User");
    });

    it("should include session token for cookie-based auth", async () => {
      const authContext = createMockAuthContext();
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        const result = yield* requireSession(new Headers());
        return result.session.token;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Session validation from cookies", () => {
    it("should validate session from cookie header", async () => {
      const authContext = createMockAuthContext();
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        // In real implementation, headers would contain cookie
        const headers = new Headers();
        headers.set(
          "cookie",
          `better-auth.session_token=${authContext.session.token}`
        );
        const result = yield* getSession(headers);
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isSome(result)).toBe(true);
    });

    it("should return None for expired session", async () => {
      // Mock layer returns no session for expired tokens
      const testLayer = createMockAuthLayer({ session: null });

      const effect = Effect.gen(function* () {
        const result = yield* validateToken("expired-session-token");
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe("Session refresh flow", () => {
    it("should validate fresh session token", async () => {
      const authContext = createMockAuthContext();
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        // Validate the current token
        const result = yield* validateToken("fresh-session-token");
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        expect(result.value.session.expiresAt).toBeDefined();
      }
    });
  });
});

// =============================================================================
// OAuth Error Handling Tests
// =============================================================================

describe("OAuth Error Handling", () => {
  describe("Provider authentication errors", () => {
    it("should handle provider rejection gracefully", async () => {
      const testLayer = createMockAuthLayer({
        session: null,
        getSessionError: new SessionValidationError({
          message: "OAuth provider rejected authentication",
          cause: { provider: "google", error: "access_denied" },
        }),
      });

      const effect = Effect.gen(function* () {
        const result = yield* getSession(new Headers());
        return result;
      }).pipe(
        Effect.catchTag("SessionValidationError", (error) =>
          Effect.succeed({ error: error.message, cause: error.cause })
        )
      );

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toEqual({
        error: "OAuth provider rejected authentication",
        cause: { provider: "google", error: "access_denied" },
      });
    });

    it("should handle token validation failure", async () => {
      const testLayer = createMockAuthLayer({
        session: null,
        getSessionError: new SessionValidationError({
          message: "Token validation failed",
          cause: { reason: "invalid_signature" },
        }),
      });

      const effect = validateToken("invalid-token").pipe(
        Effect.catchTag("SessionValidationError", (error) =>
          Effect.succeed({ failed: true, message: error.message })
        )
      );

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toEqual({
        failed: true,
        message: "Token validation failed",
      });
    });
  });

  describe("Session not found errors", () => {
    it("should fail with NoSessionError when no session exists", async () => {
      const testLayer = createMockAuthLayer({ session: null });

      const effect = requireSession(new Headers());

      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should allow graceful handling of missing session", async () => {
      const testLayer = createMockAuthLayer({ session: null });

      const effect = requireSession(new Headers()).pipe(
        Effect.catchTag("NoSessionError", () =>
          Effect.succeed({ redirectTo: "/login" })
        )
      );

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toEqual({ redirectTo: "/login" });
    });
  });
});

// =============================================================================
// OAuth User Data Tests
// =============================================================================

describe("OAuth User Data Handling", () => {
  it("should preserve user profile data from OAuth provider", async () => {
    const oauthUser = createMockUser({
      id: TEST_USER_ID,
      email: "profile.test@example.com",
      emailVerified: true,
      name: "Profile Test User",
      image: "https://lh3.googleusercontent.com/a/profile-image",
    });

    const oauthSession = createMockSession({ userId: TEST_USER_ID });
    // User and Session are already decoded by createMockUser/createMockSession
    const authContext = {
      user: oauthUser,
      session: oauthSession,
    } as AuthContext;

    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = requireSession(new Headers());

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result.user.name).toBe("Profile Test User");
    expect(result.user.image).toBe(
      "https://lh3.googleusercontent.com/a/profile-image"
    );
  });

  it("should handle user without profile image", async () => {
    const oauthUser = createMockUser({
      name: "No Image User",
      image: null,
    });

    const oauthSession = createMockSession();
    // User and Session are already decoded by createMockUser/createMockSession
    const authContext = {
      user: oauthUser,
      session: oauthSession,
    } as AuthContext;

    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = requireSession(new Headers());

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result.user.image).toBeNull();
  });

  it("should handle user without name (email-only OAuth)", async () => {
    const oauthUser = createMockUser({
      email: "noname@example.com",
      name: null,
    });

    const oauthSession = createMockSession();
    // User and Session are already decoded by createMockUser/createMockSession
    const authContext = {
      user: oauthUser,
      session: oauthSession,
    } as AuthContext;

    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = requireSession(new Headers());

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result.user.name).toBeNull();
    expect(result.user.email).toBe("noname@example.com");
  });
});

// =============================================================================
// Branded ID Type Tests for OAuth
// =============================================================================

describe("OAuth Branded ID Types", () => {
  it("should use branded UserId in auth context", async () => {
    const authContext = createMockAuthContext({ userId: TEST_USER_ID });
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = requireSession(new Headers());

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    // UserId should be a branded string matching UUID pattern
    expect(result.user.id).toBe(TEST_USER_ID);
    expect(result.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("should use branded SessionId in session", async () => {
    const authContext = createMockAuthContext({ sessionId: TEST_SESSION_ID });
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = requireSession(new Headers());

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("should use branded Email in user", async () => {
    const authContext = createMockAuthContext({ email: "branded@oauth.test" });
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = requireSession(new Headers());

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result.user.email).toBe("branded@oauth.test");
    expect(result.user.email).toContain("@");
  });
});
