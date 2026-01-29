import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../../src/client/operation.js";
import type { Response } from "../../src/client/response.js";

import { makeResponseParser } from "../../src/client/response-parser.js";
import { AttioError, type AttioErrorType } from "../../src/errors.js";

/**
 * Typed assertion helper that narrows AttioErrorType to AttioError
 */
const assertAttioError = (error: AttioErrorType): AttioError => {
  expect(error._tag).toBe("AttioError");
  if (error._tag !== "AttioError") throw new Error("Expected AttioError");
  return error;
};

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
    const DataEnvelope = S.Struct({
      data: S.Array(S.Struct({ id: S.Number, name: S.String })),
    });

    const operation: Operation = {
      input: S.Struct({}),
      output: DataEnvelope,
      errors: [],
    };

    it.effect("should parse a valid JSON response with data envelope", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(200, {
          data: [{ id: 1, name: "Alice" }],
        });

        const result = yield* parser(response);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe("Alice");
      })
    );

    it.effect("should parse a single item response", () =>
      Effect.gen(function* () {
        const SingleItem = S.Struct({
          data: S.Struct({ id: S.Number, name: S.String }),
        });

        const singleOp: Operation = {
          input: S.Struct({}),
          output: SingleItem,
          errors: [],
        };

        const parser = makeResponseParser(singleOp);
        const response = createMockResponse(200, {
          data: { id: 42, name: "Bob" },
        });

        const result = yield* parser(response);
        expect(result.data.id).toBe(42);
        expect(result.data.name).toBe("Bob");
      })
    );

    it.effect("should handle empty body as empty object (204)", () =>
      Effect.gen(function* () {
        const EmptyResponse = S.Struct({});
        const emptyOp: Operation = {
          input: S.Struct({}),
          output: EmptyResponse,
          errors: [],
        };

        const parser = makeResponseParser(emptyOp);
        const response = createEmptyResponse(204);

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

    it.effect("should return AttioError for 400 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(400, {
          message: "Invalid request",
          type: "validation_error",
        });

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("400");
        expect(error.message).toBe("Invalid request");
      })
    );

    it.effect("should return AttioError for 401 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(401, {
          message: "Unauthorized",
          type: "unauthorized_error",
        });

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("401");
      })
    );

    it.effect("should return AttioError for 404 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(404, {
          message: "Not found",
          type: "not_found_error",
        });

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("404");
        expect(error.message).toBe("Not found");
      })
    );

    it.effect("should return AttioError for 409 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(409, {
          message: "Conflict",
          type: "conflict_error",
        });

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("409");
      })
    );

    it.effect("should return AttioError for 429 with retryAfter", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(
          429,
          { message: "Rate limit exceeded", type: "rate_limit_error" },
          { "retry-after": "5" }
        );

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("429");
        expect(error.message).toBe("Rate limit exceeded");
      })
    );

    it.effect("should return AttioError for 500 status", () =>
      Effect.gen(function* () {
        const parser = makeResponseParser(operation);
        const response = createMockResponse(500, {
          message: "Internal server error",
          type: "server_error",
        });

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("500");
      })
    );
  });

  describe("malformed JSON", () => {
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

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error._tag).toBe("AttioError");
      })
    );
  });

  describe("schema mismatch", () => {
    const StrictResponse = S.Struct({
      data: S.Array(S.Struct({ id: S.Number })),
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
          data: [{ id: "not-a-number" }],
        });

        const error = assertAttioError(yield* Effect.flip(parser(response)));
        expect(error.code).toBe("PARSE_ERROR");
      })
    );
  });
});
