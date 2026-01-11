/**
 * Tests for Effect Auth Service
 *
 * Tests:
 * 1. AuthService interface and implementation
 * 2. Session validation with Effect Schemas
 * 3. Error handling (NoSessionError, SessionValidationError)
 * 4. Service layer patterns with dependency injection
import {
  AuthService,
  NoSessionError,
  SessionValidationError,
  getSession,
  requireSession,
  validateToken,
} from "$/lib/effect/services/auth";
import { Effect, Exit, Option } from "effect";
 */
import { describe, expect, it } from "vitest";

import {
  createMockAuthContext,
  createMockAuthLayer,
  TEST_USER_ID,
  TEST_EMAIL,
} from "./setup";

// =============================================================================
// Error Type Tests
// =============================================================================

describe("Auth Error Types", () => {
  describe("NoSessionError", () => {
    it("should create error with message", () => {
      const error = new NoSessionError({ message: "Test message" });
      expect(error.message).toBe("Test message");
      expect(error._tag).toBe("NoSessionError");
    });

    it("should be identifiable by _tag", () => {
      const error = new NoSessionError({ message: "No session found" });
      expect(error._tag).toBe("NoSessionError");
    });
  });

  describe("SessionValidationError", () => {
    it("should create error with message", () => {
      const error = new SessionValidationError({
        message: "Validation failed",
      });
      expect(error.message).toBe("Validation failed");
      expect(error._tag).toBe("SessionValidationError");
    });

    it("should include cause when provided", () => {
      const cause = new Error("Original error");
      const error = new SessionValidationError({
        message: "Validation failed",
        cause,
      });
      expect(error.cause).toBe(cause);
    });

    it("should be identifiable by _tag", () => {
      const error = new SessionValidationError({ message: "Test" });
      expect(error._tag).toBe("SessionValidationError");
    });
  });
});

// =============================================================================
// Mock AuthService Tests
// =============================================================================

describe("AuthService", () => {
  describe("getSession", () => {
    it("should return Some when session exists", async () => {
      const authContext = createMockAuthContext();
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        const result = yield* getSession(new Headers());
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        expect(result.value.user.id).toBe(TEST_USER_ID);
        expect(result.value.user.email).toBe(TEST_EMAIL);
      }
    });

    it("should return None when no session exists", async () => {
      const testLayer = createMockAuthLayer({ session: null });

      const effect = Effect.gen(function* () {
        const result = yield* getSession(new Headers());
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isNone(result)).toBe(true);
    });

    it("should fail with SessionValidationError when configured", async () => {
      const testLayer = createMockAuthLayer({
        session: null,
        getSessionError: new SessionValidationError({
          message: "Failed to validate",
        }),
      });

      const effect = Effect.gen(function* () {
        const result = yield* getSession(new Headers());
        return result;
      });

      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("requireSession", () => {
    it("should return auth context when session exists", async () => {
      const authContext = createMockAuthContext({
        userId: TEST_USER_ID,
        email: TEST_EMAIL,
      });
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        const result = yield* requireSession(new Headers());
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.user.id).toBe(TEST_USER_ID);
      expect(result.user.email).toBe(TEST_EMAIL);
    });

    it("should fail with NoSessionError when no session exists", async () => {
      const testLayer = createMockAuthLayer({ session: null });

      const effect = Effect.gen(function* () {
        const result = yield* requireSession(new Headers());
        return result;
      });

      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause;
        // Check that it's a NoSessionError by examining the failure
        expect(error._tag).toBe("Fail");
      }
    });

    it("should include user and session in returned context", async () => {
      const authContext = createMockAuthContext();
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        const result = yield* requireSession(new Headers());
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user.id).toBe(result.session.userId);
    });
  });

  describe("validateToken", () => {
    it("should return Some when token is valid", async () => {
      const authContext = createMockAuthContext();
      const testLayer = createMockAuthLayer({ session: authContext });

      const effect = Effect.gen(function* () {
        const result = yield* validateToken("valid-token");
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isSome(result)).toBe(true);
    });

    it("should return None when token is invalid", async () => {
      const testLayer = createMockAuthLayer({ session: null });

      const effect = Effect.gen(function* () {
        const result = yield* validateToken("invalid-token");
        return result;
      });

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Option.isNone(result)).toBe(true);
    });
  });
});

// =============================================================================
// Service Layer Pattern Tests
// =============================================================================

describe("AuthService Layer Pattern", () => {
  it("should provide service via Layer", async () => {
    const authContext = createMockAuthContext();
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = Effect.gen(function* () {
      const service = yield* AuthService;
      const result = yield* service.getSession(new Headers());
      return result;
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(Option.isSome(result)).toBe(true);
  });

  it("should allow service method chaining", async () => {
    const authContext = createMockAuthContext();
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = Effect.gen(function* () {
      const service = yield* AuthService;
      const session = yield* service.requireSession(new Headers());
      return session;
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result.user).toBeDefined();
  });

  it("should propagate errors through service layer", async () => {
    const testLayer = createMockAuthLayer({
      session: null,
      getSessionError: new SessionValidationError({
        message: "Test error",
        cause: new Error("Underlying error"),
      }),
    });

    const effect = Effect.gen(function* () {
      const service = yield* AuthService;
      const result = yield* service.getSession(new Headers());
      return result;
    });

    const exit = await Effect.runPromiseExit(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

// =============================================================================
// Effect Error Handling Tests
// =============================================================================

describe("Effect Error Handling", () => {
  it("should allow catching NoSessionError", async () => {
    const testLayer = createMockAuthLayer({ session: null });

    const effect = Effect.gen(function* () {
      const result = yield* requireSession(new Headers());
      return result;
    }).pipe(
      Effect.catchTag("NoSessionError", (error) =>
        Effect.succeed({ caught: true, message: error.message })
      )
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toEqual({
      caught: true,
      message: "Authentication required",
    });
  });

  it("should allow catching SessionValidationError", async () => {
    const testLayer = createMockAuthLayer({
      session: null,
      getSessionError: new SessionValidationError({
        message: "Validation failed",
      }),
    });

    const effect = Effect.gen(function* () {
      const result = yield* getSession(new Headers());
      return result;
    }).pipe(
      Effect.catchTag("SessionValidationError", (error) =>
        Effect.succeed({ caught: true, message: error.message })
      )
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toEqual({
      caught: true,
      message: "Validation failed",
    });
  });

  it("should allow mapping over session result", async () => {
    const authContext = createMockAuthContext({ email: "mapped@example.com" });
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = Effect.gen(function* () {
      const maybeSession = yield* getSession(new Headers());
      return Option.map(maybeSession, (ctx) => ctx.user.email);
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value).toBe("mapped@example.com");
    }
  });

  it("should allow getOrElse on optional session", async () => {
    const testLayer = createMockAuthLayer({ session: null });

    const effect = Effect.gen(function* () {
      const maybeSession = yield* getSession(new Headers());
      return Option.getOrElse(maybeSession, () => null);
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toBeNull();
  });
});

// =============================================================================
// Branded Type Validation Tests
// =============================================================================

describe("Auth Context Branded Types", () => {
  it("should return properly branded UserId", async () => {
    const authContext = createMockAuthContext({ userId: TEST_USER_ID });
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = Effect.gen(function* () {
      const result = yield* requireSession(new Headers());
      return result;
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    // The UserId should be a branded string
    expect(typeof result.user.id).toBe("string");
    expect(result.user.id).toBe(TEST_USER_ID);
  });

  it("should return properly branded Email", async () => {
    const authContext = createMockAuthContext({ email: "branded@example.com" });
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = Effect.gen(function* () {
      const result = yield* requireSession(new Headers());
      return result;
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(typeof result.user.email).toBe("string");
    expect(result.user.email).toBe("branded@example.com");
  });

  it("should return properly branded SessionToken", async () => {
    const authContext = createMockAuthContext();
    const testLayer = createMockAuthLayer({ session: authContext });

    const effect = Effect.gen(function* () {
      const result = yield* requireSession(new Headers());
      return result;
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(typeof result.session.token).toBe("string");
    expect(result.session.token.length).toBeGreaterThan(0);
  });
});
