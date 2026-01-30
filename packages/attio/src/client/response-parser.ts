/**
 * Response Parser for Attio API
 *
 * Parses HTTP responses and decodes them using Effect Schema.
 * Simplified from distilled-aws for REST-JSON only.
 */

import * as Arr from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

import type { Operation } from "./operation.js";
import type { Response } from "./response.js";

import {
  AttioError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
  type AttioErrorType,
} from "../errors.js";

/**
 * Parse the response body as JSON using Effect primitives.
 *
 * Uses Stream.fromReadableStream for the ReadableStream consumption
 * and Effect.try for JSON parsing.
 */
const parseJsonBody = (
  response: Response
): Effect.Effect<unknown, AttioError> =>
  Effect.gen(function* () {
    // Collect all chunks from the stream using Stream.fromReadableStream
    const chunks = yield* Stream.fromReadableStream(
      () => response.body,
      (error) =>
        new AttioError({
          code: "STREAM_ERROR",
          message: `Failed to read response stream: ${String(error)}`,
        })
    ).pipe(Stream.runCollect);

    // Combine chunks into a single Uint8Array
    const chunkArray = Chunk.toReadonlyArray(chunks);
    const totalLength = Arr.reduce(
      chunkArray,
      0,
      (sum, chunk) => sum + chunk.length
    );
    const combined = new Uint8Array(totalLength);

    Arr.reduce(chunkArray, 0, (offset, chunk) => {
      combined.set(chunk, offset);
      return offset + chunk.length;
    });

    // Decode as UTF-8
    const text = new TextDecoder().decode(combined);

    // Handle empty body
    if (text.trim() === "") {
      return {};
    }

    // Parse JSON - if parsing fails, return the raw text wrapped in an object
    return yield* Effect.try({
      try: (): unknown => JSON.parse(text),
      catch: () =>
        new AttioError({
          code: "JSON_PARSE_ERROR",
          message: "Failed to parse JSON",
        }),
    }).pipe(Effect.orElseSucceed(() => ({ rawText: text })));
  });

export interface ResponseParserOptions {
  /** Error schemas to try matching against */
  errorSchemas?: readonly S.Schema.AnyNoContext[];
}

/**
 * Create a response parser for a given operation.
 *
 * @param operation - The operation (with input/output schemas)
 * @param options - Optional overrides
 * @returns A function that parses responses into typed outputs
 */
export const makeResponseParser = (
  operation: Operation,
  _options?: ResponseParserOptions
) => {
  const outputSchema = operation.output;
  // Error schemas are available for future use but status-code matching is used instead.
  void (_options?.errorSchemas ?? operation.errors ?? []);

  // Return a function that parses responses
  return (
    response: Response
  ): Effect.Effect<S.Schema.Type<typeof outputSchema>, AttioErrorType> => {
    return Effect.gen(function* () {
      // Check for HTTP error status codes
      if (response.status >= 400) {
        // Try to parse error body
        const errorBody = yield* parseJsonBody(response).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              message: "Failed to parse error response body",
            })
          )
        );

        // Match errors by HTTP status code and return typed errors.
        // The error schemas use TaggedError which requires _tag in input,
        // but the Attio API doesn't return _tag. Instead, map by status code.
        const msg = getErrorMessage(errorBody) || response.statusText;
        const errInfo = isRecord(errorBody) ? {
          message: msg,
          type: typeof errorBody["type"] === "string" ? errorBody["type"] : undefined,
          code: typeof errorBody["code"] === "string" ? errorBody["code"] : undefined,
        } : { message: msg };

        switch (response.status) {
          case 401:
            return yield* Effect.fail(new AuthenticationError(errInfo));
          case 403:
            return yield* Effect.fail(new AuthorizationError(errInfo));
          case 404:
            return yield* Effect.fail(new NotFoundError(errInfo));
          case 400:
            return yield* Effect.fail(new ValidationError(errInfo));
          case 409:
            return yield* Effect.fail(new ConflictError(errInfo));
          case 429: {
            const retryAfter = isRecord(errorBody) && typeof errorBody["retry_after"] === "number"
              ? errorBody["retry_after"] as number
              : undefined;
            return yield* Effect.fail(new RateLimitError({ ...errInfo, retryAfter }));
          }
          default:
            if (response.status >= 500) {
              return yield* Effect.fail(new ServerError(errInfo));
            }
            return yield* Effect.fail(
              new AttioError({
                code: String(response.status),
                message: msg,
                details: errorBody,
              })
            );
        }
      }

      // Success response - parse the body
      const body = yield* parseJsonBody(response).pipe(
        Effect.mapError(
          () =>
            new AttioError({
              code: "PARSE_ERROR",
              message: "Failed to parse response body",
            })
        )
      );

      // Decode the response using the output schema
      const decoded = yield* S.decodeUnknown(outputSchema)(body).pipe(
        Effect.mapError(
          (parseError) =>
            new AttioError({
              code: "PARSE_ERROR",
              message: `Failed to parse response: ${parseError.message}`,
              details: { body, parseError: String(parseError) },
            })
        )
      );

      return decoded;
    });
  };
};

/**
 * Type guard for record-like objects
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract error message from various error body formats
 */
function getErrorMessage(errorBody: unknown): string {
  if (errorBody === null || errorBody === undefined) {
    return "Unknown error";
  }

  if (typeof errorBody === "string") {
    return errorBody;
  }

  if (isRecord(errorBody)) {
    // Try common error message field names
    if (typeof errorBody["message"] === "string") return errorBody["message"];
    if (typeof errorBody["error"] === "string") return errorBody["error"];
    if (typeof errorBody["detail"] === "string") return errorBody["detail"];
    if (typeof errorBody["details"] === "string") return errorBody["details"];
    if (typeof errorBody["error_description"] === "string")
      return errorBody["error_description"];

    // Try nested error object
    if (isRecord(errorBody["error"])) {
      const nested = errorBody["error"];
      if (typeof nested["message"] === "string") return nested["message"];
    }
  }

  return "Unknown error";
}
