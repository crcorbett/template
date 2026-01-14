import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

import {
  AuthenticationError,
  AuthorizationError,
  COMMON_ERRORS,
  NotFoundError,
  PostHogError,
  RateLimitError,
  ServerError,
  UnknownPostHogError,
  ValidationError,
} from "../src/errors.js";

describe("Error Schemas", () => {
  describe("PostHogError", () => {
    it("should create error with code, message, and details", () => {
      const error = new PostHogError({
        code: "TEST_ERROR",
        message: "Something went wrong",
        details: { foo: "bar" },
      });

      expect(error._tag).toBe("PostHogError");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Something went wrong");
      expect(error.details).toEqual({ foo: "bar" });
    });

    it("should create error without details", () => {
      const error = new PostHogError({
        code: "SIMPLE_ERROR",
        message: "No details",
      });

      expect(error.code).toBe("SIMPLE_ERROR");
      expect(error.details).toBeUndefined();
    });

    it("should be decodable from unknown", () => {
      const input = {
        _tag: "PostHogError",
        code: "DECODED_ERROR",
        message: "Decoded message",
      };

      const decoded = S.decodeUnknownSync(PostHogError)(input);
      expect(decoded.code).toBe("DECODED_ERROR");
    });
  });

  describe("UnknownPostHogError", () => {
    it("should create error with errorTag and errorData", () => {
      const error = new UnknownPostHogError({
        errorTag: "UNKNOWN_TAG",
        errorData: { unexpected: "data" },
        message: "Unknown error occurred",
      });

      expect(error._tag).toBe("UnknownPostHogError");
      expect(error.errorTag).toBe("UNKNOWN_TAG");
      expect(error.errorData).toEqual({ unexpected: "data" });
    });

    it("should create error without optional fields", () => {
      const error = new UnknownPostHogError({
        errorTag: "MINIMAL",
      });

      expect(error.errorTag).toBe("MINIMAL");
      expect(error.errorData).toBeUndefined();
    });
  });

  describe("AuthenticationError", () => {
    it("should create authentication error", () => {
      const error = new AuthenticationError({
        message: "Invalid API key",
        detail: "The provided API key is not valid",
      });

      expect(error._tag).toBe("AuthenticationError");
      expect(error.message).toBe("Invalid API key");
      expect(error.detail).toBe("The provided API key is not valid");
    });

    it("should create error without optional fields", () => {
      const error = new AuthenticationError({});

      expect(error._tag).toBe("AuthenticationError");
    });
  });

  describe("AuthorizationError", () => {
    it("should create authorization error", () => {
      const error = new AuthorizationError({
        message: "Insufficient permissions",
        detail: "You do not have access to this resource",
      });

      expect(error._tag).toBe("AuthorizationError");
      expect(error.message).toBe("Insufficient permissions");
    });
  });

  describe("NotFoundError", () => {
    it("should create not found error", () => {
      const error = new NotFoundError({
        message: "Resource not found",
        detail: "The requested item does not exist",
      });

      expect(error._tag).toBe("NotFoundError");
      expect(error.message).toBe("Resource not found");
    });
  });

  describe("ValidationError", () => {
    it("should create validation error with field errors", () => {
      const error = new ValidationError({
        message: "Validation failed",
        detail: { field: "name", issue: "required" },
        errors: {
          name: ["This field is required"],
          email: ["Invalid email format"],
        },
      });

      expect(error._tag).toBe("ValidationError");
      expect(error.message).toBe("Validation failed");
      expect(error.errors).toEqual({
        name: ["This field is required"],
        email: ["Invalid email format"],
      });
    });
  });

  describe("RateLimitError", () => {
    it("should create rate limit error with retryAfter", () => {
      const error = new RateLimitError({
        message: "Too many requests",
        detail: "Rate limit exceeded",
        retryAfter: 60,
      });

      expect(error._tag).toBe("RateLimitError");
      expect(error.message).toBe("Too many requests");
      expect(error.retryAfter).toBe(60);
    });

    it("should create error without retryAfter", () => {
      const error = new RateLimitError({
        message: "Rate limited",
      });

      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe("ServerError", () => {
    it("should create server error", () => {
      const error = new ServerError({
        message: "Internal server error",
        detail: "An unexpected error occurred",
      });

      expect(error._tag).toBe("ServerError");
      expect(error.message).toBe("Internal server error");
    });
  });

  describe("COMMON_ERRORS", () => {
    it("should contain all common error types", () => {
      expect(COMMON_ERRORS).toHaveLength(6);

      const errorClasses = [
        AuthenticationError,
        AuthorizationError,
        NotFoundError,
        ValidationError,
        RateLimitError,
        ServerError,
      ];

      for (const errorClass of errorClasses) {
        expect(COMMON_ERRORS).toContain(errorClass);
      }
    });

    it("should be usable for error matching", () => {
      const errors = COMMON_ERRORS.map((ErrorClass) => {
        const instance = new ErrorClass({ message: "test" });
        return instance._tag;
      });

      expect(errors).toContain("AuthenticationError");
      expect(errors).toContain("AuthorizationError");
      expect(errors).toContain("NotFoundError");
      expect(errors).toContain("ValidationError");
      expect(errors).toContain("RateLimitError");
      expect(errors).toContain("ServerError");
    });
  });

  describe("Error inheritance", () => {
    it("all errors should be instances of Error", () => {
      const postHogError = new PostHogError({ code: "X", message: "test" });
      const authError = new AuthenticationError({});
      const rateLimitError = new RateLimitError({});

      expect(postHogError instanceof Error).toBe(true);
      expect(authError instanceof Error).toBe(true);
      expect(rateLimitError instanceof Error).toBe(true);
    });

    it("errors should have stack traces", () => {
      const error = new PostHogError({
        code: "STACK_TEST",
        message: "Testing stack",
      });

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });
  });
});
