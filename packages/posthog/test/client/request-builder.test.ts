import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../../src/client/operation.js";

import { makeRequestBuilder } from "../../src/client/request-builder.js";
import { MissingHttpTraitError } from "../../src/errors.js";
import * as T from "../../src/traits.js";

/** Assert request.body is a string and return it for JSON.parse */
function assertStringBody(
  body: string | Uint8Array | ReadableStream<Uint8Array> | undefined
): asserts body is string {
  expect(body).toBeDefined();
  expect(typeof body).toBe("string");
}

describe("makeRequestBuilder", () => {
  describe("basic GET request", () => {
    const GetRequest = S.Struct({}).pipe(
      T.all(T.Http({ method: "GET", uri: "/api/test" }), T.RestJsonProtocol())
    );

    const GetResponse = S.Struct({ id: S.Number });

    const operation: Operation = {
      input: GetRequest,
      output: GetResponse,
      errors: [],
    };

    it.effect("should build a simple GET request", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({});

        expect(request.method).toBe("GET");
        expect(request.path).toBe("/api/test");
        expect(request.body).toBeUndefined();
        expect(request.headers["Content-Type"]).toBeUndefined();
      })
    );
  });

  describe("path parameters (HttpLabel)", () => {
    const GetUserRequest = S.Struct({
      userId: S.String.pipe(T.HttpLabel()),
    }).pipe(
      T.all(
        T.Http({ method: "GET", uri: "/api/users/{userId}" }),
        T.RestJsonProtocol()
      )
    );

    const GetUserResponse = S.Struct({ name: S.String });

    const operation: Operation = {
      input: GetUserRequest,
      output: GetUserResponse,
      errors: [],
    };

    it.effect("should substitute path parameters", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({ userId: "123" });

        expect(request.path).toBe("/api/users/123");
      })
    );

    it.effect("should URL encode path parameters", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({ userId: "user with spaces" });

        expect(request.path).toBe("/api/users/user%20with%20spaces");
      })
    );
  });

  describe("query parameters (HttpQuery)", () => {
    const ListRequest = S.Struct({
      limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
      offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
      tags: S.optional(S.Array(S.String)).pipe(T.HttpQuery("tags")),
    }).pipe(
      T.all(T.Http({ method: "GET", uri: "/api/items" }), T.RestJsonProtocol())
    );

    const ListResponse = S.Struct({ items: S.Array(S.Unknown) });

    const operation: Operation = {
      input: ListRequest,
      output: ListResponse,
      errors: [],
    };

    it.effect("should add query parameters", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({ limit: 10, offset: 20 });

        expect(request.query["limit"]).toBe("10");
        expect(request.query["offset"]).toBe("20");
      })
    );

    it.effect("should omit undefined query parameters", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({ limit: 10 });

        expect(request.query["limit"]).toBe("10");
        expect(request.query["offset"]).toBeUndefined();
      })
    );

    it.effect("should handle array query parameters", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({ tags: ["tag1", "tag2"] });

        expect(request.query["tags"]).toEqual(["tag1", "tag2"]);
      })
    );
  });

  describe("headers (HttpHeader)", () => {
    const RequestWithHeaders = S.Struct({
      contentType: S.optional(S.String).pipe(T.HttpHeader("Content-Type")),
      customHeader: S.optional(S.String).pipe(T.HttpHeader("X-Custom-Header")),
    }).pipe(
      T.all(T.Http({ method: "POST", uri: "/api/data" }), T.RestJsonProtocol())
    );

    const Response = S.Struct({});

    const operation: Operation = {
      input: RequestWithHeaders,
      output: Response,
      errors: [],
    };

    it.effect("should add custom headers", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          contentType: "application/xml",
          customHeader: "custom-value",
        });

        expect(request.headers["Content-Type"]).toBe("application/xml");
        expect(request.headers["X-Custom-Header"]).toBe("custom-value");
      })
    );
  });

  describe("JSON body", () => {
    const CreateRequest = S.Struct({
      name: S.String,
      email: S.String,
      age: S.optional(S.Number),
    }).pipe(
      T.all(T.Http({ method: "POST", uri: "/api/users" }), T.RestJsonProtocol())
    );

    const CreateResponse = S.Struct({ id: S.Number });

    const operation: Operation = {
      input: CreateRequest,
      output: CreateResponse,
      errors: [],
    };

    it.effect("should serialize body as JSON", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          name: "John",
          email: "john@example.com",
          age: 30,
        });

        expect(request.headers["Content-Type"]).toBe("application/json");
        expect(request.body).toBe(
          JSON.stringify({ name: "John", email: "john@example.com", age: 30 })
        );
      })
    );

    it.effect("should omit undefined body fields", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          name: "John",
          email: "john@example.com",
        });

        assertStringBody(request.body);
        const body = JSON.parse(request.body);
        expect(body).toEqual({ name: "John", email: "john@example.com" });
        expect("age" in body).toBe(false);
      })
    );
  });

  describe("payload body (HttpPayload)", () => {
    const UploadRequest = S.Struct({
      key: S.String.pipe(T.HttpLabel()),
      data: S.Unknown.pipe(T.HttpPayload()),
    }).pipe(
      T.all(
        T.Http({ method: "PUT", uri: "/api/files/{key}" }),
        T.RestJsonProtocol()
      )
    );

    const UploadResponse = S.Struct({ etag: S.String });

    const operation: Operation = {
      input: UploadRequest,
      output: UploadResponse,
      errors: [],
    };

    it.effect("should use payload field as entire body", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          key: "myfile.json",
          data: { content: "value" },
        });

        expect(request.path).toBe("/api/files/myfile.json");
        expect(request.body).toBe(JSON.stringify({ content: "value" }));
      })
    );
  });

  describe("combined request parts", () => {
    const ComplexRequest = S.Struct({
      projectId: S.String.pipe(T.HttpLabel()),
      eventType: S.optional(S.String).pipe(T.HttpQuery("type")),
      authorization: S.optional(S.String).pipe(T.HttpHeader("Authorization")),
      event: S.Struct({
        name: S.String,
        properties: S.optional(S.Record({ key: S.String, value: S.Unknown })),
      }),
    }).pipe(
      T.all(
        T.Http({ method: "POST", uri: "/api/projects/{projectId}/events" }),
        T.RestJsonProtocol()
      )
    );

    const ComplexResponse = S.Struct({ eventId: S.String });

    const operation: Operation = {
      input: ComplexRequest,
      output: ComplexResponse,
      errors: [],
    };

    it.effect("should handle all request parts together", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          projectId: "proj-123",
          eventType: "pageview",
          authorization: "Bearer token123",
          event: {
            name: "Page View",
            properties: { url: "/home" },
          },
        });

        expect(request.method).toBe("POST");
        expect(request.path).toBe("/api/projects/proj-123/events");
        expect(request.query["type"]).toBe("pageview");
        expect(request.headers["Authorization"]).toBe("Bearer token123");

        assertStringBody(request.body);
        const body = JSON.parse(request.body);
        expect(body.event.name).toBe("Page View");
        expect(body.event.properties).toEqual({ url: "/home" });
      })
    );
  });

  describe("Date handling", () => {
    const DateRequest = S.Struct({
      createdAfter: S.optional(S.Date).pipe(T.HttpHeader("X-Created-After")),
      timestamp: S.optional(S.Date),
    }).pipe(
      T.all(
        T.Http({ method: "POST", uri: "/api/events" }),
        T.RestJsonProtocol()
      )
    );

    const DateResponse = S.Struct({});

    const operation: Operation = {
      input: DateRequest,
      output: DateResponse,
      errors: [],
    };

    it.effect("should serialize Date in headers as ISO string", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const date = new Date("2024-01-15T10:30:00.000Z");
        const request = yield* builder({ createdAfter: date });

        expect(request.headers["X-Created-After"]).toBe(
          "2024-01-15T10:30:00.000Z"
        );
      })
    );

    it.effect("should serialize Date in body as ISO string", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const date = new Date("2024-01-15T10:30:00.000Z");
        const request = yield* builder({ timestamp: date });

        assertStringBody(request.body);
        const body = JSON.parse(request.body);
        expect(body.timestamp).toBe("2024-01-15T10:30:00.000Z");
      })
    );
  });

  describe("error cases", () => {
    it.effect(
      "should fail with MissingHttpTraitError if no HTTP trait found",
      () =>
        Effect.gen(function* () {
          const NoHttpTraitRequest = S.Struct({ name: S.String });
          const Response = S.Struct({});

          const operation: Operation = {
            input: NoHttpTraitRequest,
            output: Response,
            errors: [],
          };

          const error = yield* makeRequestBuilder(operation).pipe(Effect.flip);

          expect(error._tag).toBe("MissingHttpTraitError");
          expect(error).toBeInstanceOf(MissingHttpTraitError);
          expect(error.message).toBe("No HTTP trait found on input schema");
        })
    );
  });
});
