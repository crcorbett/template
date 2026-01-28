import type * as AST from "effect/SchemaAST";

import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

import * as T from "../src/traits.js";

/**
 * Get property signatures from a Struct schema, asserting the AST is a TypeLiteral.
 * Uses _tag discriminant narrowing instead of type casting.
 */
const getProps = (schema: S.Schema.Any): readonly AST.PropertySignature[] => {
  const ast = schema.ast;
  if (ast._tag !== "TypeLiteral") {
    throw new Error(`Expected TypeLiteral, got ${ast._tag}`);
  }
  return ast.propertySignatures;
};

/**
 * Get the first property signature from a Struct schema.
 * Throws if the schema has no properties.
 */
const firstProp = (schema: S.Schema.Any): AST.PropertySignature => {
  const props = getProps(schema);
  const prop = props[0];
  if (prop === undefined) {
    throw new Error("Expected at least one property signature");
  }
  return prop;
};

describe("Traits", () => {
  describe("makeAnnotation + symbol access", () => {
    it("HttpHeader creates annotation with symbol", () => {
      const schema = S.String.pipe(T.HttpHeader("X-Custom"));
      const ast = schema.ast;
      expect(ast.annotations?.[T.httpHeaderSymbol]).toBe("X-Custom");
    });

    it("HttpPayload creates boolean annotation", () => {
      const schema = S.String.pipe(T.HttpPayload());
      expect(schema.ast.annotations?.[T.httpPayloadSymbol]).toBe(true);
    });

    it("HttpLabel with no arg defaults to true", () => {
      const schema = S.String.pipe(T.HttpLabel());
      expect(schema.ast.annotations?.[T.httpLabelSymbol]).toBe(true);
    });

    it("HttpLabel with name stores name", () => {
      const schema = S.String.pipe(T.HttpLabel("customLabel"));
      expect(schema.ast.annotations?.[T.httpLabelSymbol]).toBe("customLabel");
    });

    it("HttpQuery stores query param name", () => {
      const schema = S.String.pipe(T.HttpQuery("page"));
      expect(schema.ast.annotations?.[T.httpQuerySymbol]).toBe("page");
    });

    it("HttpResponseCode creates boolean annotation", () => {
      const schema = S.Number.pipe(T.HttpResponseCode());
      expect(schema.ast.annotations?.[T.httpResponseCodeSymbol]).toBe(true);
    });

    it("Http stores method and uri", () => {
      const schema = S.Struct({}).pipe(
        T.Http({ method: "POST", uri: "/users" })
      );
      const trait = T.getHttpTrait(schema.ast);
      expect(trait).toBeDefined();
      expect(trait?.method).toBe("POST");
      expect(trait?.uri).toBe("/users");
    });

    it("PostHogService stores service metadata", () => {
      const schema = S.Struct({}).pipe(
        T.PostHogService({ name: "users", version: "v1" })
      );
      const trait = T.getPostHogService(schema.ast);
      expect(trait).toBeDefined();
      expect(trait?.name).toBe("users");
      expect(trait?.version).toBe("v1");
    });

    it("RestJsonProtocol creates boolean annotation", () => {
      const schema = S.Struct({}).pipe(T.RestJsonProtocol());
      expect(schema.ast.annotations?.[T.restJsonProtocolSymbol]).toBe(true);
    });
  });

  describe("all() combining annotations", () => {
    it("combines multiple annotations", () => {
      const combined = T.all(
        T.Http({ method: "GET", uri: "/test" }),
        T.RestJsonProtocol(),
        T.PostHogService({ name: "test" })
      );
      const schema = S.Struct({}).pipe(combined);

      expect(schema.ast.annotations?.[T.httpSymbol]).toEqual({
        method: "GET",
        uri: "/test",
      });
      expect(schema.ast.annotations?.[T.restJsonProtocolSymbol]).toBe(true);
      expect(schema.ast.annotations?.[T.posthogServiceSymbol]).toEqual({
        name: "test",
      });
    });

    it("works with S.Class second argument", () => {
      class TestRequest extends S.Class<TestRequest>("TestRequest")(
        { id: S.String },
        T.all(T.Http({ method: "DELETE", uri: "/items/{id}" }))
      ) {}

      const ast = TestRequest.ast;
      const httpTrait = T.getHttpTrait(ast);
      expect(httpTrait?.method).toBe("DELETE");
      expect(httpTrait?.uri).toBe("/items/{id}");
    });
  });

  describe("JsonName", () => {
    it("applies fromKey to PropertySignature", () => {
      const prop = S.propertySignature(S.String).pipe(T.JsonName("user_name"));
      const schema = S.Struct({ userName: prop });
      const decoded = S.decodeUnknownSync(schema)({ user_name: "test" });
      expect(decoded.userName).toBe("test");
    });

    it("wraps plain schema in PropertySignature with fromKey", () => {
      const schema = S.Struct({
        userName: S.String.pipe(T.JsonName("user_name")),
      });
      const decoded = S.decodeUnknownSync(schema)({ user_name: "alice" });
      expect(decoded.userName).toBe("alice");
    });

    it("falls back to annotation for non-schema types", () => {
      // Create a mock that structurally satisfies Annotatable (has annotations method
      // returning itself) without using type casts. Object.assign copies symbol keys.
      const notSchema: {
        annotations(a: unknown): typeof notSchema;
      } & Record<symbol, unknown> = {
        annotations(a) {
          if (typeof a === "object" && a !== null) {
            Object.assign(notSchema, a);
          }
          return notSchema;
        },
      };
      const result = T.JsonName("test")(notSchema);
      expect(result[T.jsonNameSymbol]).toBe("test");
    });
  });

  describe("TimestampFormat", () => {
    it("epoch-seconds transforms number to Date", () => {
      const schema = S.Number.pipe(T.TimestampFormat("epoch-seconds"));
      // TimestampFormat erases the Date output type (returns A), so the
      // compile-time type is number while the runtime value is Date.
      // Widen to unknown to allow instanceof narrowing.
      const decoded: unknown = S.decodeUnknownSync(schema)(1700000000);
      expect(decoded).toBeInstanceOf(Date);
      if (decoded instanceof Date) {
        expect(decoded.getTime()).toBe(1700000000 * 1000);
      }
    });

    it("epoch-seconds encodes Date to number", () => {
      const schema = S.Number.pipe(T.TimestampFormat("epoch-seconds"));
      const date = new Date(1700000000 * 1000);
      const encoded = S.encodeUnknownSync(schema)(date);
      expect(encoded).toBe(1700000000);
    });

    it("date-time preserves schema (ISO 8601 handled by S.Date)", () => {
      const schema = S.Date.pipe(T.TimestampFormat("date-time"));
      expect(schema.ast.annotations?.[T.timestampFormatSymbol]).toBe(
        "date-time"
      );
    });
  });

  describe("getAnnotation", () => {
    it("returns annotation value from AST", () => {
      const schema = S.String.pipe(T.HttpHeader("Content-Type"));
      const value = T.getAnnotation<string>(schema.ast, T.httpHeaderSymbol);
      expect(value).toBe("Content-Type");
    });

    it("returns undefined for missing annotation", () => {
      const schema = S.String;
      const value = T.getAnnotation<string>(schema.ast, T.httpHeaderSymbol);
      expect(value).toBeUndefined();
    });
  });

  describe("hasAnnotation + AST unwrapping", () => {
    it("finds annotation in Suspend", () => {
      const lazySchema: S.Schema<string> = S.suspend(() =>
        S.String.pipe(T.HttpLabel())
      );
      expect(T.hasAnnotation(lazySchema.ast, T.httpLabelSymbol)).toBe(true);
    });

    it("finds annotation in Union (non-nullish type)", () => {
      const schema = S.optional(S.String.pipe(T.HttpQuery("q")));
      const struct = S.Struct({ query: schema });
      const prop = firstProp(struct);
      expect(T.hasPropAnnotation(prop, T.httpQuerySymbol)).toBe(true);
    });

    it("finds annotation in Transformation", () => {
      const schema = S.Number.pipe(T.TimestampFormat("epoch-seconds"));
      expect(T.hasAnnotation(schema.ast, T.timestampFormatSymbol)).toBe(true);
    });

    it("returns false when annotation not present", () => {
      const schema = S.String;
      expect(T.hasAnnotation(schema.ast, T.httpPayloadSymbol)).toBe(false);
    });
  });

  describe("getAnnotationUnwrap", () => {
    it("unwraps Suspend to get annotation", () => {
      const lazySchema = S.suspend(() => S.String.pipe(T.HttpHeader("X-Lazy")));
      const value = T.getAnnotationUnwrap<string>(
        lazySchema.ast,
        T.httpHeaderSymbol
      );
      expect(value).toBe("X-Lazy");
    });

    it("unwraps Transformation to get from annotation", () => {
      const schema = S.Number.pipe(T.TimestampFormat("epoch-seconds"));
      const value = T.getAnnotationUnwrap<string>(
        schema.ast,
        T.timestampFormatSymbol
      );
      expect(value).toBe("epoch-seconds");
    });

    it("unwraps single-type Union", () => {
      const schema = S.NullOr(S.String.pipe(T.HttpQuery("search")));
      const value = T.getAnnotationUnwrap<string>(
        schema.ast,
        T.httpQuerySymbol
      );
      expect(value).toBe("search");
    });

    it("returns undefined for multi-type Union without clear annotation", () => {
      const schema = S.Union(S.String, S.Number);
      const value = T.getAnnotationUnwrap<string>(
        schema.ast,
        T.httpQuerySymbol
      );
      expect(value).toBeUndefined();
    });
  });

  describe("getPropAnnotation", () => {
    it("gets annotation from property", () => {
      const schema = S.Struct({
        header: S.String.pipe(T.HttpHeader("Authorization")),
      });
      const prop = firstProp(schema);
      const value = T.getPropAnnotation<string>(prop, T.httpHeaderSymbol);
      expect(value).toBe("Authorization");
    });

    it("unwraps optional property type", () => {
      const schema = S.Struct({
        query: S.optional(S.String.pipe(T.HttpQuery("filter"))),
      });
      const prop = firstProp(schema);
      const value = T.getPropAnnotation<string>(prop, T.httpQuerySymbol);
      expect(value).toBe("filter");
    });
  });

  describe("helper functions", () => {
    it("getHttpHeader returns header name", () => {
      const schema = S.Struct({
        auth: S.String.pipe(T.HttpHeader("Authorization")),
      });
      const prop = firstProp(schema);
      expect(T.getHttpHeader(prop)).toBe("Authorization");
    });

    it("hasHttpLabel detects label annotation", () => {
      const schema = S.Struct({ id: S.String.pipe(T.HttpLabel()) });
      const prop = firstProp(schema);
      expect(T.hasHttpLabel(prop)).toBe(true);
    });

    it("getHttpQuery returns query param name", () => {
      const schema = S.Struct({ page: S.Number.pipe(T.HttpQuery("page")) });
      const prop = firstProp(schema);
      expect(T.getHttpQuery(prop)).toBe("page");
    });

    it("hasHttpPayload detects payload annotation", () => {
      const schema = S.Struct({ body: S.Unknown.pipe(T.HttpPayload()) });
      const prop = firstProp(schema);
      expect(T.hasHttpPayload(prop)).toBe(true);
    });

    it("getHttpTrait returns HTTP trait from schema", () => {
      const schema = S.Struct({}).pipe(
        T.Http({ method: "PATCH", uri: "/update" })
      );
      const trait = T.getHttpTrait(schema.ast);
      expect(trait?.method).toBe("PATCH");
      expect(trait?.uri).toBe("/update");
    });

    it("getPostHogService returns service trait", () => {
      const schema = S.Struct({}).pipe(T.PostHogService({ name: "analytics" }));
      const trait = T.getPostHogService(schema.ast);
      expect(trait?.name).toBe("analytics");
    });
  });

  describe("getPath", () => {
    it("gets top-level property", () => {
      expect(T.getPath({ foo: "bar" }, "foo")).toBe("bar");
    });

    it("gets nested property", () => {
      expect(T.getPath({ a: { b: { c: 42 } } }, "a.b.c")).toBe(42);
    });

    it("returns undefined for missing path", () => {
      expect(T.getPath({ a: 1 }, "b")).toBeUndefined();
    });

    it("returns undefined for null in path", () => {
      expect(T.getPath({ a: null }, "a.b")).toBeUndefined();
    });

    it("returns undefined for non-object in path", () => {
      expect(T.getPath({ a: "string" }, "a.b")).toBeUndefined();
    });

    it("handles empty path parts", () => {
      expect(T.getPath({ "": { "": "deep" } }, ".")).toBe("deep");
    });
  });
});
