/**
 * Attio API Trait Annotations for Effect Schema
 *
 * This file defines HTTP binding traits that can be applied to Effect Schemas.
 * These traits are used by the protocol layer to serialize requests and parse responses.
 *
 * Based on distilled-aws traits.ts, simplified for REST-JSON APIs.
 */

import type * as AST from "effect/SchemaAST";

import * as Match from "effect/Match";
import * as S from "effect/Schema";

/**
 * Internal symbol for annotation metadata storage
 */
const annotationMetaSymbol = Symbol.for("distilled-attio/annotation-meta");

/**
 * Any type that has an .annotations() method returning itself.
 */
type Annotatable = {
  annotations(annotations: unknown): Annotatable;
};

/**
 * An Annotation is a callable that can be used with .pipe() AND
 * has symbol properties so it works directly with S.Class() second argument.
 */
export interface Annotation {
  <A extends Annotatable>(schema: A): A;
  readonly [annotationMetaSymbol]: Array<{ symbol: symbol; value: unknown }>;
  readonly [key: symbol]: unknown;
  readonly [key: string]: unknown;
}

/**
 * Create an annotation builder for a given symbol and value
 */
function makeAnnotation<T>(sym: symbol, value: T): Annotation {
  const fn = <A extends Annotatable>(schema: A): A =>
    schema.annotations({ [sym]: value }) as A;

  (fn as unknown as Record<symbol, unknown>)[annotationMetaSymbol] = [
    { symbol: sym, value },
  ];
  (fn as unknown as Record<symbol, unknown>)[sym] = value;

  return fn as Annotation;
}

/**
 * Combine multiple annotations into one.
 */
export function all(...annotations: Annotation[]): Annotation {
  const entries: Array<{ symbol: symbol; value: unknown }> = [];
  const raw: Record<symbol, unknown> = {};

  for (const a of annotations) {
    for (const entry of a[annotationMetaSymbol]) {
      entries.push(entry);
      raw[entry.symbol] = entry.value;
    }
  }

  const fn = <A extends Annotatable>(schema: A): A =>
    schema.annotations(raw) as A;

  (fn as unknown as Record<symbol, unknown>)[annotationMetaSymbol] = entries;

  for (const { symbol, value } of entries) {
    (fn as unknown as Record<symbol, unknown>)[symbol] = value;
  }

  return fn as Annotation;
}

// =============================================================================
// HTTP Binding Traits
// =============================================================================

/** Bind member to an HTTP header */
export const httpHeaderSymbol = Symbol.for("distilled-attio/http-header");
export const HttpHeader = (name: string) =>
  makeAnnotation(httpHeaderSymbol, name);

/** Bind member to the HTTP body */
export const httpPayloadSymbol = Symbol.for("distilled-attio/http-payload");
export const HttpPayload = () => makeAnnotation(httpPayloadSymbol, true);

/** Bind member to a URI path parameter */
export const httpLabelSymbol = Symbol.for("distilled-attio/http-label");
export const HttpLabel = (labelName?: string) =>
  makeAnnotation(httpLabelSymbol, labelName ?? true);

/** Bind member to a query string parameter */
export const httpQuerySymbol = Symbol.for("distilled-attio/http-query");
export const HttpQuery = (name: string) =>
  makeAnnotation(httpQuerySymbol, name);

/** Bind member to the HTTP response status code */
export const httpResponseCodeSymbol = Symbol.for(
  "distilled-attio/http-response-code"
);
export const HttpResponseCode = () =>
  makeAnnotation(httpResponseCodeSymbol, true);

// =============================================================================
// JSON Serialization Traits
// =============================================================================

/** Custom JSON key name - uses Effect Schema's fromKey for automatic key renaming */
export const jsonNameSymbol = Symbol.for("distilled-attio/json-name");

const propertySignatureSymbol = Symbol.for("effect/PropertySignature");

export const JsonName = (name: string) => {
  return <A extends Annotatable>(schema: A): A => {
    if (propertySignatureSymbol in schema) {
      return (schema as unknown as S.PropertySignature.Any).pipe(
        S.fromKey(name)
      ) as unknown as A;
    }

    if (S.isSchema(schema)) {
      return S.propertySignature(schema as S.Schema.Any).pipe(
        S.fromKey(name)
      ) as unknown as A;
    }

    return schema.annotations({ [jsonNameSymbol]: name }) as A;
  };
};

// =============================================================================
// Timestamp Traits
// =============================================================================

/** Timestamp serialization format */
export const timestampFormatSymbol = Symbol.for(
  "distilled-attio/timestamp-format"
);
export type TimestampFormatType = "date-time" | "epoch-seconds";

/**
 * TimestampFormat trait - applies both annotation and transform.
 */
export const TimestampFormat = (format: TimestampFormatType) => {
  return <A extends S.Schema.Any>(schema: A): A => {
    const transformed =
      format === "epoch-seconds"
        ? S.transform(S.Number, S.DateFromSelf, {
            strict: true,
            decode: (n) => new Date(n * 1000),
            encode: (d) => d.getTime() / 1000,
          })
        : schema; // date-time (ISO 8601) - S.Date already handles this

    return transformed.annotations({
      [timestampFormatSymbol]: format,
    }) as unknown as A;
  };
};

// =============================================================================
// Operation-Level HTTP Trait
// =============================================================================

/** HTTP binding for an operation (applied to request schema) */
export const httpSymbol = Symbol.for("distilled-attio/http");
export interface HttpTrait {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  uri: string;
  dataWrapper?: boolean;
}
export const Http = (trait: HttpTrait) => makeAnnotation(httpSymbol, trait);

// =============================================================================
// Attio Service Traits
// =============================================================================

/** Attio API service identification */
export const attioServiceSymbol = Symbol.for(
  "distilled-attio/attio-service"
);
export interface AttioServiceTrait {
  name: string;
  version?: string;
}
export const AttioService = (trait: AttioServiceTrait) =>
  makeAnnotation(attioServiceSymbol, trait);

// =============================================================================
// Protocol Trait
// =============================================================================

/** REST-JSON protocol marker */
export const restJsonProtocolSymbol = Symbol.for(
  "distilled-attio/rest-json-protocol"
);
export const RestJsonProtocol = () =>
  makeAnnotation(restJsonProtocolSymbol, true);

// =============================================================================
// Pagination Trait
// =============================================================================

/**
 * Pagination trait metadata for operations that support pagination.
 */
export interface PaginatedTrait {
  /** The name of the input member containing the pagination offset */
  inputToken: string;
  /** The path to the output member containing the next pagination offset/cursor */
  outputToken: string;
  /** The path to the output member containing the paginated items */
  items?: string;
  /** The name of the input member that limits page size */
  pageSize?: string;
}

// =============================================================================
// Annotation Retrieval Helpers
// =============================================================================

/**
 * Get a single annotation from an AST node
 */
export const getAnnotation = <T>(
  ast: AST.AST,
  symbol: symbol
): T | undefined => {
  return ast.annotations?.[symbol] as T | undefined;
};

/**
 * Get annotation from a PropertySignature.
 */
export const getPropAnnotation = <T>(
  prop: AST.PropertySignature,
  symbol: symbol
): T | undefined => {
  const propAnnot = prop.annotations?.[symbol] as T | undefined;
  if (propAnnot !== undefined) return propAnnot;

  return getAnnotationUnwrap(prop.type, symbol);
};

/**
 * Check if a PropertySignature has a specific annotation
 */
export const hasPropAnnotation = (
  prop: AST.PropertySignature,
  symbol: symbol
): boolean => {
  if (prop.annotations?.[symbol] !== undefined) return true;
  return hasAnnotation(prop.type, symbol);
};

/**
 * Check if an AST has a specific annotation
 */
export const hasAnnotation = (ast: AST.AST, symbol: symbol): boolean => {
  if (ast.annotations?.[symbol] !== undefined) return true;

  return Match.value(ast).pipe(
    Match.when({ _tag: "Suspend" }, (s) => hasAnnotation(s.f(), symbol)),
    Match.when({ _tag: "Union" }, (u) => {
      const nonNullishTypes = u.types.filter(
        (t: AST.AST) =>
          t._tag !== "UndefinedKeyword" &&
          !(t._tag === "Literal" && t.literal === null)
      );
      return nonNullishTypes.some((t: AST.AST) => hasAnnotation(t, symbol));
    }),
    Match.when({ _tag: "Transformation" }, (t) => {
      if (t.to?.annotations?.[symbol] !== undefined) return true;
      return hasAnnotation(t.from, symbol);
    }),
    Match.orElse(() => false)
  );
};

/**
 * Get annotation value, unwrapping Union/Transformation/Suspend if needed
 */
export const getAnnotationUnwrap = <T>(
  ast: AST.AST,
  symbol: symbol
): T | undefined => {
  const direct = ast.annotations?.[symbol] as T | undefined;
  if (direct !== undefined) return direct;

  return Match.value(ast).pipe(
    Match.when({ _tag: "Suspend" }, (s) =>
      getAnnotationUnwrap<T>(s.f(), symbol)
    ),
    Match.when({ _tag: "Transformation" }, (t) => {
      const toValue = t.to?.annotations?.[symbol] as T | undefined;
      if (toValue !== undefined) return toValue;
      return t.from?.annotations?.[symbol] as T | undefined;
    }),
    Match.when({ _tag: "Union" }, (u) => {
      const nonNullishTypes = u.types.filter(
        (t: AST.AST) =>
          t._tag !== "UndefinedKeyword" &&
          !(t._tag === "Literal" && t.literal === null)
      );
      if (nonNullishTypes.length === 1 && nonNullishTypes[0]) {
        return getAnnotationUnwrap<T>(nonNullishTypes[0], symbol);
      }
      return undefined;
    }),
    Match.orElse(() => undefined)
  ) as T | undefined;
};

// =============================================================================
// Property Annotation Helpers
// =============================================================================

/** Get httpHeader annotation value from property */
export const getHttpHeader = (
  prop: AST.PropertySignature
): string | undefined => getPropAnnotation<string>(prop, httpHeaderSymbol);

/** Check if property has httpLabel annotation */
export const hasHttpLabel = (prop: AST.PropertySignature): boolean =>
  hasPropAnnotation(prop, httpLabelSymbol);

/** Get httpQuery annotation value from property */
export const getHttpQuery = (prop: AST.PropertySignature): string | undefined =>
  getPropAnnotation<string>(prop, httpQuerySymbol);

/** Check if property has httpPayload annotation */
export const hasHttpPayload = (prop: AST.PropertySignature): boolean =>
  hasPropAnnotation(prop, httpPayloadSymbol);

/** Get HTTP trait from a schema */
export const getHttpTrait = (ast: AST.AST): HttpTrait | undefined =>
  getAnnotationUnwrap<HttpTrait>(ast, httpSymbol);

/** Get Attio service trait from a schema */
export const getAttioService = (
  ast: AST.AST
): AttioServiceTrait | undefined =>
  getAnnotationUnwrap<AttioServiceTrait>(ast, attioServiceSymbol);

/**
 * Helper to get a value from an object using a dot-separated path.
 * Used for pagination traits where outputToken and items can be paths.
 */
export const getPath = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, part) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, obj);
