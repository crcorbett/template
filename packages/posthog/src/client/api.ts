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
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";

import type { Operation } from "./operation.js";
import type { Response } from "./response.js";

import { Credentials } from "../credentials.js";
import { Endpoint } from "../endpoint.js";
import { PostHogError, type PostHogErrorType } from "../errors.js";
import { makeRequestBuilder } from "./request-builder.js";
import { makeResponseParser } from "./response-parser.js";

/**
 * Execute an API operation
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
    // Get dependencies
    const httpClient = yield* HttpClient.HttpClient;
    const credentials = yield* Credentials;
    const endpoint = yield* Endpoint;

    // Build the request
    const requestBuilder = yield* makeRequestBuilder(operation);
    const request = yield* requestBuilder(input);

    // Build the full URL
    const baseUrl = endpoint.replace(/\/$/, "");
    const queryString = buildQueryString(request.query);
    const fullUrl = `${baseUrl}${request.path}${queryString ? `?${queryString}` : ""}`;

    // Create the HTTP request with authentication
    const apiKey = Redacted.value(credentials.apiKey);
    let httpRequest = HttpClientRequest.make(request.method)(fullUrl).pipe(
      HttpClientRequest.setHeaders({
        ...request.headers,
        Authorization: `Bearer ${apiKey}`,
      })
    );

    if (request.body !== undefined && typeof request.body === "string") {
      // bodyText() defaults to text/plain, must specify application/json
      httpRequest = httpRequest.pipe(
        HttpClientRequest.bodyText(request.body, "application/json")
      );
    }

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

    // Parse the response
    const responseParser = makeResponseParser(operation);
    const result = yield* responseParser(response);

    return result;
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
 * Create a typed API client for a specific operation
 */
export const makeClient = <Op extends Operation>(operation: Op) => {
  return (
    input: S.Schema.Type<Op["input"]>
  ): Effect.Effect<
    S.Schema.Type<Op["output"]>,
    PostHogErrorType,
    HttpClient.HttpClient | Credentials | Endpoint
  > => execute(operation, input);
};

/**
 * Create a live layer with default credentials and endpoint
 */
export const PostHogClientLive = Layer.mergeAll(
  Credentials.fromEnv(),
  Layer.succeed(Endpoint, Endpoint.DEFAULT)
);
