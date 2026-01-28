/**
 * PostHog API Client
 *
 * Main client for making typed API calls to PostHog.
 * Uses Bearer token authentication with the PostHog API key.
 */

import type * as S from "effect/Schema";

import { HttpClient, HttpClientRequest } from "@effect/platform";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import type { Operation, PaginatedOperation } from "./operation.js";
import type { Request as ApiRequest } from "./request.js";
import type { Response } from "./response.js";

import { Credentials } from "../credentials.js";
import { Endpoint } from "../endpoint.js";
import { PostHogError, type PostHogErrorType } from "../errors.js";
import { type Options as RetryOptions, makeDefault, Retry } from "../retry.js";
import { getPath } from "../traits.js";
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
    yield* Effect.logDebug("Payload").pipe(
      Effect.annotateLogs("input", JSON.stringify(input))
    );
    const request = yield* init.buildRequest(input);

    yield* Effect.logDebug("Built Request").pipe(
      Effect.annotateLogs("method", request.method),
      Effect.annotateLogs("path", request.path)
    );

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

    yield* Effect.logDebug("Raw Response").pipe(
      Effect.annotateLogs("status", String(platformResponse.status))
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

    yield* Effect.logDebug("Parsed Response").pipe(
      Effect.annotateLogs("result", JSON.stringify(result))
    );

    return result;
  });
};

/**
 * Resolve the retry policy from context, falling back to the default factory.
 * Creates a Ref to track the last error for retry-after header support.
 */
const resolveRetryPolicy = Effect.gen(function* () {
  const lastError = yield* Ref.make<unknown>(undefined);
  const policy = (yield* Effect.serviceOption(Retry)).pipe(
    Option.map((value) =>
      typeof value === "function" ? value(lastError) : value,
    ),
    Option.getOrElse(() => makeDefault(lastError)),
  );
  return { lastError, policy };
});

/**
 * Wrap an effect with retry logic using the resolved policy.
 */
const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  lastError: Ref.Ref<unknown>,
  policy: RetryOptions,
): Effect.Effect<A, E, R> =>
  pipe(
    effect,
    Effect.tapError((error) => Ref.set(lastError, error)),
    policy.while
      ? (eff) =>
          Effect.retry(eff, {
            while: policy.while,
            schedule: policy.schedule,
          })
      : (eff) => eff,
  );

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
 *
 * Wraps execution with retry logic: creates a Ref to track the last error,
 * resolves the Retry policy from context (or uses makeDefault), and applies
 * Effect.retry with tapError for retry-after header support.
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
  > =>
    Effect.gen(function* () {
      const { lastError, policy } = yield* resolveRetryPolicy;
      return yield* withRetry(
        executeWithInit(init(), input),
        lastError,
        policy,
      );
    });
};

/**
 * Extract a query parameter value from a PostHog "next" URL.
 * Works for both offset-based ("…?offset=20") and cursor-based ("…?cursor=abc") pagination.
 */
const parseNextToken = (
  nextUrl: string,
  paramName: string
): Option.Option<string> => {
  try {
    const url = new URL(nextUrl);
    return Option.fromNullable(url.searchParams.get(paramName));
  } catch {
    return Option.none();
  }
};

/**
 * Pagination state for Stream.unfoldEffect — uses a proper type instead of
 * casting input to Input | undefined (matching distilled-aws pattern).
 */
interface PaginationState<Input> {
  readonly payload: Input;
  readonly token: string | undefined;
  readonly done: boolean;
}

/**
 * Create a paginated API client for a list operation.
 *
 * Uses `operation.pagination` metadata to generically handle both offset-based
 * and cursor-based pagination. Returns a callable with two additional methods:
 * - `.pages(input)` — a Stream of paginated result pages
 * - `.items(input)` — a Stream of individual result items across all pages
 *
 * Each individual page fetch is wrapped with retry logic matching makeClient.
 */
export const makePaginated = <Op extends PaginatedOperation>(operation: Op) => {
  type Input = S.Schema.Type<Op["input"]>;
  type Output = S.Schema.Type<Op["output"]>;

  const pagination = operation.pagination;

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
  > =>
    Effect.gen(function* () {
      const { lastError, policy } = yield* resolveRetryPolicy;
      return yield* withRetry(
        executeWithInit<Op>(init(), input),
        lastError,
        policy,
      );
    });

  const pages = (
    input: Input
  ): Stream.Stream<
    Output,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > => {
    const initialState: PaginationState<Input> = {
      payload: input,
      token: undefined,
      done: false,
    };

    return Stream.unfoldEffect(initialState, (state) => {
      if (state.done) {
        return Effect.succeed(Option.none<readonly [Output, PaginationState<Input>]>());
      }

      // Build request payload with token if present
      const requestPayload: Input =
        state.token !== undefined
          ? { ...state.payload, [pagination.inputToken]: state.token }
          : state.payload;

      return fn(requestPayload).pipe(
        Effect.map((page) => {
          // Use getPath for safe dynamic property access (encapsulates cast internally)
          const nextUrl = getPath(page, pagination.outputToken);
          const nextTokenValue =
            typeof nextUrl === "string"
              ? parseNextToken(nextUrl, pagination.inputToken)
              : Option.none<string>();

          const nextState: PaginationState<Input> = Option.match(nextTokenValue, {
            onNone: () => ({
              payload: state.payload,
              token: undefined,
              done: true,
            }),
            onSome: (token) => ({
              payload: state.payload,
              token,
              done: false,
            }),
          });

          return Option.some([page, nextState] as const);
        })
      );
    });
  };

  const items = (
    input: Input
  ): Stream.Stream<
    unknown,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > => {
    const itemsKey = pagination.items ?? "results";
    return pages(input).pipe(
      Stream.mapConcat((page) => {
        // Use getPath for safe dynamic property access (encapsulates cast internally)
        const itemsArray = getPath(page, itemsKey);
        return Array.isArray(itemsArray) ? itemsArray : [];
      })
    );
  };

  return Object.assign(fn, { pages, items });
};

/**
 * Create a live layer with default credentials and endpoint
 */
export const PostHogClientLive = Layer.mergeAll(
  Credentials.fromEnv(),
  Layer.succeed(Endpoint, Endpoint.DEFAULT)
);
