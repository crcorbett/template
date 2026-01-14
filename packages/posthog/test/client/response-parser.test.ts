import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../../src/client/operation.js";
import type { Response } from "../../src/client/response.js";

import { makeResponseParser } from "../../src/client/response-parser.js";
import { PostHogError } from "../../src/errors.js";

const createMockResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response => {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(bodyStr);

  return {
    status,
    statusText: status >= 400 ? "Error" : "OK",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bodyBytes);
        controller.close();
      },
    }),
  };
};

const createEmptyResponse = (status: number): Response => ({
  status,
  statusText: "OK",
  headers: {},
  body: new ReadableStream({
    start(controller) {
      controller.close();
    },
  }),
});

describe("makeResponseParser", () => {
  describe("success responses", () => {
    const UserResponse = S.Struct({
      id: S.Number,
      name: S.String,
      email: S.optional(S.String),
    });

    const operation: Operation = {
      input: S.Struct({}),
      output: UserResponse,
      errors: [],
    };

    it.effect("should parse a valid JSON response", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(200, {
          id: 123,
          name: "John Doe",
          email: "john@example.com",
        });

        const result = yield* parser(response);

        expect(result.id).toBe(123);
        expect(result.name).toBe("John Doe");
        expect(result.email).toBe("john@example.com");
      })
    );

    it.effect("should handle optional fields", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(200, {
          id: 456,
          name: "Jane Doe",
        });

        const result = yield* parser(response);

        expect(result.id).toBe(456);
        expect(result.name).toBe("Jane Doe");
        expect(result.email).toBeUndefined();
      })
    );

    it.effect("should handle empty body as empty object", () =>
      Effect.gen(function* () {
        const EmptyResponse = S.Struct({});
        const emptyOperation: Operation = {
          input: S.Struct({}),
          output: EmptyResponse,
          errors: [],
        };

        const parser = makeResponseParser(emptyOperation);
        const response = createEmptyResponse(200);

        const result = yield* parser(response);
        expect(result).toEqual({});
      })
    );
  });

  describe("error responses", () => {
    const SimpleResponse = S.Struct({ id: S.Number });

    const operation: Operation = {
      input: S.Struct({}),
      output: SimpleResponse,
      errors: [],
    };

    it.effect("should return PostHogError for 400 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          message: "Invalid request",
          detail: "Missing required field",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("400");
        expect((error as PostHogError).message).toBe("Invalid request");
      })
    );

    it.effect("should return PostHogError for 401 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(401, {
          detail: "Authentication credentials were not provided.",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("401");
        expect((error as PostHogError).message).toBe(
          "Authentication credentials were not provided."
        );
      })
    );

    it.effect("should return PostHogError for 403 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(403, {
          message: "Permission denied",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("403");
      })
    );

    it.effect("should return PostHogError for 404 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(404, {
          detail: "Not found.",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("404");
        expect((error as PostHogError).message).toBe("Not found.");
      })
    );

    it.effect("should return PostHogError for 429 rate limit", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(429, {
          error: "Rate limit exceeded",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("429");
        expect((error as PostHogError).message).toBe("Rate limit exceeded");
      })
    );

    it.effect("should return PostHogError for 500 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(500, {
          error: "Internal server error",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("500");
      })
    );
  });

  describe("error message extraction", () => {
    const SimpleResponse = S.Struct({ id: S.Number });

    const operation: Operation = {
      input: S.Struct({}),
      output: SimpleResponse,
      errors: [],
    };

    it.effect("should extract message from 'message' field", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          message: "Error from message field",
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe(
          "Error from message field"
        );
      })
    );

    it.effect("should extract message from 'error' field", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          error: "Error from error field",
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Error from error field");
      })
    );

    it.effect("should extract message from 'detail' field", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          detail: "Error from detail field",
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Error from detail field");
      })
    );

    it.effect("should extract message from nested error.message", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          error: { message: "Nested error message" },
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Nested error message");
      })
    );

    it.effect("should fallback to 'Unknown error' for empty body", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {});

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Unknown error");
      })
    );
  });

  describe("schema validation errors", () => {
    const StrictResponse = S.Struct({
      id: S.Number,
      required_field: S.String,
    });

    const operation: Operation = {
      input: S.Struct({}),
      output: StrictResponse,
      errors: [],
    };

    it.effect("should return parse error for invalid response shape", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(200, {
          id: "not-a-number",
          required_field: "value",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("PARSE_ERROR");
      })
    );

    it.effect("should return parse error for missing required field", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(200, {
          id: 123,
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).code).toBe("PARSE_ERROR");
      })
    );
  });

  describe("complex response schemas", () => {
    const NestedResponse = S.Struct({
      data: S.Struct({
        users: S.Array(
          S.Struct({
            id: S.Number,
            name: S.String,
          })
        ),
        pagination: S.Struct({
          total: S.Number,
          page: S.Number,
        }),
      }),
    });

    const operation: Operation = {
      input: S.Struct({}),
      output: NestedResponse,
      errors: [],
    };

    it.effect("should parse nested response structures", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(200, {
          data: {
            users: [
              { id: 1, name: "Alice" },
              { id: 2, name: "Bob" },
            ],
            pagination: {
              total: 100,
              page: 1,
            },
          },
        });

        const result = yield* parser(response);

        expect(result.data.users).toHaveLength(2);
        expect(result.data.users[0].name).toBe("Alice");
        expect(result.data.pagination.total).toBe(100);
      })
    );
  });

  describe("invalid JSON handling", () => {
    const SimpleResponse = S.Struct({ id: S.Number });

    const operation: Operation = {
      input: S.Struct({}),
      output: SimpleResponse,
      errors: [],
    };

    it.effect("should handle malformed JSON in error response", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, "not valid json {{{");

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
      })
    );

    it.effect("should wrap malformed JSON in rawText object", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, "plain text error");

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).details).toHaveProperty("rawText");
      })
    );
  });

  describe("error schema matching", () => {
    const SimpleResponse = S.Struct({ id: S.Number });

    class CustomError extends S.TaggedClass<CustomError>()("CustomError", {
      code: S.String,
      reason: S.String,
    }) {}

    const operation: Operation = {
      input: S.Struct({}),
      output: SimpleResponse,
      errors: [CustomError],
    };

    it.effect("should match against typed error schema", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          _tag: "CustomError",
          code: "VALIDATION",
          reason: "Invalid input",
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).details).toHaveProperty(
          "_tag",
          "CustomError"
        );
      })
    );

    it.effect("should fallback to generic error when no schema matches", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          unknown_format: true,
        });

        const error = yield* Effect.flip(parser(response));

        expect(error).toBeInstanceOf(PostHogError);
        expect((error as PostHogError).message).toBe("Unknown error");
      })
    );
  });

  describe("getErrorMessage edge cases", () => {
    const SimpleResponse = S.Struct({ id: S.Number });

    const operation: Operation = {
      input: S.Struct({}),
      output: SimpleResponse,
      errors: [],
    };

    it.effect("should extract message from 'details' field", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          details: "Error from details field",
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe(
          "Error from details field"
        );
      })
    );

    it.effect("should extract message from 'error_description' field", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          error_description: "OAuth error description",
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("OAuth error description");
      })
    );

    it.effect("should handle null error body", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, null);

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Unknown error");
      })
    );

    it.effect("should handle string error body directly", () =>
      Effect.gen(function* () {
        const RawErrorSchema = S.String;
        const rawOperation: Operation = {
          input: S.Struct({}),
          output: SimpleResponse,
          errors: [RawErrorSchema],
        };

        const parser = makeResponseParser(rawOperation);
        const encoder = new TextEncoder();
        const bodyStr = '"Direct string error"';
        const bodyBytes = encoder.encode(bodyStr);

        const response: Response = {
          status: 400,
          statusText: "Error",
          headers: { "content-type": "application/json" },
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(bodyBytes);
              controller.close();
            },
          }),
        };

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Direct string error");
      })
    );

    it.effect("should handle nested error object without message", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          error: { code: "ERR_001" },
        });

        const error = yield* Effect.flip(parser(response));
        expect((error as PostHogError).message).toBe("Unknown error");
      })
    );
  });
});
