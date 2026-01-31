# Research: Effect Schema for Dynamic Code Generation from User Inputs

> How Effect TypeScript enables type-safe code generation from user-defined dynamic inputs
> in a PLG (Product-Led Growth) builder UI.

---

## Table of Contents

1. [Effect Schema for Dynamic User Input Validation](#1-effect-schema-for-dynamic-user-input-validation)
2. [Tagged Unions for Discriminated User Input Types](#2-tagged-unions-for-discriminated-user-input-types)
3. [Schema AST Introspection for Code Generation](#3-schema-ast-introspection-for-code-generation)
4. [JSONSchema.make() for Dynamic Form UI](#4-jsonschemamake-for-dynamic-form-ui)
5. [Round-Trip: Encode / Decode / Serialize](#5-round-trip-encode--decode--serialize)
6. [Error Formatting for User-Friendly Validation](#6-error-formatting-for-user-friendly-validation)
7. [Practical Code Generation Patterns](#7-practical-code-generation-patterns)
8. [Full PLG Config as a Single Effect Schema](#8-full-plg-config-as-a-single-effect-schema)
9. [End-to-End Pipeline: UI to Generated Code](#9-end-to-end-pipeline-ui-to-generated-code)
10. [Recommendations](#10-recommendations)

---

## 1. Effect Schema for Dynamic User Input Validation

### 1.1 The Problem

The PLG builder allows users to dynamically add and remove items: pricing plans, feature flags, events, survey questions. Each item has a structured shape with constraints. The builder must:

- Validate each item as the user adds it
- Validate the entire collection (e.g., "at least one plan required")
- Produce typed data that drives code generation

### 1.2 Schema.Struct for Individual Items

Each user-defined item maps to a `Schema.Struct`. For example, a pricing plan:

```typescript
import { Schema } from "effect"

const PlanConfig = Schema.Struct({
  // The constant key: "FREE", "PRO", "ENTERPRISE"
  key: Schema.String.pipe(
    Schema.pattern(/^[A-Z][A-Z0-9_]*$/),
    Schema.minLength(1),
    Schema.maxLength(30),
    Schema.annotations({
      message: () => "Key must be UPPER_SNAKE_CASE (e.g., PRO, ENTERPRISE)",
      title: "Constant Key",
      description: "Used as the object key in generated TypeScript constants",
      examples: ["FREE", "PRO", "ENTERPRISE"],
    })
  ),
  // The runtime value: "free", "pro", "enterprise"
  value: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.minLength(1),
    Schema.maxLength(30),
    Schema.annotations({
      message: () => "Value must be lowercase-kebab (e.g., free, pro)",
      title: "Plan Value",
      examples: ["free", "pro", "enterprise"],
    })
  ),
  // Display name shown in dashboards
  displayName: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(50),
    Schema.annotations({
      title: "Display Name",
      examples: ["Free", "Pro", "Enterprise"],
    })
  ),
  // Monthly price in cents (0 for free)
  priceCents: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({
      title: "Price (cents)",
      description: "Monthly price in cents. Use 0 for free tier.",
    })
  ),
})

type PlanConfig = typeof PlanConfig.Type
// { key: string; value: string; displayName: string; priceCents: number }
```

### 1.3 Schema.Array for Dynamic Lists

When users add/remove items, the collection is a `Schema.Array` with constraints:

```typescript
const PlansArray = Schema.Array(PlanConfig).pipe(
  Schema.minItems(1),
  Schema.annotations({
    message: () => "At least one pricing plan is required",
    title: "Pricing Plans",
  })
)
```

For cases where at least one item is always required, use `Schema.NonEmptyArray`:

```typescript
const PlansNonEmpty = Schema.NonEmptyArray(PlanConfig).annotations({
  title: "Pricing Plans",
  description: "At least one plan must be defined",
})
```

### 1.4 Branded Types for Domain Primitives

The key/value strings can be branded for additional type safety in the codegen pipeline:

```typescript
const ConstantKey = Schema.String.pipe(
  Schema.pattern(/^[A-Z][A-Z0-9_]*$/),
  Schema.brand("ConstantKey")
)
type ConstantKey = typeof ConstantKey.Type
// string & Brand<"ConstantKey">

const KebabValue = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.brand("KebabValue")
)
type KebabValue = typeof KebabValue.Type
// string & Brand<"KebabValue">
```

Once branded, these prevent accidental mixing. A `ConstantKey` cannot be passed where a `KebabValue` is expected, even though both are strings.

### 1.5 Validation at Add-Time

When a user clicks "Add Plan" in the UI, validate the individual item:

```typescript
import { Schema, Either, ParseResult } from "effect"

const validatePlan = Schema.decodeUnknownEither(PlanConfig)

function handleAddPlan(formData: unknown) {
  const result = validatePlan(formData)
  if (Either.isRight(result)) {
    // Valid plan, add to state
    dispatch({ type: "ADD_PLAN", plan: result.right })
  } else {
    // Invalid, show errors to user
    const errors = ParseResult.ArrayFormatter.formatErrorSync(result.left)
    // errors: Array<{ _tag: string; path: string[]; message: string }>
    showValidationErrors(errors)
  }
}
```

---

## 2. Tagged Unions for Discriminated User Input Types

### 2.1 The Problem

Feature flags are not uniform. A flag can be:
- **Boolean**: simple on/off toggle
- **Multivariate**: string variant with multiple options
- **Percentage**: gradual rollout by percentage

Each variant has different configuration fields. This is a discriminated union.

### 2.2 Schema.Union with Literal Discriminator

Effect Schema supports discriminated unions via `Schema.Union` with a `Schema.Literal` field as the discriminator:

```typescript
const BooleanFlag = Schema.Struct({
  _tag: Schema.Literal("boolean"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  active: Schema.Boolean,
})

const MultivariateFlag = Schema.Struct({
  _tag: Schema.Literal("multivariate"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  variants: Schema.NonEmptyArray(Schema.Struct({
    key: Schema.String.pipe(Schema.minLength(1)),
    rolloutPercentage: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(100)
    ),
  })),
})

const PercentageFlag = Schema.Struct({
  _tag: Schema.Literal("percentage"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  rolloutPercentage: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(100)
  ),
})

const FeatureFlagConfig = Schema.Union(
  BooleanFlag,
  MultivariateFlag,
  PercentageFlag,
)

type FeatureFlagConfig = typeof FeatureFlagConfig.Type
// { _tag: "boolean"; ... } | { _tag: "multivariate"; ... } | { _tag: "percentage"; ... }
```

### 2.3 Data.TaggedEnum for Runtime Constructors

For constructing flag configs programmatically (e.g., from presets), `Data.taggedEnum` provides named constructors:

```typescript
import { Data } from "effect"

type FeatureFlagInput = Data.TaggedEnum<{
  Boolean: { key: string; name: string; active: boolean }
  Multivariate: { key: string; name: string; variants: Array<{ key: string; rolloutPercentage: number }> }
  Percentage: { key: string; name: string; rolloutPercentage: number }
}>

const { Boolean, Multivariate, Percentage } = Data.taggedEnum<FeatureFlagInput>()

// Usage in presets:
const defaultFlags = [
  Boolean({ key: "dark-mode", name: "Dark Mode", active: true }),
  Percentage({ key: "beta-features", name: "Beta Features", rolloutPercentage: 10 }),
  Percentage({ key: "new-onboarding-flow", name: "New Onboarding", rolloutPercentage: 0 }),
]
```

### 2.4 Survey Questions as a Tagged Union

Survey questions also vary by type:

```typescript
const RatingQuestion = Schema.Struct({
  _tag: Schema.Literal("rating"),
  question: Schema.String.pipe(Schema.minLength(1)),
  scale: Schema.Literal(5, 10),
  lowerBoundLabel: Schema.optional(Schema.String),
  upperBoundLabel: Schema.optional(Schema.String),
})

const OpenTextQuestion = Schema.Struct({
  _tag: Schema.Literal("open"),
  question: Schema.String.pipe(Schema.minLength(1)),
  placeholder: Schema.optional(Schema.String),
})

const SingleChoiceQuestion = Schema.Struct({
  _tag: Schema.Literal("single_choice"),
  question: Schema.String.pipe(Schema.minLength(1)),
  choices: Schema.NonEmptyArray(Schema.String.pipe(Schema.minLength(1))),
})

const SurveyQuestion = Schema.Union(
  RatingQuestion,
  OpenTextQuestion,
  SingleChoiceQuestion,
)
```

### 2.5 Pattern Matching on Decoded Unions

After decoding, TypeScript's narrowing works on the `_tag` field:

```typescript
function generateQuestionCode(q: typeof SurveyQuestion.Type): string {
  switch (q._tag) {
    case "rating":
      return `{ type: "rating", question: "${q.question}", scale: ${q.scale} }`
    case "open":
      return `{ type: "open", question: "${q.question}" }`
    case "single_choice":
      return `{ type: "single_choice", question: "${q.question}", choices: [${q.choices.map(c => `"${c}"`).join(", ")}] }`
  }
}
```

---

## 3. Schema AST Introspection for Code Generation

### 3.1 Schema as a Typed AST Wrapper

Every `Schema.Schema<A, I, R>` is a typed wrapper around an AST value. The AST represents a subset of TypeScript's type system: products (structs, tuples), unions, and transformations. This AST is fully introspectable at runtime.

### 3.2 Accessing the AST

```typescript
import { Schema, SchemaAST } from "effect"

const MySchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
  active: Schema.Boolean,
})

const ast = MySchema.ast
// ast._tag === "TypeLiteral"
```

### 3.3 Walking TypeLiteral (Struct) Nodes

A `TypeLiteral` AST node has `propertySignatures` that can be iterated:

```typescript
function extractFieldNames(schema: Schema.Schema.Any): string[] {
  const ast = schema.ast
  if (ast._tag === "TypeLiteral") {
    return ast.propertySignatures.map((ps) => String(ps.name))
  }
  return []
}

extractFieldNames(MySchema)
// => ["name", "age", "active"]
```

### 3.4 Walking Union Nodes

A `Union` AST node has `types` that can be iterated:

```typescript
function extractUnionMembers(schema: Schema.Schema.Any): SchemaAST.AST[] {
  const ast = schema.ast
  if (ast._tag === "Union") {
    return ast.types
  }
  return []
}
```

### 3.5 Retrieving Annotations via SchemaAST.getAnnotation

Custom and built-in annotations are accessible via the AST:

```typescript
import { Option } from "effect"

// Define a custom annotation
const CodegenFieldId = Symbol.for("plg/codegen-field")

const AnnotatedSchema = Schema.Struct({
  name: Schema.String.annotations({
    title: "Display Name",
    description: "The user-facing name",
    [CodegenFieldId]: { tsType: "string", required: true },
  }),
})

// Retrieve it
const nameAst = AnnotatedSchema.ast
if (nameAst._tag === "TypeLiteral") {
  const nameProp = nameAst.propertySignatures[0]
  const title = SchemaAST.getAnnotation<string>(
    SchemaAST.TitleAnnotationId
  )(nameProp.type)
  // title: Option.Some("Display Name")

  const codegenMeta = SchemaAST.getAnnotation<{ tsType: string; required: boolean }>(
    CodegenFieldId
  )(nameProp.type)
  // codegenMeta: Option.Some({ tsType: "string", required: true })
}
```

### 3.6 Recursive AST Walker for Code Generation

A general-purpose walker can traverse the full AST tree:

```typescript
function walkAst(ast: SchemaAST.AST, depth: number = 0): void {
  const indent = "  ".repeat(depth)
  switch (ast._tag) {
    case "TypeLiteral":
      console.log(`${indent}Struct:`)
      for (const ps of ast.propertySignatures) {
        console.log(`${indent}  field "${String(ps.name)}" (optional: ${ps.isOptional}):`)
        walkAst(ps.type, depth + 2)
      }
      break
    case "Union":
      console.log(`${indent}Union:`)
      for (const member of ast.types) {
        walkAst(member, depth + 1)
      }
      break
    case "StringKeyword":
      console.log(`${indent}string`)
      break
    case "NumberKeyword":
      console.log(`${indent}number`)
      break
    case "BooleanKeyword":
      console.log(`${indent}boolean`)
      break
    case "Literal":
      console.log(`${indent}literal(${JSON.stringify(ast.literal)})`)
      break
    case "Refinement":
      console.log(`${indent}refinement:`)
      walkAst(ast.from, depth + 1)
      break
    case "TupleType":
      console.log(`${indent}tuple/array`)
      break
    case "Transformation":
      console.log(`${indent}transform:`)
      walkAst(ast.from, depth + 1)
      break
    default:
      console.log(`${indent}${ast._tag}`)
  }
}
```

### 3.7 effect-schema-compiler Library

The community library [effect-schema-compiler](https://github.com/AMar4enko/effect-schema-compiler) provides a higher-level rule-based compiler for Schema AST traversal:

```typescript
import { Compiler } from "effect-schema-compiler"

const codegenCompiler = Compiler.make<string, { indent: number }>()
  .rule(
    (ast) => ast._tag === "TypeLiteral",
    ({ propertySignatures }, go, ctx) => {
      const fields = propertySignatures.map(ps =>
        `${" ".repeat(ctx.indent)}${String(ps.name)}: ${go(ps.type, { indent: ctx.indent + 2 })}`
      )
      return `{\n${fields.join(",\n")}\n${" ".repeat(ctx.indent - 2)}}`
    }
  )
  .rule(
    (ast) => ast._tag === "StringKeyword",
    () => "string"
  )
```

This is useful if the codegen logic becomes complex enough to warrant a rule-based approach rather than manual `switch` statements.

---

## 4. JSONSchema.make() for Dynamic Form UI

### 4.1 Converting Effect Schema to JSON Schema

`JSONSchema.make` converts an Effect Schema to a standard JSON Schema (draft-07). This enables bridging to form generation libraries.

```typescript
import { JSONSchema, Schema } from "effect"

const PlanConfig = Schema.Struct({
  key: Schema.String.pipe(
    Schema.pattern(/^[A-Z][A-Z0-9_]*$/),
    Schema.annotations({ title: "Constant Key", description: "UPPER_SNAKE_CASE key" })
  ),
  value: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.annotations({ title: "Plan Value", description: "lowercase-kebab value" })
  ),
  displayName: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ title: "Display Name" })
  ),
  priceCents: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({ title: "Price (cents)", description: "Monthly price in cents" })
  ),
})

const jsonSchema = JSONSchema.make(PlanConfig)
```

**Output:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["key", "value", "displayName", "priceCents"],
  "properties": {
    "key": {
      "type": "string",
      "pattern": "^[A-Z][A-Z0-9_]*$",
      "title": "Constant Key",
      "description": "UPPER_SNAKE_CASE key"
    },
    "value": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "title": "Plan Value",
      "description": "lowercase-kebab value"
    },
    "displayName": {
      "type": "string",
      "minLength": 1,
      "title": "Display Name"
    },
    "priceCents": {
      "type": "integer",
      "minimum": 0,
      "title": "Price (cents)",
      "description": "Monthly price in cents"
    }
  },
  "additionalProperties": false
}
```

### 4.2 Driving react-jsonschema-form (RJSF)

The JSON Schema output can be passed directly to [react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form):

```tsx
import Form from "@rjsf/core"
import { JSONSchema, Schema } from "effect"

const planJsonSchema = JSONSchema.make(PlanConfig)

function PlanForm({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  return (
    <Form
      schema={planJsonSchema}
      uiSchema={{
        key: { "ui:help": "e.g., PRO, ENTERPRISE" },
        value: { "ui:help": "e.g., pro, enterprise" },
        priceCents: { "ui:widget": "updown" },
      }}
      onSubmit={({ formData }) => onSubmit(formData)}
    />
  )
}
```

### 4.3 Using JSON Forms (jsonforms.io)

Alternatively, [JSON Forms](https://jsonforms.io/) can render the schema:

```tsx
import { JsonForms } from "@jsonforms/react"
import { materialRenderers, materialCells } from "@jsonforms/material-renderers"

function PlanForm({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  const [data, setData] = useState({})
  return (
    <JsonForms
      schema={planJsonSchema}
      data={data}
      renderers={materialRenderers}
      cells={materialCells}
      onChange={({ data }) => setData(data)}
    />
  )
}
```

### 4.4 Workflow: Single Source of Truth

```
Effect Schema (PlanConfig)
    |
    +-- JSONSchema.make() --> JSON Schema --> RJSF / JSON Forms (UI rendering)
    |
    +-- Schema.decodeUnknown() --> Validated PlanConfig (codegen input)
    |
    +-- Schema.encode() --> JSON (storage/transport)
```

The Effect Schema is the single source of truth. From it, you derive:
1. JSON Schema for dynamic form rendering
2. Runtime validation for user input
3. Serialization/deserialization for persistence
4. TypeScript types for code generation functions

### 4.5 Limitations

- `JSONSchema.make` produces the **input** (encoded) side of the schema. Transformations (e.g., `clamp`, `NumberFromString`) are not represented in the JSON Schema output -- only refinements (patterns, min/max, etc.) are included.
- JSON Schema does not support branded types. The branding is lost in the JSON Schema representation. Validation is handled by Effect Schema on the decode path.
- There is no built-in `JSONSchema.deserialize` to convert a JSON Schema back to an Effect Schema (this was explicitly marked "out of scope" by the Effect team in [Issue #1825](https://github.com/Effect-TS/effect/issues/1825)).

---

## 5. Round-Trip: Encode / Decode / Serialize

### 5.1 The PLG Builder Persistence Flow

The PLG builder must persist user configurations across sessions. The flow:

```
User interacts with UI
    |
    v
Form data (unknown) --Schema.decodeUnknown()--> PlgBuilderConfig (typed)
    |
    v
PlgBuilderConfig --Schema.encode()--> JSON-safe object --JSON.stringify()--> string
    |
    v
Store in localStorage / database / URL params
    |
    v
Load from storage --JSON.parse()--> unknown --Schema.decodeUnknown()--> PlgBuilderConfig
    |
    v
Pass to code generators
```

### 5.2 Schema.encode and Schema.decode

```typescript
import { Schema, Effect } from "effect"

const PlgBuilderConfig = Schema.Struct({
  plans: Schema.Array(PlanConfig),
  events: Schema.Array(EventConfig),
  featureFlags: Schema.Array(FeatureFlagConfig),
  // ... other fields
})

// Decode: unknown -> PlgBuilderConfig (validates)
const decode = Schema.decodeUnknownSync(PlgBuilderConfig)

// Encode: PlgBuilderConfig -> JSON-safe object
const encode = Schema.encodeSync(PlgBuilderConfig)

// Round-trip
const config = decode(rawFormData)        // validates + types
const serialized = JSON.stringify(encode(config))  // safe JSON string
const restored = decode(JSON.parse(serialized))    // back to typed config
```

### 5.3 Schema.parseJson for One-Step JSON Round-Trip

For direct JSON string handling, `Schema.parseJson` combines `JSON.parse`/`JSON.stringify` with schema validation:

```typescript
const PlgConfigFromJson = Schema.parseJson(PlgBuilderConfig)

// Decode from JSON string directly
const config = Schema.decodeUnknownSync(PlgConfigFromJson)(jsonString)
// config is fully typed PlgBuilderConfig

// Encode back to JSON string
const jsonString2 = Schema.encodeSync(PlgConfigFromJson)(config)
// jsonString2 is a valid JSON string
```

### 5.4 Round-Trip Guarantee

Effect Schema enforces a key invariant: encoding a decoded value and decoding it again must produce the same value. This is critical for the PLG builder where configs are persisted and restored:

```typescript
// This must always hold:
const original = decode(input)
const roundTripped = decode(JSON.parse(JSON.stringify(encode(original))))
// roundTripped deep-equals original
```

### 5.5 URL Query String Encoding

For shareable builder URLs, encode the config to a URL-safe format:

```typescript
function configToUrl(config: typeof PlgBuilderConfig.Type): string {
  const encoded = Schema.encodeSync(PlgBuilderConfig)(config)
  const compressed = btoa(JSON.stringify(encoded))
  return `https://plg-stack.dev/new?config=${compressed}`
}

function urlToConfig(url: string): typeof PlgBuilderConfig.Type {
  const params = new URL(url).searchParams
  const raw = JSON.parse(atob(params.get("config")!))
  return Schema.decodeUnknownSync(PlgBuilderConfig)(raw)
}
```

---

## 6. Error Formatting for User-Friendly Validation

### 6.1 TreeFormatter (Default -- Debugging)

`TreeFormatter` produces a hierarchical tree of errors, useful for development:

```typescript
import { Schema, Either, ParseResult } from "effect"

const result = Schema.decodeUnknownEither(PlgBuilderConfig, { errors: "all" })({
  plans: [{ key: "bad key!", value: "", priceCents: -100 }],
  events: [],
})

if (Either.isLeft(result)) {
  console.error(ParseResult.TreeFormatter.formatErrorSync(result.left))
}
```

**Output (approximate):**
```
{ plans: ...; events: ... }
├── ["plans"]
│   └── [0]
│       ├── ["key"]
│       │   └── Key must be UPPER_SNAKE_CASE (e.g., PRO, ENTERPRISE)
│       ├── ["value"]
│       │   └── Value must be lowercase-kebab (e.g., free, pro)
│       └── ["priceCents"]
│           └── Expected >= 0, actual -100
└── ["events"]
    └── is missing
```

### 6.2 ArrayFormatter (Production -- UI Integration)

`ArrayFormatter` produces a flat array of error objects, ideal for mapping to form field errors:

```typescript
if (Either.isLeft(result)) {
  const errors = ParseResult.ArrayFormatter.formatErrorSync(result.left)
  // [
  //   { _tag: "Type", path: ["plans", 0, "key"], message: "Key must be UPPER_SNAKE_CASE ..." },
  //   { _tag: "Type", path: ["plans", 0, "value"], message: "Value must be lowercase-kebab ..." },
  //   { _tag: "Type", path: ["plans", 0, "priceCents"], message: "Expected >= 0, actual -100" },
  //   { _tag: "Missing", path: ["events"], message: "is missing" },
  // ]
}
```

### 6.3 Mapping ArrayFormatter Errors to Form Fields

```typescript
type FormErrors = Record<string, string>

function toFormErrors(parseError: ParseResult.ParseError): FormErrors {
  const errors = ParseResult.ArrayFormatter.formatErrorSync(parseError)
  const formErrors: FormErrors = {}
  for (const err of errors) {
    const fieldPath = err.path.join(".")
    // Keep only the first error per field
    if (!formErrors[fieldPath]) {
      formErrors[fieldPath] = err.message
    }
  }
  return formErrors
}

// Usage:
// { "plans.0.key": "Key must be UPPER_SNAKE_CASE ...", "plans.0.value": "..." }
```

### 6.4 Getting All Errors

By default, `Schema.decodeUnknownEither` stops at the first error. Pass `{ errors: "all" }` to collect all errors:

```typescript
const decode = Schema.decodeUnknownEither(PlanConfig, { errors: "all" })
```

### 6.5 Custom Error Messages via Annotations

Set the `message` annotation on any schema or filter to control what users see:

```typescript
const PriceCents = Schema.Number.pipe(
  Schema.int({ message: () => "Price must be a whole number" }),
  Schema.greaterThanOrEqualTo(0, {
    message: () => "Price cannot be negative",
  }),
  Schema.lessThanOrEqualTo(100_000_00, {
    message: () => "Price cannot exceed $100,000.00",
  }),
)
```

Each refinement in the pipe chain can have its own error message. The first failing refinement's message is reported.

### 6.6 React Hook Form Integration

The `@hookform/resolvers` package provides an adapter for `effect/Schema`, allowing direct use with React Hook Form:

```typescript
import { useForm } from "react-hook-form"
import { effectTsResolver } from "@hookform/resolvers/effect-ts"

function PlanForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: effectTsResolver(PlanConfig),
  })
  // errors.key?.message, errors.value?.message, etc.
}
```

---

## 7. Practical Code Generation Patterns

### 7.1 The Core Pattern: Schema Data to String Output

Code generation is a pure function: validated config in, TypeScript source string out.

```typescript
function generateConstantsFile(
  name: string,
  typeName: string,
  items: ReadonlyArray<{ key: string; value: string }>,
): string {
  const entries = items.map((item) => `  ${item.key}: "${item.value}",`).join("\n")

  return [
    `export const ${name} = {`,
    entries,
    `} as const;`,
    ``,
    `export type ${typeName} = (typeof ${name})[keyof typeof ${name}];`,
    ``,
  ].join("\n")
}

// Usage:
generateConstantsFile("Plans", "PlanType", [
  { key: "FREE", value: "free" },
  { key: "PRO", value: "pro" },
  { key: "ENTERPRISE", value: "enterprise" },
])
```

**Output:**
```typescript
export const Plans = {
  FREE: "free",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

export type PlanType = (typeof Plans)[keyof typeof Plans];
```

### 7.2 Generating Feature Flag Constants

```typescript
function generateFeatureFlagsFile(
  flags: ReadonlyArray<typeof FeatureFlagConfig.Type>,
): string {
  const entries = flags
    .map((flag) => {
      const constKey = flag.key.toUpperCase().replace(/-/g, "_")
      return `  ${constKey}: "${flag.key}",`
    })
    .join("\n")

  return [
    `export const FeatureFlags = {`,
    entries,
    `} as const;`,
    ``,
    `export type FeatureFlagKey = (typeof FeatureFlags)[keyof typeof FeatureFlags];`,
    ``,
  ].join("\n")
}
```

### 7.3 Generating EventPayloads Interface

The complex case -- an interface with computed property keys:

```typescript
interface EventPayloadField {
  name: string
  type: string
  optional: boolean
}

interface EventConfigForCodegen {
  key: string
  value: string
  payloadFields: EventPayloadField[]
}

function generateEventsFile(events: EventConfigForCodegen[]): string {
  // Constants object
  const constEntries = events
    .map((e) => `  ${e.key}: "${e.value}",`)
    .join("\n")

  // Payload interface entries
  const payloadEntries = events
    .map((e) => {
      if (e.payloadFields.length === 0) {
        return `  [Events.${e.key}]: {};`
      }
      const fields = e.payloadFields
        .map((f) => `    ${f.name}${f.optional ? "?" : ""}: ${f.type};`)
        .join("\n")
      return `  [Events.${e.key}]: {\n${fields}\n  };`
    })
    .join("\n")

  return [
    `export const Events = {`,
    constEntries,
    `} as const;`,
    ``,
    `export type EventName = (typeof Events)[keyof typeof Events];`,
    ``,
    `export interface EventPayloads {`,
    payloadEntries,
    `}`,
    ``,
  ].join("\n")
}
```

### 7.4 Generating IaC Resource Classes

```typescript
function generateFeatureFlagResource(
  flag: typeof FeatureFlagConfig.Type,
): string {
  const className = toPascalCase(flag.name) + "Flag"
  const constKey = flag.key.toUpperCase().replace(/-/g, "_")

  switch (flag._tag) {
    case "boolean":
      return [
        `export class ${className} extends FeatureFlag("${className}", {`,
        `  key: FeatureFlags.${constKey},`,
        `  name: "${flag.name}",`,
        `  active: ${flag.active},`,
        `  rolloutPercentage: 100,`,
        `}) {}`,
      ].join("\n")

    case "percentage":
      return [
        `export class ${className} extends FeatureFlag("${className}", {`,
        `  key: FeatureFlags.${constKey},`,
        `  name: "${flag.name}",`,
        `  active: true,`,
        `  rolloutPercentage: ${flag.rolloutPercentage},`,
        `}) {}`,
      ].join("\n")

    case "multivariate":
      const variants = flag.variants
        .map((v) => `    { key: "${v.key}", rollout_percentage: ${v.rolloutPercentage} },`)
        .join("\n")
      return [
        `export class ${className} extends FeatureFlag("${className}", {`,
        `  key: FeatureFlags.${constKey},`,
        `  name: "${flag.name}",`,
        `  active: true,`,
        `  multivariate: {`,
        `    variants: [`,
        variants,
        `    ],`,
        `  },`,
        `}) {}`,
      ].join("\n")
  }
}
```

### 7.5 Generating Effect Schema Code (When Runtime Validation is Needed)

If the generated package needs runtime validation (e.g., webhook payload validation), generate Effect Schema source code:

```typescript
function generateEventSchemaFile(events: ReadonlyArray<{ value: string }>): string {
  const literals = events.map((e) => `  "${e.value}",`).join("\n")

  return [
    `import { Schema } from "effect";`,
    ``,
    `export const EventName = Schema.Literal(`,
    literals,
    `);`,
    `export type EventName = typeof EventName.Type;`,
    ``,
  ].join("\n")
}
```

### 7.6 Post-Processing: Format with Prettier/Biome

All generated code should be formatted to eliminate whitespace inconsistencies:

```typescript
import { format } from "prettier"

async function generateAndFormat(config: typeof PlgBuilderConfig.Type): Promise<Map<string, string>> {
  const files = new Map<string, string>()

  files.set("events.ts", generateEventsFile(config.events))
  files.set("plans.ts", generateConstantsFile("Plans", "PlanType", config.plans))
  files.set("feature-flags.ts", generateFeatureFlagsFile(config.featureFlags))
  // ... other files

  // Format all generated files
  for (const [path, content] of files) {
    files.set(path, await format(content, { parser: "typescript" }))
  }

  return files
}
```

---

## 8. Full PLG Config as a Single Effect Schema

### 8.1 Complete Schema Definition

The entire PLG builder configuration as a single, nested Effect Schema:

```typescript
import { Schema } from "effect"

// --- Reusable field schemas ---

const ConstantKey = Schema.String.pipe(
  Schema.pattern(/^[A-Z][A-Z0-9_]*$/),
  Schema.annotations({ message: () => "Must be UPPER_SNAKE_CASE" }),
)

const KebabValue = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.annotations({ message: () => "Must be lowercase-kebab-case" }),
)

const Percentage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
)

// --- Item configs ---

const PlanConfig = Schema.Struct({
  key: ConstantKey,
  value: KebabValue,
  displayName: Schema.String.pipe(Schema.minLength(1)),
  priceCents: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
})

const BillingIntervalConfig = Schema.Struct({
  key: ConstantKey,
  value: KebabValue,
})

const EventCategory = Schema.Literal(
  "acquisition", "activation", "engagement",
  "monetization", "churn", "referral", "usage",
)

const EventPayloadFieldConfig = Schema.Struct({
  name: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]*$/)),
  type: Schema.Literal("string", "number", "boolean"),
  optional: Schema.Boolean,
})

const EventConfig = Schema.Struct({
  key: ConstantKey,
  value: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]*$/)),
  category: EventCategory,
  payloadFields: Schema.Array(EventPayloadFieldConfig),
})

const BooleanFlagConfig = Schema.Struct({
  _tag: Schema.Literal("boolean"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  active: Schema.Boolean,
})

const PercentageFlagConfig = Schema.Struct({
  _tag: Schema.Literal("percentage"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  rolloutPercentage: Percentage,
})

const MultivariateFlagConfig = Schema.Struct({
  _tag: Schema.Literal("multivariate"),
  key: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  variants: Schema.NonEmptyArray(Schema.Struct({
    key: Schema.String.pipe(Schema.minLength(1)),
    rolloutPercentage: Percentage,
  })),
})

const FeatureFlagConfig = Schema.Union(
  BooleanFlagConfig,
  PercentageFlagConfig,
  MultivariateFlagConfig,
)

const SurveyQuestionConfig = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("rating"),
    question: Schema.String.pipe(Schema.minLength(1)),
    scale: Schema.Literal(5, 10),
  }),
  Schema.Struct({
    _tag: Schema.Literal("open"),
    question: Schema.String.pipe(Schema.minLength(1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal("single_choice"),
    question: Schema.String.pipe(Schema.minLength(1)),
    choices: Schema.NonEmptyArray(Schema.String.pipe(Schema.minLength(1))),
  }),
)

const SurveyConfig = Schema.Struct({
  key: ConstantKey,
  value: KebabValue,
  name: Schema.String.pipe(Schema.minLength(1)),
  type: Schema.Literal("popover", "api"),
  questions: Schema.NonEmptyArray(SurveyQuestionConfig),
})

const CrmAttributeConfig = Schema.Struct({
  key: ConstantKey,
  value: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]*$/)),
  target: Schema.Literal("companies", "people", "deals"),
  type: Schema.Literal("select", "number", "date", "checkbox", "status"),
  displayName: Schema.String.pipe(Schema.minLength(1)),
})

const CrmSelectOptionConfig = Schema.Struct({
  key: ConstantKey,
  value: Schema.String.pipe(Schema.minLength(1)),
  attributeSlug: Schema.String,
})

// --- Provider selections ---

const AnalyticsProvider = Schema.Literal("posthog", "amplitude", "mixpanel", "segment", "none")
const FeatureFlagProvider = Schema.Literal("posthog", "launchdarkly", "statsig", "growthbook", "none")
const ExperimentProvider = Schema.Literal("posthog", "statsig", "amplitude", "growthbook", "none")
const SurveyProvider = Schema.Literal("posthog", "typeform", "formbricks", "none")
const CrmProvider = Schema.Literal("attio", "hubspot", "salesforce", "none")
const PricingModel = Schema.Literal("free", "freemium", "free_trial", "usage_based", "seat_based", "custom")
const IacProvider = Schema.Literal("alchemy", "terraform", "pulumi", "none")
const Distribution = Schema.Literal("shadcn", "npm", "monorepo")

// --- Top-level config ---

export const PlgBuilderConfig = Schema.Struct({
  // Provider selections
  analyticsProvider: AnalyticsProvider,
  featureFlagProvider: FeatureFlagProvider,
  experimentProvider: ExperimentProvider,
  surveyProvider: SurveyProvider,
  crmProvider: CrmProvider,
  pricingModel: PricingModel,
  iacProvider: IacProvider,
  distribution: Distribution,

  // Dynamic user-defined lists
  plans: Schema.Array(PlanConfig),
  billingIntervals: Schema.Array(BillingIntervalConfig),
  events: Schema.Array(EventConfig),
  featureFlags: Schema.Array(FeatureFlagConfig),
  surveys: Schema.Array(SurveyConfig),
  crmAttributes: Schema.Array(CrmAttributeConfig),
  crmSelectOptions: Schema.Array(CrmSelectOptionConfig),

  // Pricing-model-specific fields
  trialDays: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(90))),
  usageMetric: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  seatThresholds: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))),
}).annotations({
  title: "PLG Builder Configuration",
  description: "Complete configuration for generating a PLG stack from user selections",
})

export type PlgBuilderConfig = typeof PlgBuilderConfig.Type
```

### 8.2 JSON Schema from the Full Config

```typescript
const fullJsonSchema = JSONSchema.make(PlgBuilderConfig)
// Produces a complete JSON Schema with all nested objects, arrays, unions, and constraints
// This can be used to generate a comprehensive form or validate external input
```

### 8.3 Partial Validation During Builder Steps

The builder UI is a multi-step wizard. Each step validates only its relevant portion:

```typescript
// Step 1: Provider selections only
const ProviderSelections = Schema.Struct({
  analyticsProvider: AnalyticsProvider,
  featureFlagProvider: FeatureFlagProvider,
  experimentProvider: ExperimentProvider,
  surveyProvider: SurveyProvider,
  crmProvider: CrmProvider,
})

// Step 2: Pricing model + plans
const PricingStep = Schema.Struct({
  pricingModel: PricingModel,
  plans: Schema.Array(PlanConfig),
  billingIntervals: Schema.Array(BillingIntervalConfig),
  trialDays: Schema.optional(Schema.Number),
})

// Step 3: Events
const EventsStep = Schema.Struct({
  events: Schema.NonEmptyArray(EventConfig),
})

// Validate per-step
const validateStep1 = Schema.decodeUnknownEither(ProviderSelections)
const validateStep2 = Schema.decodeUnknownEither(PricingStep)
```

---

## 9. End-to-End Pipeline: UI to Generated Code

### 9.1 Full Pipeline

```
Step 1: User interacts with builder UI
    - Selects providers (PostHog, Attio, etc.)
    - Adds/removes plans, events, flags, surveys
    - Each add/edit validates with Schema.decodeUnknownEither(ItemConfig)
    - Errors shown via ArrayFormatter -> form field mapping

Step 2: Complete config assembled
    - All steps merged into PlgBuilderConfig
    - Full validation: Schema.decodeUnknownSync(PlgBuilderConfig)(mergedData)

Step 3: Config persisted
    - Schema.encodeSync(PlgBuilderConfig)(validConfig) -> JSON
    - Stored in localStorage, database, or URL params

Step 4: Config restored (on page reload or share)
    - JSON.parse(stored) -> Schema.decodeUnknownSync(PlgBuilderConfig) -> typed config

Step 5: Code generation
    - generateEventsFile(config.events) -> events.ts
    - generatePlansFile(config.plans) -> plans.ts
    - generateFeatureFlagsFile(config.featureFlags) -> feature-flags.ts
    - generateSurveysFile(config.surveys) -> surveys.ts
    - generateAttioFile(config.crmAttributes) -> attio.ts
    - generateIacStackFile(config) -> plg-stack.run.ts
    - generateBarrelFile(config) -> index.ts

Step 6: Output packaging
    - If distribution = "shadcn": wrap files in registry-item JSON
    - If distribution = "npm": generate package.json + files
    - If distribution = "monorepo": write directly to packages/plg/src/

Step 7: Format with Prettier/Biome
    - All generated .ts files formatted for consistency
```

### 9.2 Code Example: Full Pipeline Function

```typescript
import { Schema, Either, ParseResult, Effect } from "effect"

interface GeneratedOutput {
  files: Map<string, string>
  shadcnCommand?: string
  errors?: Array<{ path: string[]; message: string }>
}

function generatePlgStack(rawConfig: unknown): GeneratedOutput {
  // Step 1: Validate
  const result = Schema.decodeUnknownEither(PlgBuilderConfig, { errors: "all" })(rawConfig)

  if (Either.isLeft(result)) {
    return {
      files: new Map(),
      errors: ParseResult.ArrayFormatter.formatErrorSync(result.left),
    }
  }

  const config = result.right
  const files = new Map<string, string>()

  // Step 2: Generate constants
  files.set("events.ts", generateEventsFile(config.events))

  if (config.pricingModel !== "free") {
    files.set("plans.ts", generatePlansFile(config.plans, config.billingIntervals))
  }

  if (config.featureFlagProvider !== "none") {
    files.set("feature-flags.ts", generateFeatureFlagsFile(config.featureFlags))
  }

  if (config.surveyProvider !== "none") {
    files.set("surveys.ts", generateSurveysFile(config.surveys))
  }

  if (config.crmProvider !== "none") {
    files.set("attio.ts", generateCrmFile(config.crmAttributes, config.crmSelectOptions))
  }

  // Step 3: Generate SDK
  if (config.analyticsProvider !== "none") {
    files.set("sdk/track.ts", generateTrackFile(config))
    files.set("sdk/identify.ts", generateIdentifyFile(config))
  }

  // Step 4: Generate IaC
  if (config.iacProvider !== "none") {
    files.set("plg-stack.run.ts", generateIacStackFile(config))
  }

  // Step 5: Generate barrel
  files.set("index.ts", generateBarrelFile(config, files))

  return { files }
}
```

---

## 10. Recommendations

### 10.1 Use Effect Schema for Config Validation, Not for Generated Code

The PLG builder's **config** (what the user inputs) should be an Effect Schema. The **output** (generated TypeScript files) should be plain `as const` objects and type aliases, matching the existing codebase pattern. Do not generate Effect Schema code in the output unless runtime validation of the generated types is specifically needed (e.g., webhook payload validation).

### 10.2 Use String Interpolation for Code Generation

String interpolation (template literals) is the right choice for generating `as const` objects and class declarations. ts-morph is overkill. Handlebars adds a dependency for no benefit. Format with Prettier/Biome after generation.

### 10.3 Use JSONSchema.make for Dynamic Form Rendering

Convert the config schema to JSON Schema and use react-jsonschema-form or JSON Forms for rendering add/edit forms dynamically. This avoids manually building form components for each config type.

### 10.4 Use ArrayFormatter for UI Error Display

Use `ParseResult.ArrayFormatter.formatErrorSync` with `{ errors: "all" }` to produce a flat array of errors that can be mapped to form fields. Use the `message` annotation on every refinement to provide user-friendly error messages.

### 10.5 Use Schema.encode/decode for Persistence

Use `Schema.encodeSync` and `Schema.decodeUnknownSync` for serializing configs to JSON and restoring them. This ensures round-trip fidelity and catches schema drift if the config format evolves.

### 10.6 Use Discriminated Unions for Polymorphic Config Items

Feature flags, survey questions, and other items that come in multiple variants should use `Schema.Union` with a `_tag` literal discriminator. This gives exhaustive pattern matching in the code generators.

### 10.7 Consider Schema AST Introspection for Metadata Extraction

For advanced use cases (e.g., auto-generating documentation, producing form labels from schema titles, or validating that generator functions handle all fields), AST introspection via `schema.ast` is available. For most PLG builder use cases, direct code generation from the typed config values is simpler and sufficient.

---

## Sources

- [Effect Schema Introduction](https://effect.website/docs/schema/introduction/)
- [Effect Schema Basic Usage](https://effect.website/docs/schema/basic-usage/)
- [Effect Schema Annotations](https://effect.website/docs/schema/annotations/)
- [Effect Schema Advanced Usage](https://effect.website/docs/schema/advanced-usage/)
- [Effect Schema Error Formatters](https://effect.website/docs/schema/error-formatters/)
- [Effect Schema Error Messages](https://effect.website/docs/schema/error-messages/)
- [Effect Schema to JSON Schema](https://effect.website/docs/schema/json-schema/)
- [Effect Data Types (Data.TaggedEnum)](https://effect.website/docs/data-types/data/)
- [react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form)
- [JSON Forms](https://jsonforms.io/)
- [effect-schema-compiler](https://github.com/AMar4enko/effect-schema-compiler)
- [RFC: Structured Error Formatter](https://github.com/Effect-TS/effect/issues/4572)
- [JSON Schema to Schema converter (Out of Scope)](https://github.com/Effect-TS/effect/issues/1825)
- [Schema.TaggedUnion PR](https://github.com/Effect-TS/effect/pull/4736)
