/**
 * Response Parser for PostHog API
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

import { PostHogError, type PostHogErrorType } from "../errors.js";

/**
 * Parse the response body as JSON using Effect primitives.
 *
 * Uses Stream.fromReadableStream for the ReadableStream consumption
 * and Effect.try for JSON parsing.
 */
const parseJsonBody = (
  response: Response
): Effect.Effect<unknown, PostHogError> =>
  Effect.gen(function* () {
    // Collect all chunks from the stream using Stream.fromReadableStream
    const chunks = yield* Stream.fromReadableStream(
      () => response.body,
      (error) =>
        new PostHogError({
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

    // Use reduce to avoid mutable let offset
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
      try: () => JSON.parse(text) as unknown,
      catch: () =>
        new PostHogError({
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
  const errorSchemas = _options?.errorSchemas ?? operation.errors ?? [];

  // Return a function that parses responses
  return (
    response: Response
  ): Effect.Effect<S.Schema.Type<typeof outputSchema>, PostHogErrorType> => {
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

        // Try to match against known error schemas
        for (const errorSchema of errorSchemas) {
          const decoded = yield* S.decodeUnknown(errorSchema)(errorBody).pipe(
            Effect.option
          );

          if (decoded._tag === "Some") {
            // Return the typed error
            return yield* Effect.fail(
              new PostHogError({
                code: String(response.status),
                message: getErrorMessage(decoded.value),
                details: decoded.value,
              })
            );
          }
        }

        // Default error for unrecognized error responses
        return yield* Effect.fail(
          new PostHogError({
            code: String(response.status),
            message: getErrorMessage(errorBody) || response.statusText,
            details: errorBody,
          })
        );
      }

      // Success response - parse the body
      const body = yield* parseJsonBody(response).pipe(
        Effect.mapError(
          () =>
            new PostHogError({
              code: "PARSE_ERROR",
              message: "Failed to parse response body",
            })
        )
      );

      // Decode the response using the output schema
      const decoded = yield* S.decodeUnknown(outputSchema)(body).pipe(
        Effect.mapError(
          (parseError) =>
            new PostHogError({
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
 * Extract error message from various error body formats
 */
function getErrorMessage(errorBody: unknown): string {
  if (errorBody === null || errorBody === undefined) {
    return "Unknown error";
  }

  if (typeof errorBody === "string") {
    return errorBody;
  }

  if (typeof errorBody === "object") {
    const obj = errorBody as Record<string, unknown>;

    // Try common error message field names
    if (typeof obj["message"] === "string") return obj["message"];
    if (typeof obj["error"] === "string") return obj["error"];
    if (typeof obj["detail"] === "string") return obj["detail"];
    if (typeof obj["details"] === "string") return obj["details"];
    if (typeof obj["error_description"] === "string")
      return obj["error_description"];

    // Try nested error object
    if (typeof obj["error"] === "object" && obj["error"] !== null) {
      const nested = obj["error"] as Record<string, unknown>;
      if (typeof nested["message"] === "string") return nested["message"];
    }
  }

  return "Unknown error";
}
