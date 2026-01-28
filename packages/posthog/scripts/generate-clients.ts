/**
 * PostHog OpenAPI to Effect Schema Code Generator
 *
 * Generates typed clients from PostHog OpenAPI specifications.
 *
 * Usage: bun run scripts/generate-clients.ts
 */

import * as YAML from "js-yaml";
import * as fs from "node:fs";
import * as path from "node:path";

// =============================================================================
// Types for OpenAPI 3.0 Schema
// =============================================================================

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseObject>;
  security?: SecurityRequirement[];
}

interface Parameter {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

interface RequestBody {
  required?: boolean;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema?: SchemaObject | ReferenceObject;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, MediaType>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject | ReferenceObject>;
  required?: string[];
  items?: SchemaObject | ReferenceObject;
  enum?: string[];
  allOf?: (SchemaObject | ReferenceObject)[];
  oneOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  $ref?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  description?: string;
  default?: unknown;
  title?: string;
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  maxLength?: number;
  minLength?: number;
  maximum?: number;
  minimum?: number;
}

interface ReferenceObject {
  $ref: string;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: string;
}

type SecurityRequirement = Record<string, string[]>;

// =============================================================================
// Type Guards
// =============================================================================

function isOpenAPISpec(
  value: unknown
): value is OpenAPISpec {
  if (typeof value !== "object" || value === null) return false;
  if (!("openapi" in value) || !("paths" in value)) return false;
  // After `in` narrowing, access via index signature
  const v = value as Record<string, unknown>;
  return typeof v["openapi"] === "string" && typeof v["paths"] === "object" && v["paths"] !== null;
}

// =============================================================================
// Code Generation Helpers
// =============================================================================

/**
 * Convert a string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[_\-\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

/**
 * Convert a string to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Escape identifier for TypeScript
 */
function escapeIdentifier(name: string): string {
  // If it starts with a number or contains special chars, quote it
  if (/^[0-9]/.test(name) || /[^a-zA-Z0-9_]/.test(name)) {
    return `"${name}"`;
  }
  return name;
}

/**
 * Resolve a $ref to a schema name
 */
function resolveRef(ref: string): string {
  // #/components/schemas/Foo -> Foo
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? ref;
}

/**
 * Check if a schema is a reference
 */
function isRef(
  schema: SchemaObject | ReferenceObject
): schema is ReferenceObject {
  return "$ref" in schema;
}

/**
 * Convert OpenAPI type to Effect Schema
 */
function typeToSchema(
  schema: SchemaObject | ReferenceObject,
  required: boolean = true,
  schemas: Record<string, SchemaObject> = {}
): string {
  if (isRef(schema)) {
    const name = resolveRef(schema.$ref);
    return required ? name : `S.optional(${name})`;
  }

  const obj = schema;

  // Handle nullable
  const nullable = obj.nullable === true;

  let result: string;

  // Handle allOf (merge schemas)
  if (obj.allOf && obj.allOf[0]) {
    // For now, just take the first non-ref item or resolve the ref
    const first = obj.allOf[0];
    result = typeToSchema(first, true, schemas);
  }
  // Handle oneOf/anyOf (union types)
  else if (obj.oneOf || obj.anyOf) {
    const items = obj.oneOf || obj.anyOf || [];
    const types = items.map((item) => typeToSchema(item, true, schemas));
    result = `S.Union(${types.join(", ")})`;
  }
  // Handle enums
  else if (obj.enum) {
    const literals = obj.enum.map((v) => `S.Literal("${v}")`).join(", ");
    result = `S.Union(${literals})`;
  }
  // Handle arrays
  else if (obj.type === "array") {
    const itemSchema = obj.items
      ? typeToSchema(obj.items, true, schemas)
      : "S.Unknown";
    result = `S.Array(${itemSchema})`;
  }
  // Handle objects
  else if (obj.type === "object" || obj.properties) {
    if (obj.properties) {
      const props = Object.entries(obj.properties)
        .map(([propName, propSchema]) => {
          const isRequired = obj.required?.includes(propName) ?? false;
          const propType = typeToSchema(propSchema, isRequired, schemas);
          return `${escapeIdentifier(propName)}: ${propType}`;
        })
        .join(",\n    ");
      result = `S.Struct({\n    ${props}\n  })`;
    } else if (obj.additionalProperties) {
      // Record/map type
      const valueType =
        typeof obj.additionalProperties === "boolean"
          ? "S.Unknown"
          : typeToSchema(obj.additionalProperties, true, schemas);
      result = `S.Record({ key: S.String, value: ${valueType} })`;
    } else {
      result = "S.Unknown";
    }
  }
  // Handle primitive types
  else {
    switch (obj.type) {
      case "string":
        if (obj.format === "date-time") {
          result = "S.Date";
        } else if (obj.format === "uuid") {
          result = "S.UUID";
        } else if (obj.format === "uri") {
          result = "S.String"; // Could use S.String.pipe(S.pattern(...))
        } else {
          result = "S.String";
        }
        break;
      case "integer":
        result = "S.Number"; // Effect Schema uses Number for both
        break;
      case "number":
        result = "S.Number";
        break;
      case "boolean":
        result = "S.Boolean";
        break;
      default:
        result = "S.Unknown";
    }
  }

  // Wrap in nullable if needed
  if (nullable) {
    result = `S.NullOr(${result})`;
  }

  // Wrap in optional if not required
  if (!required) {
    result = `S.optional(${result})`;
  }

  return result;
}

/**
 * Group operations by tag
 */
function groupOperationsByTag(spec: OpenAPISpec): Map<
  string,
  Array<{
    operationId: string;
    method: string;
    path: string;
    operation: Operation;
  }>
> {
  const groups = new Map<
    string,
    Array<{
      operationId: string;
      method: string;
      path: string;
      operation: Operation;
    }>
  >();

  for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
    const methods = ["get", "post", "put", "patch", "delete"] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const operationId = operation.operationId || `${method}_${pathStr}`;
      const tag = operation.tags?.[0] || "default";

      if (!groups.has(tag)) {
        groups.set(tag, []);
      }
      const group = groups.get(tag);
      if (group) {
        group.push({
          operationId,
          method: method.toUpperCase(),
          path: pathStr,
          operation,
        });
      }
    }
  }

  return groups;
}

// =============================================================================
// Service File Generator
// =============================================================================

/**
 * Generate the content of a service file
 */
function generateServiceFile(
  serviceName: string,
  operations: Array<{
    operationId: string;
    method: string;
    path: string;
    operation: Operation;
  }>,
  spec: OpenAPISpec
): string {
  const schemas = spec.components?.schemas || {};
  const lines: string[] = [];

  // Header
  lines.push(`/**`);
  lines.push(` * PostHog ${serviceName} API`);
  lines.push(` *`);
  lines.push(` * THIS FILE IS AUTO-GENERATED. DO NOT EDIT.`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import * as S from "effect/Schema";`);
  lines.push(`import * as T from "../traits.ts";`);
  lines.push(``);

  // Collect all referenced schemas for this service
  const referencedSchemas = new Set<string>();

  for (const op of operations) {
    // Check request body
    const requestBody =
      op.operation.requestBody?.content?.["application/json"]?.schema;
    if (requestBody && isRef(requestBody)) {
      collectSchemaRefs(requestBody, schemas, referencedSchemas);
    }

    // Check response
    const successResponse =
      op.operation.responses?.["200"] || op.operation.responses?.["201"];
    const responseSchema =
      successResponse?.content?.["application/json"]?.schema;
    if (responseSchema && isRef(responseSchema)) {
      collectSchemaRefs(responseSchema, schemas, referencedSchemas);
    }
  }

  // Generate schema definitions
  for (const schemaName of referencedSchemas) {
    const schema = schemas[schemaName];
    if (!schema) continue;

    lines.push(`// ${schemaName}`);
    lines.push(
      `export interface ${schemaName} extends S.Schema.Type<typeof ${schemaName}> {}`
    );
    lines.push(
      `export const ${schemaName} = ${typeToSchema(schema, true, schemas)}.annotations({ identifier: "${schemaName}" });`
    );
    lines.push(``);
  }

  // Generate operation schemas and functions
  for (const op of operations) {
    const fnName = toCamelCase(op.operationId);
    const requestName = toPascalCase(op.operationId) + "Request";
    const responseName = toPascalCase(op.operationId) + "Response";

    lines.push(
      `// =============================================================================`
    );
    lines.push(`// ${op.operationId}`);
    lines.push(
      `// =============================================================================`
    );
    lines.push(``);

    // Generate request schema
    const params = [...(op.operation.parameters || [])];

    const requestProps: string[] = [];

    for (const param of params) {
      const isRequired = param.required ?? false;
      const schemaType = param.schema
        ? typeToSchema(param.schema, isRequired, schemas)
        : "S.String";

      let prop = `${escapeIdentifier(param.name)}: ${schemaType}`;

      // Add HTTP binding annotation
      if (param.in === "path") {
        prop = `${escapeIdentifier(param.name)}: ${isRequired ? "S.String" : "S.optional(S.String)"}.pipe(T.HttpLabel())`;
      } else if (param.in === "query") {
        prop = `${escapeIdentifier(param.name)}: ${schemaType}.pipe(T.HttpQuery("${param.name}"))`;
      } else if (param.in === "header") {
        prop = `${escapeIdentifier(param.name)}: ${schemaType}.pipe(T.HttpHeader("${param.name}"))`;
      }

      requestProps.push(prop);
    }

    // Add request body if present
    const requestBody =
      op.operation.requestBody?.content?.["application/json"]?.schema;
    if (requestBody) {
      const bodyType = isRef(requestBody)
        ? resolveRef(requestBody.$ref)
        : typeToSchema(requestBody, true, schemas);
      requestProps.push(`body: ${bodyType}.pipe(T.HttpPayload())`);
    }

    lines.push(
      `export interface ${requestName} extends S.Schema.Type<typeof ${requestName}> {}`
    );
    lines.push(`export const ${requestName} = S.Struct({`);
    lines.push(`  ${requestProps.join(",\n  ")}`);
    lines.push(`}).pipe(`);
    lines.push(`  T.Http({ method: "${op.method}", uri: "${op.path}" }),`);
    lines.push(`  T.PostHogService({ name: "${serviceName}" }),`);
    lines.push(`  T.RestJsonProtocol()`);
    lines.push(`).annotations({ identifier: "${requestName}" });`);
    lines.push(``);

    // Generate response schema
    const successResponse =
      op.operation.responses?.["200"] || op.operation.responses?.["201"];
    const responseSchema =
      successResponse?.content?.["application/json"]?.schema;

    if (responseSchema) {
      const responseType = isRef(responseSchema)
        ? resolveRef(responseSchema.$ref)
        : typeToSchema(responseSchema, true, schemas);

      lines.push(
        `export interface ${responseName} extends S.Schema.Type<typeof ${responseName}> {}`
      );
      lines.push(
        `export const ${responseName} = ${responseType}.annotations({ identifier: "${responseName}" });`
      );
    } else {
      lines.push(`export interface ${responseName} {}`);
      lines.push(
        `export const ${responseName} = S.Struct({}).annotations({ identifier: "${responseName}" });`
      );
    }
    lines.push(``);

    // Generate operation definition
    // Note: API.make() function will be implemented in client/api.ts
    lines.push(`// Operation: ${op.operationId}`);
    lines.push(`// ${op.method} ${op.path}`);
    if (op.operation.description) {
      lines.push(`// ${op.operation.description.split("\n")[0]}`);
    }
    lines.push(`export const ${fnName} = {`);
    lines.push(`  input: ${requestName},`);
    lines.push(`  output: ${responseName},`);
    lines.push(`};`);
    lines.push(``);
  }

  return lines.join("\n");
}

/**
 * Collect all schema references recursively
 */
function collectSchemaRefs(
  schema: SchemaObject | ReferenceObject,
  allSchemas: Record<string, SchemaObject>,
  collected: Set<string>
): void {
  if (isRef(schema)) {
    const name = resolveRef(schema.$ref);
    if (!collected.has(name)) {
      collected.add(name);
      const resolved = allSchemas[name];
      if (resolved) {
        collectSchemaRefs(resolved, allSchemas, collected);
      }
    }
    return;
  }

  const obj = schema;

  if (obj.allOf) {
    for (const item of obj.allOf) {
      collectSchemaRefs(item, allSchemas, collected);
    }
  }
  if (obj.oneOf) {
    for (const item of obj.oneOf) {
      collectSchemaRefs(item, allSchemas, collected);
    }
  }
  if (obj.anyOf) {
    for (const item of obj.anyOf) {
      collectSchemaRefs(item, allSchemas, collected);
    }
  }
  if (obj.items) {
    collectSchemaRefs(obj.items, allSchemas, collected);
  }
  if (obj.properties) {
    for (const prop of Object.values(obj.properties)) {
      collectSchemaRefs(prop, allSchemas, collected);
    }
  }
  if (
    obj.additionalProperties &&
    typeof obj.additionalProperties !== "boolean"
  ) {
    collectSchemaRefs(obj.additionalProperties, allSchemas, collected);
  }
}

// =============================================================================
// Main Generator
// =============================================================================

async function main() {
  // Load the OpenAPI spec
  const schemaPath = path.resolve(__dirname, "../../../schema.yaml");
  let schemaContent = fs.readFileSync(schemaPath, "utf-8");

  // Fix YAML issues: replace all backticks with single quotes
  // The PostHog schema has markdown with backticks in description fields
  // which causes YAML parsing errors
  schemaContent = schemaContent.replace(/`/g, "'");

  // Use js-yaml to parse
  const parsed = YAML.load(schemaContent);
  if (!isOpenAPISpec(parsed)) {
    throw new Error("Invalid OpenAPI spec: missing required 'openapi' or 'paths' fields");
  }
  const spec = parsed;

  console.log(`Loaded OpenAPI spec: ${spec.info.title} v${spec.info.version}`);
  console.log(`Found ${Object.keys(spec.paths).length} paths`);
  console.log(
    `Found ${Object.keys(spec.components?.schemas || {}).length} schemas`
  );

  // Group operations by tag
  const groups = groupOperationsByTag(spec);
  console.log(`\nGrouped into ${groups.size} services:`);

  // Filter to key services we want to generate
  const targetServices = [
    "environments", // Contains alerts, dashboards, insights, etc.
    "projects", // Project management
  ];

  const servicesDir = path.resolve(__dirname, "../src/services");

  // Ensure services directory exists
  if (!fs.existsSync(servicesDir)) {
    fs.mkdirSync(servicesDir, { recursive: true });
  }

  for (const [tag, operations] of groups) {
    // Only generate targeted services for now
    if (!targetServices.includes(tag)) continue;

    console.log(`  - ${tag}: ${operations.length} operations`);

    // Generate service file
    const content = generateServiceFile(tag, operations, spec);
    const fileName = `${tag}.ts`;
    const filePath = path.join(servicesDir, fileName);

    fs.writeFileSync(filePath, content);
    console.log(`    Generated: ${filePath}`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
