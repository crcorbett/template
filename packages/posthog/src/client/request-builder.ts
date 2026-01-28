/**
 * Request Builder for PostHog API
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
function getPropertySignatures(ast: AST.AST): AST.PropertySignature[] {
  // Handle Transformation (decode side)
  if (ast._tag === "Transformation") {
    return getPropertySignatures(ast.from);
  }

  // Handle TypeLiteral (struct)
  if (ast._tag === "TypeLiteral") {
    return ast.propertySignatures as AST.PropertySignature[];
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
  let path = uriTemplate;

  // Handle greedy labels like {Key+}
  for (const [propName, _prop] of labelProps) {
    const greedyPattern = new RegExp(`\\{${propName}\\+\\}`, "g");
    const simplePattern = new RegExp(`\\{${propName}\\}`, "g");

    const value = input[propName];
    if (value !== undefined) {
      const stringValue = String(value);
      // Greedy labels don't encode slashes
      path = path.replace(greedyPattern, stringValue);
      // Simple labels encode the value
      path = path.replace(simplePattern, encodeURIComponent(stringValue));
    }
  }

  return path;
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
  (input: unknown) => Effect.Effect<Request>,
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
  let payloadProp:
    | { propName: string; prop: AST.PropertySignature }
    | undefined;
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
      } else if (hasHttpPayload(prop)) {
        payloadProp = { propName, prop };
      } else {
        // Default: goes in JSON body
        bodyProps.push({ propName, prop });
      }
    }
  }

  // Return a function that builds requests synchronously wrapped in Effect.succeed
  const requestBuilder = (input: unknown): Effect.Effect<Request> => {
    const inputObj = input as Record<string, unknown>;

    // Build the path with label substitutions
    const basePath = buildPath(httpTrait.uri, inputObj, labelProps);

    // Strip query string from URI template (query params come from annotations)
    const path = basePath.split("?")[0] ?? basePath;

    // Build query parameters
    const query: Record<string, string | string[] | undefined> = {};
    for (const [propName, { queryName }] of queryProps) {
      const value = inputObj[propName];
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
      const value = inputObj[propName];
      if (value !== undefined) {
        if (value instanceof Date) {
          headers[headerName] = value.toISOString();
        } else {
          headers[headerName] = String(value);
        }
      }
    }

    // Build body
    let body: string | undefined;

    if (payloadProp) {
      // Single field becomes the entire body
      const payloadValue = inputObj[payloadProp.propName];
      if (payloadValue !== undefined) {
        body = JSON.stringify(encodeJsonValue(payloadValue));
      }
    } else if (bodyProps.length > 0) {
      // Collect all body properties into a JSON object
      const bodyObj: Record<string, unknown> = {};
      for (const { propName } of bodyProps) {
        const value = inputObj[propName];
        if (value !== undefined) {
          bodyObj[propName] = encodeJsonValue(value);
        }
      }
      if (Object.keys(bodyObj).length > 0) {
        body = JSON.stringify(bodyObj);
      }
    }

    // Don't send body for GET/HEAD/DELETE without explicit payload
    if (
      (httpTrait.method === "GET" ||
        httpTrait.method === "HEAD" ||
        httpTrait.method === "DELETE") &&
      !payloadProp
    ) {
      body = undefined;
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
