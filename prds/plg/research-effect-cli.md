# Research: @effect/cli for PLG Stack Builder CLI

**Date:** 2026-01-31
**Status:** Complete
**Package:** `@effect/cli` (v0.73.0+)

---

## 1. Package Structure & Core Primitives

The `@effect/cli` package provides a declarative, type-safe framework for building command-line applications within the Effect ecosystem. The core modules are:

| Module | Purpose |
|--------|---------|
| `Command` | Define commands, subcommands, handlers |
| `Options` | Named flags (`--flag`, `--key=value`) |
| `Args` | Positional arguments |
| `Prompt` | Interactive user input (text, select, confirm, etc.) |
| `HelpDoc` | Help text primitives for documentation |
| `ValidationError` | Typed validation errors |
| `CliConfig` | CLI configuration (case sensitivity, etc.) |
| `BuiltInOptions` | Auto-generated `--help`, `--version`, `--wizard`, `--completions`, `--log-level` |

### Installation

```bash
bun add @effect/cli @effect/platform @effect/platform-node
```

### Minimal Example

```typescript
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const command = Command.make("hello", {}, () => Console.log("Hello World"))

const cli = Command.run(command, {
  name: "Hello CLI",
  version: "1.0.0"
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

---

## 2. Command Definition

### `Command.make(name, config, handler)`

The primary way to define commands. Takes a name, a config object of `Options`/`Args`, and a handler function that receives the parsed config.

```typescript
import { Args, Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"

const name = Args.text({ name: "name" }).pipe(Args.withDefault("World"))
const shout = Options.boolean("shout").pipe(Options.withAlias("s"))

const greet = Command.make("greet", { name, shout }, ({ name, shout }) => {
  const message = `Hello, ${name}!`
  return Console.log(shout ? message.toUpperCase() : message)
})
```

**Key:** The handler receives a fully typed object matching the config shape. The `name` field is a `string`, `shout` is a `boolean`.

### `Command.withHandler`

Attach or replace a handler after command creation (useful for separating definition from implementation):

```typescript
const greetCmd = Command.make("greet", { name, shout })

const greetWithHandler = greetCmd.pipe(
  Command.withHandler(({ name, shout }) =>
    Console.log(shout ? name.toUpperCase() : name)
  )
)
```

### `Command.withSubcommands`

Compose parent and child commands into a hierarchy:

```typescript
const deploy = Command.make("deploy", { stage, dryRun }, (args) =>
  execDeploy(args)
)

const destroy = Command.make("destroy", { stage }, (args) =>
  execDestroy(args)
)

const root = Command.make("plg").pipe(
  Command.withSubcommands([deploy, destroy])
)
```

Subcommands can access the parent command's parsed config through the Effect context.

### `Command.withDescription`

Add descriptions used in help text generation:

```typescript
const addCmd = Command.make("add", { text }, ({ text }) =>
  repo.add(text)
).pipe(Command.withDescription("Add a new task"))
```

### `Command.run`

Initialize and run the CLI application:

```typescript
const cli = Command.run(root, {
  name: "PLG Stack Builder",
  version: "1.0.0"
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

---

## 3. Options and Args

### Options Constructors

| Constructor | Type | Example |
|-------------|------|---------|
| `Options.text(name)` | `string` | `--name=foo` |
| `Options.boolean(name)` | `boolean` | `--verbose` |
| `Options.integer(name)` | `number` (int) | `--count=5` |
| `Options.choice(name, choices)` | union of strings | `--format=json\|yaml` |
| `Options.keyValueMap(name)` | `Map<string, string>` | `--env=KEY=VAL` |
| `Options.file(name)` | file path | `--config=./config.json` |

### Options Combinators

```typescript
// Alias (short flag)
Options.text("output").pipe(Options.withAlias("o"))

// Optional (returns Option<A>)
Options.text("config").pipe(Options.optional)

// Default value
Options.integer("count").pipe(Options.withDefault(10))

// Description for help text
Options.boolean("verbose").pipe(
  Options.withDescription("Enable verbose logging")
)

// Map/transform the value
Options.text("stage").pipe(
  Options.map((s) => s.toLowerCase())
)

// MapEffect (effectful transformation with validation)
Options.text("stage").pipe(
  Options.mapEffect((stage) => {
    const regex = /^[a-z0-9]+([-_a-z0-9]+)*$/gi
    return regex.test(stage)
      ? Effect.succeed(stage)
      : Effect.fail(
          ValidationError.invalidValue(
            HelpDoc.p(`Stage '${stage}' is invalid.`)
          )
        )
  })
)

// Fallback to environment config
Options.text("api-key").pipe(
  Options.withFallbackConfig(Config.string("API_KEY"))
)

// Fallback to interactive prompt (KEY for wizard flows)
Options.text("name").pipe(
  Options.withFallbackPrompt(
    Prompt.text({ message: "What is your name?" })
  )
)

// Schema validation
Options.text("email").pipe(
  Options.withSchema(Schema.String.pipe(Schema.pattern(/^.+@.+\..+$/)))
)
```

### Args Constructors

| Constructor | Type | Example |
|-------------|------|---------|
| `Args.text({ name })` | `string` | positional string |
| `Args.integer({ name })` | `number` | positional integer |
| `Args.file({ name, exists })` | file path | file that must exist |
| `Args.directory({ name })` | dir path | directory path |

### Args Combinators

```typescript
// Default value
Args.text({ name: "format" }).pipe(Args.withDefault("json"))

// Optional
Args.text({ name: "output" }).pipe(Args.optional)

// Repeated (zero or more)
Args.text({ name: "files" }).pipe(Args.repeated)

// At least N
Args.text({ name: "files" }).pipe(Args.atLeast(1))

// Schema validation
Args.integer({ name: "id" }).pipe(Args.withSchema(TaskId))

// Description
Args.text({ name: "file" }).pipe(
  Args.withDescription("Main file to deploy")
)
```

---

## 4. Interactive Prompts

The `Prompt` module provides a full set of interactive prompts, similar to `inquirer` or `@clack/prompts`, but integrated into the Effect type system.

### Prompt Constructors

| Constructor | Output Type | Description |
|-------------|-------------|-------------|
| `Prompt.text(config)` | `string` | Single-line text input |
| `Prompt.password(config)` | `string` | Redacted text input |
| `Prompt.hidden(config)` | `string` | Hidden text input |
| `Prompt.confirm(config)` | `boolean` | Yes/No question |
| `Prompt.select(config)` | `A` | Single selection from choices |
| `Prompt.multiSelect(config)` | `Array<A>` | Multiple selections |
| `Prompt.list(config)` | `Array<string>` | Comma-separated list |
| `Prompt.integer(config)` | `number` | Integer input |
| `Prompt.float(config)` | `number` | Float input |
| `Prompt.date(config)` | `Date` | Date input |
| `Prompt.file(config)` | `string` | File path selection |
| `Prompt.custom(state, handlers)` | `A` | Fully custom prompt |

### Prompt Examples

```typescript
import * as Prompt from "@effect/cli/Prompt"

// Text input with default
const name = Prompt.text({
  message: "Project name:",
  default: "my-plg-app"
})

// Confirmation
const usePostHog = Prompt.confirm({
  message: "Use PostHog for analytics?",
  initial: true
})

// Select from choices
const analyticsProvider = Prompt.select({
  message: "Choose analytics provider:",
  choices: [
    { title: "PostHog", value: "posthog" as const },
    { title: "Amplitude", value: "amplitude" as const },
    { title: "Segment", value: "segment" as const },
    { title: "None", value: "none" as const },
  ]
})

// Multi-select
const features = Prompt.multiSelect({
  message: "Select PLG features:",
  choices: [
    { title: "Analytics", value: "analytics" as const },
    { title: "Feature Flags", value: "feature-flags" as const },
    { title: "Experiments", value: "experiments" as const },
    { title: "Surveys", value: "surveys" as const },
    { title: "CRM Sync", value: "crm" as const },
  ]
})

// Integer with validation
const maxEvents = Prompt.integer({
  message: "Max events per batch:",
  min: 1,
  max: 1000
})

// Text with validation
const apiKey = Prompt.text({
  message: "PostHog API key:",
  validate: (value) =>
    value.startsWith("phc_")
      ? Effect.succeed(value)
      : Effect.fail("API key must start with 'phc_'")
})
```

### Prompts are Effects

Every `Prompt` returns an `Effect<Output, QuitException, Terminal>`. They compose with all Effect primitives:

```typescript
// Using pipe
Prompt.text({ message: "Name:" }).pipe(
  Effect.flatMap((name) => Effect.log(`Hello, ${name}`)),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)

// Using Effect.gen
const program = Effect.gen(function* () {
  const name = yield* Prompt.text({ message: "Name:" })
  const age = yield* Prompt.integer({ message: "Age:" })
  yield* Effect.log(`${name} is ${age}`)
})
```

### `Prompt.all` — Compose Multiple Prompts

Run multiple prompts in sequence, collecting results:

```typescript
// Record form (named results)
const config = Prompt.all({
  projectName: Prompt.text({ message: "Project name:" }),
  analytics: Prompt.select({
    message: "Analytics provider:",
    choices: [
      { title: "PostHog", value: "posthog" },
      { title: "None", value: "none" },
    ]
  }),
  enableFlags: Prompt.confirm({ message: "Enable feature flags?" }),
})

// config: Effect<{ projectName: string, analytics: string, enableFlags: boolean }>
```

---

## 5. Wizard-Style Flows

There are **three approaches** for building wizard-style multi-step interactive flows with `@effect/cli`.

### Approach A: Built-in `--wizard` Mode

`@effect/cli` has a built-in `--wizard` flag. When invoked, it interactively prompts for ALL options and arguments not provided on the command line. This is automatic and requires zero additional code.

```bash
plg init --wizard
```

This walks the user through every option defined in the command's config.

### Approach B: `Options.withFallbackPrompt` (Hybrid CLI+Interactive)

The most idiomatic approach. Define options that work as CLI flags but fall back to prompts when not provided:

```typescript
const analytics = Options.choice("analytics", [
  "posthog", "amplitude", "segment", "none"
]).pipe(
  Options.withDescription("Analytics provider"),
  Options.withFallbackPrompt(
    Prompt.select({
      message: "Choose analytics provider:",
      choices: [
        { title: "PostHog (recommended)", value: "posthog" },
        { title: "Amplitude", value: "amplitude" },
        { title: "Segment", value: "segment" },
        { title: "None", value: "none" },
      ]
    })
  )
)

const featureFlags = Options.choice("feature-flags", [
  "posthog", "launchdarkly", "none"
]).pipe(
  Options.withDescription("Feature flag provider"),
  Options.withFallbackPrompt(
    Prompt.select({
      message: "Choose feature flag provider:",
      choices: [
        { title: "PostHog", value: "posthog" },
        { title: "LaunchDarkly", value: "launchdarkly" },
        { title: "None", value: "none" },
      ]
    })
  )
)

const initCommand = Command.make(
  "init",
  { analytics, featureFlags },
  ({ analytics, featureFlags }) =>
    Effect.gen(function* () {
      yield* Effect.log(`Analytics: ${analytics}`)
      yield* Effect.log(`Feature Flags: ${featureFlags}`)
      // Build config, run codegen...
    })
)
```

**Usage patterns:**

```bash
# Fully interactive (prompts for everything)
plg init

# Partially interactive (prompts only for missing flags)
plg init --analytics=posthog

# Fully non-interactive (CI/CD friendly)
plg init --analytics=posthog --feature-flags=posthog
```

### Approach C: `Effect.gen` Wizard (Full Control)

For complex branching logic where later prompts depend on earlier answers:

```typescript
const initCommand = Command.make("init", {}, () =>
  Effect.gen(function* () {
    // Step 1: Project basics
    const projectName = yield* Prompt.text({
      message: "Project name:",
      default: "my-plg-app"
    })

    // Step 2: Analytics provider
    const analytics = yield* Prompt.select({
      message: "Analytics provider:",
      choices: [
        { title: "PostHog", value: "posthog" as const },
        { title: "Amplitude", value: "amplitude" as const },
        { title: "None", value: "none" as const },
      ]
    })

    // Step 3: Conditional — only ask if analytics !== "none"
    const featureFlags = analytics !== "none"
      ? yield* Prompt.select({
          message: "Feature flag provider:",
          choices: [
            // If PostHog analytics, offer PostHog flags
            ...(analytics === "posthog"
              ? [{ title: "PostHog (bundled)", value: "posthog" as const }]
              : []),
            { title: "LaunchDarkly", value: "launchdarkly" as const },
            { title: "None", value: "none" as const },
          ]
        })
      : "none" as const

    // Step 4: Conditional — only if analytics includes experiments
    const experiments = analytics === "posthog"
      ? yield* Prompt.confirm({
          message: "Enable A/B experiments?",
          initial: true
        })
      : false

    // Step 5: CRM
    const crm = yield* Prompt.select({
      message: "CRM provider:",
      choices: [
        { title: "Attio", value: "attio" as const },
        { title: "HubSpot", value: "hubspot" as const },
        { title: "None", value: "none" as const },
      ]
    })

    // Step 6: Confirm
    yield* Effect.log(`
      Project: ${projectName}
      Analytics: ${analytics}
      Feature Flags: ${featureFlags}
      Experiments: ${experiments}
      CRM: ${crm}
    `)

    const confirmed = yield* Prompt.confirm({
      message: "Generate PLG stack with these settings?"
    })

    if (!confirmed) {
      yield* Effect.log("Aborted.")
      return
    }

    // Build typed config and run codegen pipeline
    const config = { projectName, analytics, featureFlags, experiments, crm }
    yield* generatePlgStack(config)
  })
)
```

This approach gives full control over branching, conditional prompts, and dependent selections — exactly what a PLG builder wizard needs.

---

## 6. Integration with Effect Services (Layer/Service)

CLI commands run in the Effect runtime, so they naturally compose with Effect's Layer/Service system. The handler returned by `Command.make` is an `Effect`, so it can `yield*` any service tag.

### Pattern: Service Layer in CLI

```typescript
import { Context, Effect, Layer } from "effect"
import { Command, Options } from "@effect/cli"

// 1. Define a service
class PlgCodegen extends Context.Tag("PlgCodegen")<
  PlgCodegen,
  {
    readonly generate: (config: PlgConfig) => Effect.Effect<GeneratedFiles>
    readonly validate: (config: PlgConfig) => Effect.Effect<ValidationResult>
  }
>() {}

// 2. Implement with a Layer
const PlgCodegenLive = Layer.succeed(PlgCodegen, {
  generate: (config) => Effect.gen(function* () {
    // ... generate code from config
    return { files: [] }
  }),
  validate: (config) => Effect.gen(function* () {
    // ... validate config constraints
    return { valid: true, errors: [] }
  }),
})

// 3. Use in CLI command handler
const generateCommand = Command.make(
  "generate",
  { configFile: Options.file("config") },
  ({ configFile }) =>
    Effect.gen(function* () {
      const codegen = yield* PlgCodegen
      const config = yield* loadConfig(configFile)
      const result = yield* codegen.validate(config)
      if (!result.valid) {
        yield* Effect.fail(new ValidationError(result.errors))
      }
      const files = yield* codegen.generate(config)
      yield* Effect.log(`Generated ${files.files.length} files`)
    })
)

// 4. Provide layers when running CLI
const cli = Command.run(root, { name: "plg", version: "1.0.0" })

cli(process.argv).pipe(
  Effect.provide(Layer.mergeAll(
    PlgCodegenLive,
    NodeContext.layer
  )),
  NodeRuntime.runMain
)
```

### Real Example: alchemy-effect CLI

The alchemy-effect CLI (found at `.context/alchemy-effect/alchemy-effect/bin/alchemy-effect.ts`) demonstrates this pattern excellently:

```typescript
// From alchemy-effect/bin/alchemy-effect.ts

const deployCommand = Command.make(
  "deploy",
  { dryRun, main, envFile, stage, yes },
  (args) =>
    execStack({
      ...args,
      select: (stack) => stack.resources,
    }),
)

// execStack uses services from Effect layers
const execStack = Effect.fn(function* ({ main, stage, envFile, ... }) {
  const path = yield* Path          // <- Effect service
  const cli = yield* CLI.CLI        // <- Effect service

  // Compose layers
  const layers = Layer.provideMerge(
    Layer.provideMerge(stack.providers, alchemy),
    Layer.mergeAll(
      platform,
      App.make({ name: stackName, stage, config: stageConfig }),
    ),
  )

  yield* Effect.gen(function* () {
    const cli = yield* CLI.CLI
    const updatePlan = yield* plan(...resources)
    if (!yes) {
      const approved = yield* cli.approvePlan(updatePlan)
      if (!approved) return
    }
    yield* applyPlan(updatePlan)
  }).pipe(Effect.provide(layers))
})

// Root command with subcommands
const root = Command.make("alchemy-effect", {}).pipe(
  Command.withSubcommands([
    bootstrapCommand,
    deployCommand,
    destroyCommand,
    planCommand,
  ]),
)

// Run with platform layer
const cli = Command.run(root, {
  name: "Alchemy Effect CLI",
  version: packageJson.version,
})

cli(process.argv).pipe(
  Effect.withConfigProvider(ConfigProvider.fromEnv()),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
```

---

## 7. Help Text Generation

Help text is **automatically generated** from command definitions. No additional code needed.

### What Gets Auto-Generated

- Command name and description (from `Command.withDescription`)
- Option names, aliases, types, defaults (from `Options.*`)
- Argument names, types, defaults (from `Args.*`)
- Subcommand list with descriptions
- Built-in flags: `--help`, `--version`, `--wizard`, `--completions`, `--log-level`

### Adding Descriptions

```typescript
const stage = Options.text("stage").pipe(
  Options.withDescription("Stage to deploy to (e.g., dev, prod)"),
  Options.withDefault("dev")
)

const mainFile = Args.file({ name: "main", exists: "yes" }).pipe(
  Args.withDescription("Main entry file for the PLG stack"),
  Args.withDefault("plg.config.ts")
)

const initCmd = Command.make("init", { stage }, handler).pipe(
  Command.withDescription("Initialize a new PLG stack project")
)
```

### HelpDoc for Custom Validation Errors

```typescript
import * as HelpDoc from "@effect/cli/HelpDoc"
import * as ValidationError from "@effect/cli/ValidationError"

Options.text("stage").pipe(
  Options.mapEffect((stage) =>
    /^[a-z0-9_-]+$/.test(stage)
      ? Effect.succeed(stage)
      : Effect.fail(
          ValidationError.invalidValue(
            HelpDoc.p(
              `Stage '${stage}' is invalid. Must be lowercase alphanumeric with hyphens/underscores.`
            )
          )
        )
  )
)
```

### Shell Completions

Auto-generated for bash, zsh, fish, sh:

```bash
plg --completions bash >> ~/.bashrc
plg --completions zsh >> ~/.zshrc
```

---

## 8. Real-World Examples

### alchemy-effect CLI (Local Reference)

**Path:** `.context/alchemy-effect/alchemy-effect/bin/alchemy-effect.ts`

This is the most complete real-world `@effect/cli` example in the codebase. It demonstrates:

- `Command.make` with typed options and args
- `Options.text`, `Options.boolean`, `Options.file`, `Options.optional`
- `Options.mapEffect` for validation
- `Options.map` with `Option.getOrUndefined`
- `Args.file` with existence checking and defaults
- `Command.withSubcommands` for `deploy`, `destroy`, `plan`, `bootstrap`
- Integration with Effect services (`Path`, `CLI.CLI`, `App`)
- Layer composition (`Layer.mergeAll`, `Layer.provideMerge`)
- Config from environment (`ConfigProvider.fromEnv()`)
- `Command.run` with version from `package.json`

### Effect Solutions Task Manager

**Source:** [effect.solutions/cli](https://www.effect.solutions/cli)

A complete task manager demonstrating:
- Schema-based domain models (`Task`, `TaskList`)
- Service layer (`TaskRepo`) with `Context.Tag` and `Layer.effect`
- CLI commands consuming services via `yield* TaskRepo`
- File-backed persistence via `FileSystem.FileSystem`
- Full subcommand tree: `add`, `list`, `toggle`, `clear`

### Effect-TS Examples Repository

**Source:** [github.com/Effect-TS/examples](https://github.com/Effect-TS/examples)

Contains additional CLI examples maintained by the Effect team.

---

## 9. CLI + Web UI Shared Logic Architecture

For the PLG Stack Builder, both the CLI and web UI need to share the same:

1. **Validation schemas** (Effect Schema for PlgBuilderConfig)
2. **Constraint logic** (provider compatibility graph)
3. **Code generation functions** (config -> generated files)
4. **Domain constants** (provider names, feature names, etc.)

### Proposed Package Structure

```
packages/
  plg/                      # PLG constants (events, flags, etc.) — EXISTING
  plg-builder-core/         # Shared logic (schemas, codegen, constraints)
    src/
      config.ts             # PlgBuilderConfig Effect Schema
      constraints.ts        # Provider compatibility DAG / XState guards
      codegen/
        index.ts            # generatePlgStack(config) -> Effect<GeneratedFiles>
        events.ts           # Generate events.ts from config
        flags.ts            # Generate feature-flags.ts from config
        sdk.ts              # Generate SDK wrappers from config
      providers.ts          # Provider metadata (names, capabilities)
      validation.ts         # Constraint validation (pure functions)
  plg-builder-cli/          # CLI interface
    src/
      index.ts              # CLI entry point using @effect/cli
      commands/
        init.ts             # plg init — interactive wizard
        generate.ts         # plg generate — codegen from config file
        validate.ts         # plg validate — check config
  plg-builder-web/          # Web UI (existing builder page)
    src/
      components/           # React components using plg-builder-core
```

### Shared Config Schema (plg-builder-core)

```typescript
// packages/plg-builder-core/src/config.ts
import { Schema } from "effect"

export const AnalyticsProvider = Schema.Literal(
  "posthog", "amplitude", "segment", "none"
)

export const FeatureFlagProvider = Schema.Literal(
  "posthog", "launchdarkly", "none"
)

export const CrmProvider = Schema.Literal(
  "attio", "hubspot", "none"
)

export const PlgBuilderConfig = Schema.Struct({
  projectName: Schema.NonEmptyString,
  analytics: AnalyticsProvider,
  featureFlags: FeatureFlagProvider,
  experiments: Schema.Boolean,
  surveys: Schema.Boolean,
  crm: CrmProvider,
  iac: Schema.Literal("alchemy-effect", "none"),
})

export type PlgBuilderConfig = typeof PlgBuilderConfig.Type
```

### CLI Using Shared Logic

```typescript
// packages/plg-builder-cli/src/commands/init.ts
import { Args, Command, Options, Prompt } from "@effect/cli"
import { PlgBuilderConfig, AnalyticsProvider } from "@plg/builder-core/config"
import { generatePlgStack } from "@plg/builder-core/codegen"
import { validateConstraints } from "@plg/builder-core/validation"
import { Effect, Schema } from "effect"

const analytics = Options.choice("analytics", [
  "posthog", "amplitude", "segment", "none"
]).pipe(
  Options.withFallbackPrompt(
    Prompt.select({
      message: "Analytics provider:",
      choices: [
        { title: "PostHog (recommended)", value: "posthog" },
        { title: "Amplitude", value: "amplitude" },
        { title: "Segment", value: "segment" },
        { title: "None", value: "none" },
      ]
    })
  )
)

// ... similar for featureFlags, crm, etc.

export const initCommand = Command.make(
  "init",
  { analytics, featureFlags, crm, experiments, surveys },
  (selections) =>
    Effect.gen(function* () {
      // Validate against shared constraint schema
      const config = yield* Schema.decodeUnknown(PlgBuilderConfig)(selections)

      // Validate provider compatibility (shared logic)
      const validation = yield* validateConstraints(config)
      if (!validation.valid) {
        yield* Effect.fail(new Error(validation.errors.join("\n")))
      }

      // Generate code (shared logic)
      const files = yield* generatePlgStack(config)
      yield* Effect.log(`Generated ${files.length} files`)
    })
)
```

### Web UI Using Same Shared Logic

```typescript
// packages/plg-builder-web/src/hooks/use-plg-builder.ts
import { PlgBuilderConfig } from "@plg/builder-core/config"
import { generatePlgStack } from "@plg/builder-core/codegen"
import { validateConstraints } from "@plg/builder-core/validation"
import { Schema, Effect } from "effect"

export function usePlgBuilder() {
  const generate = async (formData: unknown) => {
    const program = Effect.gen(function* () {
      const config = yield* Schema.decodeUnknown(PlgBuilderConfig)(formData)
      const validation = yield* validateConstraints(config)
      if (!validation.valid) throw new Error(validation.errors.join("\n"))
      return yield* generatePlgStack(config)
    })
    return Effect.runPromise(program)
  }

  return { generate }
}
```

### Key Architectural Principle

The **same** `PlgBuilderConfig -> validate -> codegen` pipeline runs in both interfaces:

```
CLI (interactive prompts)  ──┐
                              ├──> PlgBuilderConfig ──> validate ──> codegen ──> files
Web UI (form submissions) ──┘
```

The CLI just collects the config differently (via `@effect/cli` Options/Prompts instead of React form state), but the validation and generation logic is 100% shared.

---

## 10. Summary & Recommendations

### For the PLG Stack Builder CLI

1. **Use `Options.withFallbackPrompt`** for the primary `init` command. This gives users the best of both worlds: fully scriptable with flags, fully interactive without them.

2. **Use `Effect.gen` wizard** for complex branching flows where later prompts depend on earlier answers (e.g., "if PostHog analytics, offer PostHog feature flags").

3. **Share all schemas and codegen** via a `plg-builder-core` package that both CLI and web UI import.

4. **Leverage Effect services** — Define `PlgCodegen`, `PlgValidator` as Effect services. The CLI provides `NodeContext.layer` + `FetchHttpClient.layer`; the web UI provides browser equivalents.

5. **Use `Command.withSubcommands`** for a multi-command CLI:
   - `plg init` — Interactive wizard (or `--analytics=posthog --flags=posthog` for CI)
   - `plg generate --config=plg.config.json` — Generate from config file
   - `plg validate --config=plg.config.json` — Validate config only
   - `plg deploy` — Deploy IaC (delegates to alchemy-effect)

6. **Built-in `--wizard` mode** comes for free and prompts for all missing options. No extra work needed.

7. **Schema validation** is shared between CLI (`Options.withSchema`, `Args.withSchema`) and web UI (`Schema.decodeUnknown`).

### References

- [Official @effect/cli docs](https://effect-ts.github.io/effect/docs/cli)
- [Effect Solutions CLI guide](https://www.effect.solutions/cli)
- [Effect-TS/examples](https://github.com/Effect-TS/examples)
- [@effect/cli on npm](https://www.npmjs.com/package/@effect/cli)
- [DeepWiki CLI Framework](https://deepwiki.com/Effect-TS/effect/8.1-cli-framework)
- [Command.ts API reference](https://effect-ts.github.io/effect/cli/Command.ts.html)
- [Options.ts API reference](https://effect-ts.github.io/effect/cli/Options.ts.html)
- Local reference: `.context/alchemy-effect/alchemy-effect/bin/alchemy-effect.ts`
