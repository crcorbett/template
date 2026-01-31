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
  describe("path parameter substitution", () => {
    const GetObjectRequest = S.Struct({
      object: S.String.pipe(T.HttpLabel()),
    }).pipe(
      T.all(
        T.Http({ method: "GET", uri: "/v2/objects/{object}" }),
        T.RestJsonProtocol()
      )
    );

    const operation: Operation = {
      input: GetObjectRequest,
      output: S.Struct({}),
      errors: [],
    };

    it.effect("should substitute path parameters", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({ object: "people" });
        expect(request.path).toBe("/v2/objects/people");
      })
    );
  });

  describe("multiple path params", () => {
    const GetAttrRequest = S.Struct({
      target: S.String.pipe(T.HttpLabel()),
      identifier: S.String.pipe(T.HttpLabel()),
      attribute: S.String.pipe(T.HttpLabel()),
    }).pipe(
      T.all(
        T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes/{attribute}" }),
        T.RestJsonProtocol()
      )
    );

    const operation: Operation = {
      input: GetAttrRequest,
      output: S.Struct({}),
      errors: [],
    };

    it.effect("should substitute multiple path params", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          target: "objects",
          identifier: "people",
          attribute: "name",
        });
        expect(request.path).toBe("/v2/objects/people/attributes/name");
      })
    );
  });

  describe("query params with T.HttpQuery()", () => {
    const ListRequest = S.Struct({
      limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
      offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    }).pipe(
      T.all(T.Http({ method: "GET", uri: "/v2/notes" }), T.RestJsonProtocol())
    );

    const operation: Operation = {
      input: ListRequest,
      output: S.Struct({}),
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
  });

  describe("POST body fields (without T.HttpQuery())", () => {
    const QueryRequest = S.Struct({
      object: S.String.pipe(T.HttpLabel()),
      filter: S.optional(S.Unknown),
      limit: S.optional(S.Number),
      offset: S.optional(S.Number),
    }).pipe(
      T.all(
        T.Http({ method: "POST", uri: "/v2/objects/{object}/records/query" }),
        T.RestJsonProtocol()
      )
    );

    const operation: Operation = {
      input: QueryRequest,
      output: S.Struct({}),
      errors: [],
    };

    it.effect("should put non-annotated fields in body", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          object: "people",
          limit: 5,
          offset: 10,
        });

        expect(request.path).toBe("/v2/objects/people/records/query");
        assertStringBody(request.body);
        const body = JSON.parse(request.body);
        expect(body.limit).toBe(5);
        expect(body.offset).toBe(10);
        // object should NOT be in the body (it's a label)
        expect(body.object).toBeUndefined();
      })
    );
  });

  describe("PUT with query param (matching_attribute pattern)", () => {
    const AssertRequest = S.Struct({
      object: S.String.pipe(T.HttpLabel()),
      matching_attribute: S.String.pipe(T.HttpQuery("matching_attribute")),
      data: S.Unknown,
    }).pipe(
      T.all(
        T.Http({ method: "PUT", uri: "/v2/objects/{object}/records" }),
        T.RestJsonProtocol()
      )
    );

    const operation: Operation = {
      input: AssertRequest,
      output: S.Struct({}),
      errors: [],
    };

    it.effect("should handle PUT with query param and body", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({
          object: "people",
          matching_attribute: "email_addresses",
          data: { values: { name: [{ value: "Test" }] } },
        });

        expect(request.method).toBe("PUT");
        expect(request.path).toBe("/v2/objects/people/records");
        expect(request.query["matching_attribute"]).toBe("email_addresses");
        assertStringBody(request.body);
        const body = JSON.parse(request.body);
        expect(body.data).toBeDefined();
      })
    );
  });

  describe("empty request", () => {
    const EmptyRequest = S.Struct({}).pipe(
      T.all(T.Http({ method: "GET", uri: "/v2/objects" }), T.RestJsonProtocol())
    );

    const operation: Operation = {
      input: EmptyRequest,
      output: S.Struct({}),
      errors: [],
    };

    it.effect("should handle empty request", () =>
      Effect.gen(function* () {
        const builder = yield* makeRequestBuilder(operation);
        const request = yield* builder({});
        expect(request.method).toBe("GET");
        expect(request.path).toBe("/v2/objects");
        expect(request.body).toBeUndefined();
      })
    );
  });

  describe("missing HTTP trait", () => {
    it.effect("should fail with MissingHttpTraitError", () =>
      Effect.gen(function* () {
        const NoHttpTraitRequest = S.Struct({ name: S.String });

        const operation: Operation = {
          input: NoHttpTraitRequest,
          output: S.Struct({}),
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
