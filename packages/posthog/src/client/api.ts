/**
 * PostHog API Client
 *
 * Main client for making typed API calls to PostHog.
 * Uses Bearer token authentication with the PostHog API key.
 */

import type * as S from "effect/Schema";

import { HttpClient, HttpClientRequest } from "@effect/platform";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";

import type { Operation } from "./operation.js";
import type { Request as ApiRequest } from "./request.js";
import type { Response } from "./response.js";

import { Credentials } from "../credentials.js";
import { Endpoint } from "../endpoint.js";
import { PostHogError, type PostHogErrorType } from "../errors.js";
import { makeRequestBuilder } from "./request-builder.js";
import { makeResponseParser } from "./response-parser.js";

/**
 * Cached init result for an operation — contains the request builder and response parser.
 * Built once per operation via the ??= lazy init pattern (matching distilled-aws).
 */
interface OperationInit {
  readonly buildRequest: (
    input: Record<string, unknown>
  ) => Effect.Effect<ApiRequest>;
  readonly parseResponse: (
    response: Response
  ) => Effect.Effect<S.Schema.Type<Operation["output"]>, PostHogErrorType>;
}

/**
 * Execute an API operation with a cached init.
 */
const executeWithInit = <Op extends Operation>(
  init: OperationInit,
  input: S.Schema.Type<Op["input"]>
): Effect.Effect<
  S.Schema.Type<Op["output"]>,
  PostHogErrorType,
  HttpClient.HttpClient | Credentials | Endpoint
> => {
  return Effect.gen(function* () {
    // Get dependencies
    const httpClient = yield* HttpClient.HttpClient;
    const credentials = yield* Credentials;
    const endpoint = yield* Endpoint;

    // Build the request (uses cached request builder)
    const request = yield* init.buildRequest(input);

    // Build the full URL
    const baseUrl = endpoint.replace(/\/$/, "");
    const queryString = buildQueryString(request.query);
    const fullUrl = `${baseUrl}${request.path}${queryString ? `?${queryString}` : ""}`;

    // Create the HTTP request with authentication
    const apiKey = Redacted.value(credentials.apiKey);
    const baseRequest = HttpClientRequest.make(request.method)(fullUrl).pipe(
      HttpClientRequest.setHeaders({
        ...request.headers,
        Authorization: `Bearer ${apiKey}`,
      })
    );

    const httpRequest =
      request.body !== undefined && typeof request.body === "string"
        ? baseRequest.pipe(
            // bodyText() defaults to text/plain, must specify application/json
            HttpClientRequest.bodyText(request.body, "application/json")
          )
        : baseRequest;

    // Execute the request
    const platformResponse = yield* httpClient.execute(httpRequest).pipe(
      Effect.mapError(
        (error) =>
          new PostHogError({
            code: "HTTP_ERROR",
            message: `HTTP request failed: ${String(error)}`,
            details: { error: String(error) },
          })
      )
    );

    // Spread to convert Headers brand type to plain Record<string, string>
    const responseHeaders: Record<string, string> = {
      ...platformResponse.headers,
    };

    // Check if response has body (HEAD requests, 204 responses, etc. may not)
    const contentLength = responseHeaders["content-length"];
    const isEmptyBody =
      contentLength === "0" || platformResponse.status === 204;

    const responseBody: ReadableStream<Uint8Array> = isEmptyBody
      ? new ReadableStream<Uint8Array>({ start: (c) => c.close() })
      : yield* Stream.toReadableStreamEffect(platformResponse.stream).pipe(
          Effect.mapError(
            (error) =>
              new PostHogError({
                code: "STREAM_ERROR",
                message: `Failed to convert response stream: ${String(error)}`,
              })
          )
        );

    // Build our Response type
    const response: Response = {
      status: platformResponse.status,
      statusText: "OK",
      headers: responseHeaders,
      body: responseBody,
    };

    // Parse the response (uses cached response parser)
    const result = yield* init.parseResponse(response);

    return result;
  });
};

/**
 * Execute an API operation (builds init on each call — use makeClient for cached version)
 */
export const execute = <Op extends Operation>(
  operation: Op,
  input: S.Schema.Type<Op["input"]>
): Effect.Effect<
  S.Schema.Type<Op["output"]>,
  PostHogErrorType,
  HttpClient.HttpClient | Credentials | Endpoint
> => {
  return Effect.gen(function* () {
    const buildRequest = yield* makeRequestBuilder(operation);
    const parseResponse = makeResponseParser(operation);
    return yield* executeWithInit({ buildRequest, parseResponse }, input);
  });
};

/**
 * Build a query string from query parameters
 */
function buildQueryString(
  query: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        params.append(key, v);
      }
    } else {
      params.append(key, value);
    }
  }

  return params.toString();
}

/**
 * Create a typed API client for a specific operation.
 *
 * Caches makeRequestBuilder and makeResponseParser per operation using
 * the ??= lazy init pattern (matching distilled-aws). The expensive
 * schema AST analysis runs once on first call, not on every request.
 */
export const makeClient = <Op extends Operation>(operation: Op) => {
  let _init: OperationInit | undefined;
  const init = (): OperationInit =>
    (_init ??= {
      buildRequest: Effect.runSync(makeRequestBuilder(operation)),
      parseResponse: makeResponseParser(operation),
    });

  return (
    input: S.Schema.Type<Op["input"]>
  ): Effect.Effect<
    S.Schema.Type<Op["output"]>,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > => executeWithInit(init(), input);
};

/**
 * A paginated response shape common to all PostHog list endpoints.
 */
interface PaginatedOutput<Item> {
  readonly next?: string | null | undefined;
  readonly results: ReadonlyArray<Item>;
}

/**
 * A paginated input shape common to all PostHog list endpoints.
 */
interface PaginatedInput {
  readonly offset?: number | undefined;
  readonly limit?: number | undefined;
}

/**
 * Extract the offset from a PostHog "next" URL (e.g. "…?limit=10&offset=20").
 */
const parseNextOffset = (nextUrl: string): Option.Option<number> => {
  try {
    const url = new URL(nextUrl);
    const offsetStr = url.searchParams.get("offset");
    if (offsetStr === null) return Option.none();
    const offset = Number(offsetStr);
    return Number.isNaN(offset) ? Option.none() : Option.some(offset);
  } catch {
    return Option.none();
  }
};

/**
 * Create a paginated API client for a list operation.
 *
 * Returns a callable with two additional methods:
 * - `.pages(input)` — a Stream of paginated result pages
 * - `.items(input)` — a Stream of individual result items across all pages
 */
export const makePaginated = <Op extends Operation>(operation: Op) => {
  type Input = S.Schema.Type<Op["input"]> & PaginatedInput;
  type Output = S.Schema.Type<Op["output"]> & PaginatedOutput<unknown>;

  // Share the cached init with the single-page client
  let _init: OperationInit | undefined;
  const init = (): OperationInit =>
    (_init ??= {
      buildRequest: Effect.runSync(makeRequestBuilder(operation)),
      parseResponse: makeResponseParser(operation),
    });

  const fn = (
    input: Input
  ): Effect.Effect<
    Output,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > => executeWithInit(init(), input) as Effect.Effect<Output, PostHogErrorType, HttpClient.HttpClient | Credentials | Endpoint>;

  const pages = (
    input: Input
  ): Stream.Stream<
    Output,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > =>
    Stream.unfoldEffect(input as Input | undefined, (cursor) => {
      if (cursor === undefined) {
        return Effect.succeed(Option.none<readonly [Output, Input | undefined]>());
      }
      return fn(cursor).pipe(
        Effect.map((page) => {
          const nextOffset = Option.flatMap(
            Option.fromNullable(page.next),
            parseNextOffset
          );
          const nextCursor = Option.match(nextOffset, {
            onNone: (): Input | undefined => undefined,
            onSome: (offset): Input | undefined => ({
              ...cursor,
              offset,
            }),
          });
          return Option.some([page, nextCursor] as const);
        })
      );
    });

  const items = (
    input: Input
  ): Stream.Stream<
    unknown,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > =>
    pages(input).pipe(
      Stream.mapConcat((page) => page.results)
    );

  return Object.assign(fn, { pages, items });
};

/**
 * Create a live layer with default credentials and endpoint
 */
export const PostHogClientLive = Layer.mergeAll(
  Credentials.fromEnv(),
  Layer.succeed(Endpoint, Endpoint.DEFAULT)
);
