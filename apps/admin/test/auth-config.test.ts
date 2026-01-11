/**
 * Tests for Better Auth configuration and environment validation
 *
 * Tests:
 * 1. Environment schema validation with Effect Schemas
 * 2. Branded type validation for OAuth credentials
 * 3. Database URL validation
 * 4. Auth configuration structure
 */
import {
  OAuthClientId,
  OAuthClientSecret,
  BetterAuthSecret,
  DatabaseUrl,
  Url,
  AuthEnv,
  loadAuthEnv,
  getAuthEnv,
} from "$/lib/env";
import { Either, Schema } from "effect";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

// =============================================================================
// Branded Type Tests
// =============================================================================

describe("OAuth Credential Branded Types", () => {
  describe("OAuthClientId", () => {
    it("should accept non-empty string", () => {
      const result =
        Schema.decodeUnknownEither(OAuthClientId)("client-id-12345");
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(OAuthClientId)("");
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should accept typical OAuth client ID format", () => {
      const result = Schema.decodeUnknownEither(OAuthClientId)(
        "123456789012-abcdefghijklmnop.apps.googleusercontent.com"
      );
      expect(Either.isRight(result)).toBe(true);
    });
  });

  describe("OAuthClientSecret", () => {
    it("should accept non-empty string", () => {
      const result =
        Schema.decodeUnknownEither(OAuthClientSecret)("GOCSPX-secret123");
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(OAuthClientSecret)("");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("BetterAuthSecret", () => {
    it("should accept string with 32+ characters", () => {
      const result = Schema.decodeUnknownEither(BetterAuthSecret)(
        "this-is-a-secret-with-at-least-32-characters"
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should accept exactly 32 characters", () => {
      const result = Schema.decodeUnknownEither(BetterAuthSecret)(
        "a".repeat(32)
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject string with fewer than 32 characters", () => {
      const result = Schema.decodeUnknownEither(BetterAuthSecret)(
        "a".repeat(31)
      );
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(BetterAuthSecret)("");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("DatabaseUrl", () => {
    it("should accept valid PostgreSQL URL", () => {
      const result = Schema.decodeUnknownEither(DatabaseUrl)(
        "postgresql://user:pass@localhost:5432/db"
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should accept PostgreSQL URL with options", () => {
      const result = Schema.decodeUnknownEither(DatabaseUrl)(
        "postgresql://user:pass@localhost:5432/db?sslmode=require"
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject non-postgresql URL", () => {
      const result = Schema.decodeUnknownEither(DatabaseUrl)(
        "mysql://user:pass@localhost:3306/db"
      );
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should reject http URL", () => {
      const result = Schema.decodeUnknownEither(DatabaseUrl)(
        "http://localhost:5432/db"
      );
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(DatabaseUrl)("");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("Url", () => {
    it("should accept http URL", () => {
      const result = Schema.decodeUnknownEither(Url)("http://localhost:3000");
      expect(Either.isRight(result)).toBe(true);
    });

    it("should accept https URL", () => {
      const result = Schema.decodeUnknownEither(Url)(
        "https://example.com/callback"
      );
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject non-http/https URL", () => {
      const result = Schema.decodeUnknownEither(Url)("ftp://example.com");
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(Url)("");
      expect(Either.isLeft(result)).toBe(true);
    });
  });
});

// =============================================================================
// AuthEnv Schema Tests
// =============================================================================

describe("AuthEnv Schema", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/template",
    BETTER_AUTH_SECRET: "this-is-a-secret-with-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    MICROSOFT_CLIENT_ID: "microsoft-client-id",
    MICROSOFT_CLIENT_SECRET: "microsoft-client-secret",
  };

  it("should accept valid environment", () => {
    const result = Schema.decodeUnknownEither(AuthEnv)(validEnv);
    expect(Either.isRight(result)).toBe(true);
  });

  it("should reject missing DATABASE_URL", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { DATABASE_URL, ...partial } = validEnv;
    const result = Schema.decodeUnknownEither(AuthEnv)(partial);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("should reject missing BETTER_AUTH_SECRET", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { BETTER_AUTH_SECRET, ...partial } = validEnv;
    const result = Schema.decodeUnknownEither(AuthEnv)(partial);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("should reject missing OAuth credentials", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { GOOGLE_CLIENT_ID, ...partial } = validEnv;
    const result = Schema.decodeUnknownEither(AuthEnv)(partial);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("should reject invalid DATABASE_URL format", () => {
    const result = Schema.decodeUnknownEither(AuthEnv)({
      ...validEnv,
      DATABASE_URL: "invalid-url",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("should reject short BETTER_AUTH_SECRET", () => {
    const result = Schema.decodeUnknownEither(AuthEnv)({
      ...validEnv,
      BETTER_AUTH_SECRET: "too-short",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("should reject invalid BETTER_AUTH_URL format", () => {
    const result = Schema.decodeUnknownEither(AuthEnv)({
      ...validEnv,
      BETTER_AUTH_URL: "not-a-url",
    });
    expect(Either.isLeft(result)).toBe(true);
  });
});

// =============================================================================
// loadAuthEnv Tests
// =============================================================================

describe("loadAuthEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load valid environment variables", () => {
    process.env["DATABASE_URL"] =
      "postgresql://postgres:postgres@localhost:5432/template";
    process.env["BETTER_AUTH_SECRET"] =
      "this-is-a-secret-with-at-least-32-characters";
    process.env["BETTER_AUTH_URL"] = "http://localhost:3000";
    process.env["GOOGLE_CLIENT_ID"] = "google-client-id";
    process.env["GOOGLE_CLIENT_SECRET"] = "google-client-secret";
    process.env["MICROSOFT_CLIENT_ID"] = "microsoft-client-id";
    process.env["MICROSOFT_CLIENT_SECRET"] = "microsoft-client-secret";

    const env = loadAuthEnv();

    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/template"
    );
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.GOOGLE_CLIENT_ID).toBe("google-client-id");
  });

  it("should throw on missing environment variables", () => {
    // Clear all relevant env vars
    delete process.env["DATABASE_URL"];
    delete process.env["BETTER_AUTH_SECRET"];
    delete process.env["BETTER_AUTH_URL"];
    delete process.env["GOOGLE_CLIENT_ID"];
    delete process.env["GOOGLE_CLIENT_SECRET"];
    delete process.env["MICROSOFT_CLIENT_ID"];
    delete process.env["MICROSOFT_CLIENT_SECRET"];

    expect(() => loadAuthEnv()).toThrow();
  });

  it("should throw on invalid DATABASE_URL", () => {
    process.env["DATABASE_URL"] = "invalid-url";
    process.env["BETTER_AUTH_SECRET"] =
      "this-is-a-secret-with-at-least-32-characters";
    process.env["BETTER_AUTH_URL"] = "http://localhost:3000";
    process.env["GOOGLE_CLIENT_ID"] = "google-client-id";
    process.env["GOOGLE_CLIENT_SECRET"] = "google-client-secret";
    process.env["MICROSOFT_CLIENT_ID"] = "microsoft-client-id";
    process.env["MICROSOFT_CLIENT_SECRET"] = "microsoft-client-secret";

    expect(() => loadAuthEnv()).toThrow();
  });
});

// =============================================================================
// getAuthEnv Tests
// =============================================================================

describe("getAuthEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return environment variables when set", () => {
    process.env["DATABASE_URL"] =
      "postgresql://custom:custom@custom-host:5432/custom-db";
    process.env["BETTER_AUTH_SECRET"] =
      "custom-secret-with-at-least-32-characters";
    process.env["BETTER_AUTH_URL"] = "https://custom-url.com";
    process.env["GOOGLE_CLIENT_ID"] = "custom-google-id";
    process.env["GOOGLE_CLIENT_SECRET"] = "custom-google-secret";
    process.env["MICROSOFT_CLIENT_ID"] = "custom-microsoft-id";
    process.env["MICROSOFT_CLIENT_SECRET"] = "custom-microsoft-secret";

    const env = getAuthEnv();

    expect(env.DATABASE_URL).toBe(
      "postgresql://custom:custom@custom-host:5432/custom-db"
    );
    expect(env.BETTER_AUTH_URL).toBe("https://custom-url.com");
    expect(env.GOOGLE_CLIENT_ID).toBe("custom-google-id");
  });

  it("should return defaults when env vars are not set", () => {
    // Clear all relevant env vars
    delete process.env["DATABASE_URL"];
    delete process.env["BETTER_AUTH_SECRET"];
    delete process.env["BETTER_AUTH_URL"];
    delete process.env["GOOGLE_CLIENT_ID"];
    delete process.env["GOOGLE_CLIENT_SECRET"];
    delete process.env["MICROSOFT_CLIENT_ID"];
    delete process.env["MICROSOFT_CLIENT_SECRET"];

    const env = getAuthEnv();

    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/template"
    );
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.GOOGLE_CLIENT_ID).toBe("placeholder-google-client-id");
    expect(env.MICROSOFT_CLIENT_ID).toBe("placeholder-microsoft-client-id");
  });

  it("should return development defaults for Better Auth secret", () => {
    delete process.env["BETTER_AUTH_SECRET"];

    const env = getAuthEnv();

    expect(env.BETTER_AUTH_SECRET).toBe(
      "development-secret-key-min-32-chars-long"
    );
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
