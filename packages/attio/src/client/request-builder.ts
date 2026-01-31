/**
 * Request Builder for Attio API
 *
 * Serializes Effect Schema inputs into HTTP requests by reading HTTP trait annotations.
 * Simplified from distilled-aws for REST-JSON only (no SigV4, no XML protocols).
 */

import type * as AST from "effect/SchemaAST";

import * as Effect from "effect/Effect";

import type { Operation } from "./operation.js";
import type { Request } from "./request.js";

import { MissingHttpTraitError } from "../errors.js";
import {
  getHttpHeader,
  getHttpQuery,
  getHttpTrait,
  hasHttpLabel,
  hasHttpPayload,
  type HttpTrait,
} from "../traits.js";

/**
 * Get property signatures from an AST TypeLiteral or Struct
 */
function getPropertySignatures(
  ast: AST.AST
): ReadonlyArray<AST.PropertySignature> {
  // Handle Transformation (decode side)
  if (ast._tag === "Transformation") {
    return getPropertySignatures(ast.from);
  }

  // Handle TypeLiteral (struct)
  if (ast._tag === "TypeLiteral") {
    return ast.propertySignatures;
  }

  // Handle Suspend
  if (ast._tag === "Suspend") {
    return getPropertySignatures(ast.f());
  }

  return [];
}

/**
 * Encode a value for JSON body
 */
function encodeJsonValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  // Handle Date -> ISO string
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(encodeJsonValue);
  }

  // Handle objects recursively
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const encoded = encodeJsonValue(v);
      if (encoded !== undefined) {
        result[k] = encoded;
      }
    }
    return result;
  }

  return value;
}

/**
 * Build the URI path by substituting label parameters
 */
function buildPath(
  uriTemplate: string,
  input: Record<string, unknown>,
  labelProps: Map<string, AST.PropertySignature>
): string {
  // Handle greedy labels like {Key+} and simple labels like {Key}
  return Array.from(labelProps).reduce((path, [propName]) => {
    const value = input[propName];
    if (value === undefined) return path;

    const stringValue = String(value);
    const greedyPattern = new RegExp(`\\{${propName}\\+\\}`, "g");
    const simplePattern = new RegExp(`\\{${propName}\\}`, "g");

    // Greedy labels don't encode slashes, simple labels encode the value
    return path
      .replace(greedyPattern, stringValue)
      .replace(simplePattern, encodeURIComponent(stringValue));
  }, uriTemplate);
}

export interface RequestBuilderOptions {
  /** Override the HTTP trait */
  httpTrait?: HttpTrait;
}

/**
 * Create a request builder for a given operation.
 *
 * @param operation - The operation (with input/output schemas)
 * @param options - Optional overrides
 * @returns An Effect that resolves to a function that builds requests from input values
 */
export const makeRequestBuilder = (
  operation: Operation,
  _options?: RequestBuilderOptions
): Effect.Effect<
  (input: Record<string, unknown>) => Effect.Effect<Request>,
  MissingHttpTraitError
> => {
  const inputSchema = operation.input;
  const inputAst = inputSchema.ast;

  // Get HTTP trait from schema annotations
  const httpTrait = _options?.httpTrait ?? getHttpTrait(inputAst);
  if (!httpTrait) {
    return Effect.fail(
      new MissingHttpTraitError({
        message: "No HTTP trait found on input schema",
      })
    );
  }

  // Get property signatures from input schema
  const props = getPropertySignatures(inputAst);

  // Classify properties by their HTTP binding
  const labelProps = new Map<string, AST.PropertySignature>();
  const queryProps = new Map<
    string,
    { queryName: string; prop: AST.PropertySignature }
  >();
  const headerProps = new Map<
    string,
    { headerName: string; prop: AST.PropertySignature }
  >();
  const bodyProps: Array<{ propName: string; prop: AST.PropertySignature }> =
    [];

  for (const prop of props) {
    const propName = String(prop.name);

    if (hasHttpLabel(prop)) {
      labelProps.set(propName, prop);
    } else {
      const queryName = getHttpQuery(prop);
      const headerName = getHttpHeader(prop);
      if (queryName !== undefined) {
        queryProps.set(propName, { queryName, prop });
      } else if (headerName !== undefined) {
        headerProps.set(propName, { headerName, prop });
      } else if (!hasHttpPayload(prop)) {
        // Default: goes in JSON body
        bodyProps.push({ propName, prop });
      }
    }
  }

  // Find the single payload property (if any)
  const payloadProp = props
    .filter((prop) => hasHttpPayload(prop))
    .map((prop) => ({ propName: String(prop.name), prop }))[0];

  // Return a function that builds requests synchronously wrapped in Effect.succeed
  const requestBuilder = (
    input: Record<string, unknown>
  ): Effect.Effect<Request> => {

    // Build the path with label substitutions
    const basePath = buildPath(httpTrait.uri, input, labelProps);

    // Strip query string from URI template (query params come from annotations)
    const path = basePath.split("?")[0] ?? basePath;

    // Build query parameters
    const query: Record<string, string | string[] | undefined> = {};
    for (const [propName, { queryName }] of queryProps) {
      const value = input[propName];
      if (value !== undefined) {
        if (Array.isArray(value)) {
          query[queryName] = value.map(String);
        } else {
          query[queryName] = String(value);
        }
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    for (const [propName, { headerName }] of headerProps) {
      const value = input[propName];
      if (value !== undefined) {
        if (value instanceof Date) {
          headers[headerName] = value.toISOString();
        } else {
          headers[headerName] = String(value);
        }
      }
    }

    // Build body
    const buildBody = (): string | undefined => {
      // Don't send body for GET/HEAD/DELETE without explicit payload
      if (
        (httpTrait.method === "GET" ||
          httpTrait.method === "HEAD" ||
          httpTrait.method === "DELETE") &&
        !payloadProp
      ) {
        return undefined;
      }

      if (payloadProp) {
        // Single field becomes the entire body
        const payloadValue = input[payloadProp.propName];
        return payloadValue !== undefined
          ? JSON.stringify(encodeJsonValue(payloadValue))
          : undefined;
      }

      if (bodyProps.length > 0) {
        // Collect all body properties into a JSON object
        const bodyObj: Record<string, unknown> = {};
        for (const { propName } of bodyProps) {
          const value = input[propName];
          if (value !== undefined) {
            bodyObj[propName] = encodeJsonValue(value);
          }
        }
        if (Object.keys(bodyObj).length > 0) {
          return httpTrait.dataWrapper
            ? JSON.stringify({ data: bodyObj })
            : JSON.stringify(bodyObj);
        }
        return undefined;
      }

      return undefined;
    };

    const body = buildBody();

    // Don't send Content-Type for bodyless requests
    if (
      body === undefined &&
      (httpTrait.method === "GET" ||
        httpTrait.method === "HEAD" ||
        httpTrait.method === "DELETE")
    ) {
      delete headers["Content-Type"];
    }

    const request: Request = {
      method: httpTrait.method,
      path,
      query,
      headers,
      body,
    };

    return Effect.succeed(request);
  };

  return Effect.succeed(requestBuilder);
};
