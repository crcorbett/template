# Research: Code Generation Patterns for PLG Stack Builder

## 1. Code Generation Approaches: AST vs Template vs String

### 1.1 Template-Copying (create-t3-app)

create-t3-app uses a **template-copying** approach. It maintains pre-written template files organized by package/technology in a `template/` directory with `base/` and `extras/` subdirectories. The CLI's installer system selectively copies the relevant files into the generated project based on user selections, while dynamically composing `package.json` with appropriate dependencies.

**Architecture:**
- User selections are captured into a `CliResults` object containing `packages`, `flags`, and `databaseProvider`
- A `PkgInstallerMap` is built via `buildPkgInstallerMap()`, mapping each package to an `{ inUse: boolean, installer: Function }` entry
- Each installer module (e.g., `nextAuthInstaller`, `prismaInstaller`) receives `InstallerOptions` and:
  - Adds dependencies via `addPackageDependency()`
  - Copies template files from `template/extras/` via `fs.copySync()`
  - Modifies file content based on other selected packages
  - Adds scripts via `addPackageScript()`
- A `selectAppFile()` helper picks the correct boilerplate variant based on which packages are active

**Strengths:** Simple to understand, easy to audit generated code, no runtime AST overhead.
**Weaknesses:** Combinatorial explosion of template variants as options grow; duplication across templates.

Sources:
- [create-t3-app GitHub](https://github.com/t3-oss/create-t3-app)
- [DeepWiki: create-t3-app](https://deepwiki.com/t3-oss/create-t3-app/1-overview)

### 1.2 Handlebars Templating (create-better-t-stack)

create-better-t-stack uses **Handlebars templates** with conditional blocks. User CLI choices are mapped to a `ProjectConfig` object, which is passed as context to template processing functions.

**Architecture:**
- Templates live in an `apps/cli/templates/` directory with `.hbs` extension
- Conditional blocks like `{{#if (eq api "orpc")}}` and `{{#if (eq backend "convex")}}` include/exclude code based on `ProjectConfig`
- `processAndCopyFiles()` and `processTemplate()` functions copy templates to the target directory and apply Handlebars processing
- `generateReproducibleCommand()` reconstructs the CLI command from `ProjectConfig`, showing the direct mapping between config and flags

**Strengths:** Handles conditional code inclusion cleanly; logic-less templates enforce separation of concerns; Handlebars helpers enable custom logic.
**Weaknesses:** Requires learning Handlebars syntax; templates can become hard to read with heavy conditionals; limited TypeScript type safety within templates.

Sources:
- [create-better-t-stack GitHub](https://github.com/AmanVarshney01/create-better-t-stack)

### 1.3 AST-Based Generation (ts-morph)

ts-morph wraps the TypeScript compiler API for programmatic code generation and manipulation. It provides an object-oriented API for creating, navigating, and modifying TypeScript ASTs.

**Key capabilities:**
- Create source files programmatically: `project.createSourceFile("file.ts", ...)`
- Add declarations: `sourceFile.addClass()`, `sourceFile.addVariableStatement()`, `sourceFile.addExportDeclaration()`
- Navigate: `.getClasses()`, `.getClass('MyClass')`, `.getModules()`
- **Structures API** for bulk generation: "You can get a huge performance improvement by working with structures as much as possible. This is especially useful if you are code generating."
- All changes are in-memory until `.save()` is called

**Strengths:** Guaranteed syntactically valid TypeScript output; can express any TypeScript construct; good for complex code with interdependencies; refactoring support.
**Weaknesses:** Heavier dependency; steeper learning curve; slower than string concatenation for simple cases; overkill for generating `const X = { ... } as const` patterns.

Sources:
- [ts-morph documentation](https://ts-morph.com/)
- [ts-morph npm](https://www.npmjs.com/package/ts-morph)
- [AST-based refactoring with ts-morph](https://kimmo.blog/posts/8-ast-based-refactoring-with-ts-morph/)

### 1.4 shadcn Registry JSON Distribution

shadcn's registry system defines code as flat JSON files conforming to a schema, distributed via CLI. This is a **code-as-data** approach.

**Registry item schema:**
```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "my-component",
  "type": "registry:component",
  "title": "My Component",
  "description": "...",
  "dependencies": ["package-name@version"],
  "registryDependencies": ["button", "@acme/input-form"],
  "files": [{ "path": "src/components/my-component.tsx", "type": "registry:component" }],
  "cssVars": { "light": {}, "dark": {} },
  "envVars": [{ "key": "API_KEY", "value": "..." }]
}
```

**Key design decisions:**
- Items are flat (no nesting); each item is a standalone JSON file
- Files include actual source code in a `content` field when built
- `registryDependencies` enable composability (items can depend on other items)
- `type` discriminated union enables different file handling: `registry:component`, `registry:hook`, `registry:page`, `registry:file`, `registry:style`
- CLI adapts installed code to local project styles/aliases on install

**Strengths:** Composable; framework-agnostic distribution; CLI handles adaptation to local project; supports MCP for AI-assisted code generation.
**Weaknesses:** Requires a build step to generate JSON; files must be pre-authored (not dynamically generated from config).

Sources:
- [shadcn registry docs](https://ui.shadcn.com/docs/registry)
- [shadcn registry-item.json schema](https://ui.shadcn.com/docs/registry/registry-item-json)
- [shadcn registry.json schema](https://ui.shadcn.com/docs/registry/registry-json)
- [shadcn CLI docs](https://ui.shadcn.com/docs/cli)

### 1.5 String Interpolation (ES6 Template Literals)

The simplest approach: build code strings directly using backtick templates.

```typescript
const generateEvents = (events: { key: string; value: string }[]) => `
export const Events = {
${events.map(e => `  ${e.key}: "${e.value}",`).join("\n")}
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
`;
```

**Strengths:** Zero dependencies; fastest to implement; easy to understand; TypeScript-native.
**Weaknesses:** No syntax validation; whitespace/formatting issues; hard to maintain for complex structures; no refactoring support.

### 1.6 Comparison Matrix

| Approach | Complexity | Type Safety | Dependencies | Best For |
|----------|-----------|-------------|--------------|----------|
| Template-copying (t3) | Low | None | fs-extra | Fixed file variants |
| Handlebars | Medium | None | handlebars | Conditional HTML/text |
| ts-morph (AST) | High | Full | ts-morph (~large) | Complex TS with interdeps |
| shadcn registry JSON | Medium | Schema-validated | shadcn CLI | Distributable components |
| String interpolation | Very low | None | None | Simple `as const` objects |

---

## 2. How User Selections Map to Generated Constants

### 2.1 Current Constants Structure

The existing `@packages/plg` package defines constants using a consistent pattern:

```
packages/plg/src/
  events.ts          - Events const object + EventName type + EventPayloads interface
  feature-flags.ts   - FeatureFlags const object + FeatureFlagKey type
  plans.ts           - Plans const object + PlanType type + BillingIntervals + BillingInterval type
  surveys.ts         - Surveys const object + SurveyId type
  attio.ts           - AttioAttributes + LifecycleStages + IcpTiers + ChurnRiskLevels + ProductRoles + DealStages (each with type)
  user-properties.ts - UserProperties const object + UserPropertyKey type
  index.ts           - barrel re-exports
  sdk/               - PlgClient, track, identify, attio-sync, automations
```

### 2.2 Pattern: `as const` + Derived Type

Every constants file follows this exact pattern:

```typescript
export const ThingNames = {
  KEY_NAME: "value-name",
  // ...
} as const;

export type ThingName = (typeof ThingNames)[keyof typeof ThingNames];
```

This pattern is:
- Simple to generate (it is literally key-value pairs)
- Provides full type safety (branded string literal union types)
- Zero runtime overhead
- Compatible with any code generation approach

### 2.3 Mapping User Selections to Constants

| User Selection | Generated File | Generated Constant | Generated Type |
|---|---|---|---|
| Pricing plans (free, pro, enterprise) | `plans.ts` | `Plans = { FREE: "free", PRO: "pro", ... } as const` | `PlanType` |
| Analytics events (signup, checkout) | `events.ts` | `Events = { SIGNUP_COMPLETED: "signup_completed", ... } as const` | `EventName` + `EventPayloads` |
| Feature flags (dark-mode, beta) | `feature-flags.ts` | `FeatureFlags = { DARK_MODE: "dark-mode", ... } as const` | `FeatureFlagKey` |
| Surveys (nps, csat, exit) | `surveys.ts` | `Surveys = { POST_ACTIVATION_NPS: "post-activation-nps", ... } as const` | `SurveyId` |
| CRM attributes (lifecycle, mrr) | `attio.ts` | `AttioAttributes = { LIFECYCLE_STAGE: "lifecycle_stage", ... } as const` | `AttioAttribute` |
| User properties (plan, company) | `user-properties.ts` | `UserProperties = { PLAN: "plan", ... } as const` | `UserPropertyKey` |

### 2.4 EventPayloads: The Complex Case

`EventPayloads` is an interface with computed property keys and typed payloads. Generating it requires knowing:
- Which events are selected
- What properties each event accepts
- Whether properties are required or optional

This is the one case where ts-morph or careful string generation is needed, since it involves:
- Interface declarations
- Computed property keys (`[Events.SIGNUP_COMPLETED]`)
- Nested object types with optional properties

---

## 3. Generating Valid Effect Schema / Branded Type Code

### 3.1 Effect Schema Overview

Effect Schema (`effect/Schema`) allows defining a single schema declaration from which you derive TypeScript types, decoders, encoders, validators, and more. The schema is internally represented as a typed AST wrapper.

Key for code generation: schemas can act as **compilers** that produce different artifacts from the same definition.

### 3.2 Current Codebase Does NOT Use Effect Schema for Constants

The current PLG constants use plain `as const` objects with derived types. They do NOT use `Schema.Literal`, `Schema.Union`, or `Schema.Struct`. This is intentional: the constants are simple string literal unions.

### 3.3 When Effect Schema Would Be Useful

If the builder needs to generate **validated runtime schemas** (not just types), Effect Schema generation would look like:

```typescript
import { Schema } from "effect";

// Generated from user selecting events
export const EventNameSchema = Schema.Literal(
  "signup_started",
  "signup_completed",
  "onboarding_started",
);
export type EventName = typeof EventNameSchema.Type;

// Generated from user defining event payloads
export const SignupCompletedPayload = Schema.Struct({
  method: Schema.Literal("email", "google", "github"),
});
```

### 3.4 Generating Effect Schema Code

For the PLG builder, the simplest approach is string interpolation since schemas are declarative:

```typescript
const generateEventSchema = (events: string[]) => `
import { Schema } from "effect";

export const EventNameSchema = Schema.Literal(
${events.map(e => `  "${e}",`).join("\n")}
);
export type EventName = typeof EventNameSchema.Type;
`;
```

**Recommendation:** Keep the current `as const` pattern for constants. Only generate Effect Schema code if runtime validation is needed (e.g., for webhook payload validation or API request parsing).

Sources:
- [Effect Schema introduction](https://effect.website/docs/schema/introduction/)
- [Effect Schema basic usage](https://effect.website/docs/schema/basic-usage/)

---

## 4. Generating IaC Resource Definitions from Selections

### 4.1 Current IaC Pattern

The `plg-stack.run.ts` file uses an `alchemy-effect` pattern where each resource is a class extending a resource constructor:

```typescript
export class DarkModeFlag extends FeatureFlag("DarkModeFlag", {
  key: FeatureFlags.DARK_MODE,
  name: "Dark Mode",
  active: true,
  rolloutPercentage: 100,
}) {}
```

Resources reference the constants from the PLG package, creating a tight coupling between constants and IaC definitions.

### 4.2 Mapping Selections to IaC Resources

| User Selection | IaC Resource Class | Constructor | Key Properties |
|---|---|---|---|
| Feature flag | `extends FeatureFlag(...)` | `FeatureFlag` | `key`, `name`, `active`, `rolloutPercentage` |
| Experiment | `extends Experiment(...)` | `Experiment` | `name`, `description`, `featureFlagKey`, `type` |
| Survey (NPS) | `extends Survey(...)` | `Survey` | `name`, `type`, `description`, `questions[]` |
| Survey (CSAT) | `extends Survey(...)` | `Survey` | `name`, `type`, `description`, `questions[]` |
| CRM attribute | `extends Attribute(...)` | `Attribute` | `target`, `identifier`, `title`, `apiSlug`, `type` |
| CRM select option | `extends SelectOption(...)` | `SelectOption` | `target`, `identifier`, `attribute`, `title` |
| Webhook | `extends Webhook(...)` | `Webhook` | `targetUrl`, `subscriptions[]` |
| Dashboard | `extends Dashboard(...)` | `Dashboard` | `name`, `description`, `tags[]` |
| Action | `extends Action(...)` | `Action` | `name`, `description`, `tags[]`, `steps[]` |
| Cohort | `extends Cohort(...)` | `Cohort` | `name`, `description`, `filters` |
| Insight | `extends Insight(...)` | `Insight` | `name`, `description`, `saved`, `query` |

### 4.3 Generation Strategy

Each resource follows the same class-extending pattern. The generator needs to:

1. **Generate the class declaration** with a PascalCase name derived from the user's selection
2. **Reference the constant** from the PLG constants file (e.g., `FeatureFlags.DARK_MODE`)
3. **Compose the `defineStack` call** listing all generated resource classes
4. **Generate imports** for all alchemy resource constructors used

String interpolation works well here because the pattern is highly regular:

```typescript
const generateFeatureFlag = (flag: { constKey: string; name: string; active: boolean; rollout: number }) => `
export class ${toPascalCase(flag.name)}Flag extends FeatureFlag("${toPascalCase(flag.name)}Flag", {
  key: FeatureFlags.${flag.constKey},
  name: "${flag.name}",
  active: ${flag.active},
  rolloutPercentage: ${flag.rollout},
}) {}
`;
```

### 4.4 Stack Composition

The `defineStack` call aggregates all resources. Generation is a matter of collecting all generated class names and listing them:

```typescript
const generateStack = (resources: string[]) => `
const stack = defineStack({
  name: "plg-stack",
  stages,
  resources: [
${resources.map(r => `    ${r},`).join("\n")}
  ],
  providers: providers(),
});
`;
```

---

## 5. How the shadcn CLI Command Is Composed from Selections

### 5.1 Current Project Setup

The project uses shadcn with `components.json` configured in `packages/ui/`, `apps/web/`, and `apps/admin/`. The UI package uses:
- Style: `base-mira`
- RSC: `false`
- TSX: `true`
- Icon library: `tabler`
- Registries: `{}` (empty -- no custom registries configured yet)

### 5.2 Registry Items for PLG

The PLG builder would distribute its generated files as shadcn registry items. Each output category maps to a registry item:

| Output | Registry Item Type | Registry Item Name |
|---|---|---|
| Events constants | `registry:file` | `plg-events` |
| Feature flags constants | `registry:file` | `plg-feature-flags` |
| Plans constants | `registry:file` | `plg-plans` |
| Surveys constants | `registry:file` | `plg-surveys` |
| CRM attributes constants | `registry:file` | `plg-attio` |
| User properties constants | `registry:file` | `plg-user-properties` |
| PLG SDK (track/identify) | `registry:file` | `plg-sdk` |
| IaC stack file | `registry:file` | `plg-stack` |
| Barrel index | `registry:file` | `plg-index` |

### 5.3 Composing the CLI Command

Based on user selections, the builder composes a shadcn add command:

```bash
# Full PLG stack
npx shadcn@latest add plg-events plg-feature-flags plg-plans plg-surveys plg-attio plg-user-properties plg-sdk plg-stack

# Minimal (analytics only, no CRM)
npx shadcn@latest add plg-events plg-feature-flags plg-plans plg-sdk

# With CRM
npx shadcn@latest add plg-events plg-feature-flags plg-plans plg-attio plg-user-properties plg-sdk plg-stack
```

### 5.4 Alternative: Single Composite Item with Dynamic Content

Instead of multiple registry items, a **single `plg` registry item** could include all files, with the builder generating a **custom registry-item JSON** containing only the selected files:

```json
{
  "name": "plg",
  "type": "registry:file",
  "files": [
    { "path": "packages/plg/src/events.ts", "type": "registry:file", "target": "packages/plg/src/events.ts", "content": "..." },
    { "path": "packages/plg/src/plans.ts", "type": "registry:file", "target": "packages/plg/src/plans.ts", "content": "..." }
  ],
  "dependencies": ["effect", "posthog-js"]
}
```

The builder would generate this JSON dynamically and the user would install via:
```bash
npx shadcn@latest add ./generated/plg.json
# or from a URL
npx shadcn@latest add https://your-app.com/r/plg.json
```

---

## 6. Recommended Approach for PLG Builder Codegen

### 6.1 Recommendation: String Interpolation with Type-Safe Config Schema

**Use string interpolation (ES6 template literals)** for all code generation, driven by a **typed configuration schema**.

#### Rationale:

1. **The output is simple.** Every constants file is `const X = { ... } as const` plus a type alias. This is trivially representable as string interpolation. ts-morph is overkill.

2. **The IaC pattern is regular.** Every resource is `export class X extends ResourceType("X", { ... }) {}`. No complex interdependencies or conditional logic within the generated code itself.

3. **No template engine needed.** Handlebars/EJS add a dependency and learning curve for what amounts to `Array.map().join()` over config entries. Template engines shine when mixing logic with markup; here we are generating pure TypeScript from structured data.

4. **shadcn registry integration.** The generated code should be packaged as registry-item JSON for distribution. The builder generates the file contents as strings anyway (to embed in the JSON `content` field), so string interpolation is the natural fit.

5. **Type safety is at the config level, not the template level.** Define the user's selections as a typed schema (Effect Schema or Zod), validate the input, then generate deterministic output. The generated code's correctness is a function of the generator's correctness, not of AST manipulation.

### 6.2 Proposed Architecture

```
User UI (web form)
    |
    v
PLG Config Schema (validated with Effect Schema)
    |
    v
Code Generator Functions (string interpolation)
    |
    +---> constants/events.ts
    +---> constants/feature-flags.ts
    +---> constants/plans.ts
    +---> constants/surveys.ts
    +---> constants/attio.ts
    +---> constants/user-properties.ts
    +---> sdk/track.ts, identify.ts, etc.
    +---> plg-stack.run.ts (IaC)
    +---> index.ts (barrel)
    |
    v
Registry Item JSON Builder
    |
    +---> registry-item.json (for shadcn CLI)
    +---> shadcn add command string
```

### 6.3 Config Schema Design

```typescript
import { Schema } from "effect";

const PlanConfig = Schema.Struct({
  key: Schema.String,        // e.g., "FREE", "PRO"
  value: Schema.String,      // e.g., "free", "pro"
});

const EventConfig = Schema.Struct({
  key: Schema.String,        // e.g., "SIGNUP_COMPLETED"
  value: Schema.String,      // e.g., "signup_completed"
  category: Schema.Literal("acquisition", "engagement", "monetization", "churn"),
  payload: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});

const FeatureFlagConfig = Schema.Struct({
  key: Schema.String,        // e.g., "DARK_MODE"
  value: Schema.String,      // e.g., "dark-mode"
  name: Schema.String,       // e.g., "Dark Mode"
  active: Schema.Boolean,
  rolloutPercentage: Schema.Number,
});

const SurveyConfig = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
  name: Schema.String,
  type: Schema.Literal("popover", "api"),
  questions: Schema.Array(Schema.Struct({
    type: Schema.Literal("rating", "open", "single_choice"),
    question: Schema.String,
  })),
});

const PlgBuilderConfig = Schema.Struct({
  plans: Schema.Array(PlanConfig),
  billingIntervals: Schema.Array(Schema.Struct({ key: Schema.String, value: Schema.String })),
  events: Schema.Array(EventConfig),
  featureFlags: Schema.Array(FeatureFlagConfig),
  surveys: Schema.Array(SurveyConfig),
  enableCrm: Schema.Boolean,
  crmAttributes: Schema.optional(Schema.Array(Schema.Struct({
    key: Schema.String,
    value: Schema.String,
    target: Schema.Literal("companies", "people", "deals"),
    type: Schema.Literal("select", "number", "date", "checkbox", "status"),
  }))),
  experiments: Schema.optional(Schema.Array(Schema.Struct({
    name: Schema.String,
    description: Schema.String,
    featureFlagKey: Schema.String,
  }))),
});
```

### 6.4 Generator Function Examples

```typescript
// Generate events.ts from config
function generateEventsFile(events: EventConfig[]): string {
  const entries = events
    .map(e => `  ${e.key}: "${e.value}",`)
    .join("\n");

  return `export const Events = {\n${entries}\n} as const;\n\nexport type EventName = (typeof Events)[keyof typeof Events];\n`;
}

// Generate feature flag IaC resource
function generateFeatureFlagResource(flag: FeatureFlagConfig): string {
  const className = toPascalCase(flag.name) + "Flag";
  return `export class ${className} extends FeatureFlag("${className}", {
  key: FeatureFlags.${flag.key},
  name: "${flag.name}",
  active: ${flag.active},
  rolloutPercentage: ${flag.rolloutPercentage},
}) {}\n`;
}

// Compose shadcn command
function composeShadcnCommand(config: PlgBuilderConfig): string {
  const items = ["plg-events", "plg-feature-flags", "plg-plans", "plg-sdk"];
  if (config.surveys.length > 0) items.push("plg-surveys");
  if (config.enableCrm) items.push("plg-attio", "plg-user-properties");
  items.push("plg-stack");
  return `npx shadcn@latest add ${items.join(" ")}`;
}
```

### 6.5 Formatting

Run `prettier` or `biome format` on generated files as a post-processing step. This eliminates whitespace concerns from string interpolation and ensures consistent style with the rest of the project.

### 6.6 Testing Strategy

1. **Snapshot tests:** Generate code from known configs, snapshot the output, verify it matches expected files
2. **TypeScript compilation tests:** Feed generated code through `tsc --noEmit` to verify syntactic and type validity
3. **Round-trip tests:** Generate code, import it, verify the constants have the expected values at runtime
4. **Schema validation tests:** Ensure the config schema rejects invalid inputs (missing keys, wrong types)

### 6.7 Why NOT ts-morph

ts-morph would be the right choice if:
- The generated code had complex interdependencies (imports that depend on other generated files)
- The code involved generic type parameters or conditional types
- We needed to modify existing code (merge new events into an existing constants file)

For the PLG builder, none of these apply. The generator always produces complete files from scratch based on config. String interpolation is simpler, faster, and has zero dependencies.

### 6.8 Why NOT Handlebars/EJS

Template engines are designed for mixing logic with markup. The PLG generator is producing pure TypeScript from structured data. The "template" is just a function that maps config to string. Adding Handlebars would mean:
- `.hbs` files that are harder to type-check than TypeScript functions
- A build step to compile templates
- A dependency that adds no value over native template literals

### 6.9 Future: AI-Assisted Generation

The shadcn registry + MCP integration opens up an interesting path: the PLG builder could expose an MCP tool that lets AI assistants generate PLG configurations. The config schema becomes the tool's input schema, and the generator produces the registry item JSON that the AI can install via the shadcn CLI.
