# HTTP Trait Annotation System Reference

The trait system annotates Effect Schema classes with HTTP binding metadata. The request builder reads these annotations at runtime to serialize inputs into HTTP requests.

## Canonical Reference

- `packages/posthog/src/traits.ts`

## Overview

**Copy this file verbatim** — only change the symbol namespace from `"distilled-posthog"` to `"distilled-<service>"`.

Traits are annotation factories that work with Effect Schema's `.pipe()` and `S.Class()` second argument:

```typescript
// On individual properties (via .pipe()):
project_id: S.String.pipe(T.HttpLabel()),
limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
authorization: S.optional(S.String).pipe(T.HttpHeader("Authorization")),

// On the class itself (second argument to S.Class):
export class ListRequest extends S.Class<ListRequest>("ListRequest")(
  { /* properties */ },
  T.all(
    T.Http({ method: "GET", uri: "/api/v1/{project_id}/items/" }),
    T.RestJsonProtocol()
  )
) {}
```

## Trait Inventory

### Property-Level Traits

| Trait | Purpose | Request Part |
|-------|---------|-------------|
| `HttpLabel(name?)` | URI path parameter — substituted into `{name}` in the URI template | Path |
| `HttpQuery(name)` | Query string parameter | Query string |
| `HttpHeader(name)` | HTTP request header | Headers |
| `HttpPayload()` | Single field becomes entire request body | Body |
| *(no trait)* | Default — collected into JSON body object | Body |

### Class-Level Traits

| Trait | Purpose |
|-------|---------|
| `Http({ method, uri })` | HTTP method and URI template for the operation |
| `RestJsonProtocol()` | Marks this as a REST-JSON operation |
| `PostHogService({ name, version? })` | Service identification metadata |

### Serialization Traits

| Trait | Purpose |
|-------|---------|
| `JsonName(fieldName)` | Custom JSON key name (uses Effect Schema `fromKey`) |
| `TimestampFormat("date-time" \| "epoch-seconds")` | Date serialization format |

### Combiner

| Trait | Purpose |
|-------|---------|
| `all(...annotations)` | Merge multiple annotations into one (used for class-level) |

## How the Request Builder Uses Traits

The `makeRequestBuilder()` in `client/request-builder.ts`:

1. **Reads `Http` trait** from the input schema AST → extracts `method` and `uri`
2. **Iterates property signatures** and classifies each by annotation:
   - `HttpLabel` → path parameter (substituted into URI template `{name}`)
   - `HttpQuery` → query string parameter
   - `HttpHeader` → request header
   - `HttpPayload` → raw body (single property becomes entire body)
   - No annotation → JSON body property
3. **Builds the request**:
   - Path: substitute labels into URI template, URL-encode values
   - Query: collect annotated properties, stringify values
   - Headers: collect annotated properties + default `Content-Type: application/json`
   - Body: serialize remaining properties as JSON object (or use payload property as entire body)

## URI Template Syntax

```
/api/v1/{project_id}/resources/{id}/
```

- `{name}` — simple label, value is URL-encoded
- `{name+}` — greedy label, value is NOT URL-encoded (preserves slashes)

The request builder matches property names to template placeholders:
```typescript
project_id: S.String.pipe(T.HttpLabel()),  // matches {project_id}
id: S.Number.pipe(T.HttpLabel()),           // matches {id}
```

## Full Trait Implementation

```typescript
// Symbol namespace — change "distilled-posthog" to "distilled-<service>"
const annotationMetaSymbol = Symbol.for("distilled-<service>/annotation-meta");

export const httpHeaderSymbol = Symbol.for("distilled-<service>/http-header");
export const HttpHeader = (name: string) => makeAnnotation(httpHeaderSymbol, name);

export const httpPayloadSymbol = Symbol.for("distilled-<service>/http-payload");
export const HttpPayload = () => makeAnnotation(httpPayloadSymbol, true);

export const httpLabelSymbol = Symbol.for("distilled-<service>/http-label");
export const HttpLabel = (labelName?: string) => makeAnnotation(httpLabelSymbol, labelName ?? true);

export const httpQuerySymbol = Symbol.for("distilled-<service>/http-query");
export const HttpQuery = (name: string) => makeAnnotation(httpQuerySymbol, name);

export const httpSymbol = Symbol.for("distilled-<service>/http");
export interface HttpTrait {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  uri: string;
}
export const Http = (trait: HttpTrait) => makeAnnotation(httpSymbol, trait);

export const restJsonProtocolSymbol = Symbol.for("distilled-<service>/rest-json-protocol");
export const RestJsonProtocol = () => makeAnnotation(restJsonProtocolSymbol, true);

export const jsonNameSymbol = Symbol.for("distilled-<service>/json-name");
export const JsonName = (name: string) => { /* uses S.fromKey for automatic key renaming */ };

export const timestampFormatSymbol = Symbol.for("distilled-<service>/timestamp-format");
export const TimestampFormat = (format: "date-time" | "epoch-seconds") => { /* transform + annotate */ };
```

## Annotation Retrieval Helpers

These are used by the request builder to inspect schema AST:

```typescript
getAnnotation(ast, symbol)        // Get annotation value from AST node
getPropAnnotation(prop, symbol)   // Get annotation from PropertySignature
hasPropAnnotation(prop, symbol)   // Check if PropertySignature has annotation
hasAnnotation(ast, symbol)        // Check if AST has annotation (handles Union/Transformation/Suspend)
getAnnotationUnwrap(ast, symbol)  // Get annotation, unwrapping wrapper types
getHttpTrait(ast)                 // Shortcut for Http trait
getHttpHeader(prop)               // Shortcut for HttpHeader value
getHttpQuery(prop)                // Shortcut for HttpQuery value
hasHttpLabel(prop)                // Shortcut for HttpLabel check
hasHttpPayload(prop)              // Shortcut for HttpPayload check
getPath(obj, path)                // Navigate nested object by dot-separated path
```

## Pagination Trait

Pagination metadata is NOT an annotation — it's a plain object on the Operation definition:

```typescript
export interface PaginatedTrait {
  inputToken: string;    // Input param name (e.g. "offset", "cursor", "after")
  outputToken: string;   // Response field containing next page URL (e.g. "next")
  items?: string;        // Response field containing items array (e.g. "results", "data")
  pageSize?: string;     // Input param for page size (e.g. "limit")
}
```
