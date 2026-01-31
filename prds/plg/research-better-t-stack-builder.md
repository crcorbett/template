# Research: Better T Stack Builder Architecture

> Source: [AmanVarshney01/create-better-t-stack](https://github.com/AmanVarshney01/create-better-t-stack)
> Date: 2026-01-31

## 1. UI Architecture

### State Management: URL-First with `nuqs`

The builder uses **URL query parameters as the single source of truth** for all state. This is implemented via the [`nuqs`](https://nuqs.47ng.com/) library (type-safe URL search params for React).

**Key file:** `apps/web/src/lib/stack-url-state.client.ts`

The custom hook `useStackState()` wraps `nuqs`'s `useQueryStates`:

```ts
export function useStackState() {
  const [queryState, setQueryState] = useQueryStates(stackParsers, stackQueryStatesOptions);
  // ... maps queryState to StackState, returns [stack, updateStack, viewMode, ...]
}
```

Each field in the stack state has a **parser** with validation and a default value:

```ts
export const stackParsers = {
  projectName: parseAsString.withDefault("my-better-t-app"),
  backend: parseAsStringEnum<StackState["backend"]>(getValidIds("backend")).withDefault("hono"),
  addons: parseAsArrayOf(parseAsString).withDefault(["turborepo"]),
  // ... etc
};
```

URL keys are compressed abbreviations defined in `stack-url-keys.ts`:

```ts
export const stackUrlKeys = {
  projectName: "name",
  webFrontend: "fe-w",
  backend: "be",
  database: "db",
  runtime: "rt",
  // ...
};
```

**Benefits of this approach:**
- Shareable URLs contain the full configuration (deep-linking)
- Browser back/forward works naturally
- No external state management library needed
- State persistence is automatic via the URL
- `clearOnDefault: true` keeps URLs clean by omitting default values

### Component Structure

The main component is `StackBuilder` in `apps/web/src/app/(home)/new/_components/stack-builder.tsx` (~892 lines). It is a **two-panel layout**:

1. **Left Sidebar** - Project name input, generated CLI command display (with copy), selected tech badges, action buttons (reset, random, save/load from localStorage), preset dropdown, share button, yolo toggle
2. **Right Panel** - Category sections with clickable technology option cards, organized by `CATEGORY_ORDER`

Mobile has a **three-tab layout** (Summary, Configure, Preview) using responsive CSS.

Sub-components:
- `ActionButtons` - Reset, random, save/load buttons
- `PresetDropdown` - Preset template selector
- `ShareButton` - URL sharing
- `PreviewPanel` - File tree preview of generated project
- `TechIcon` - Icon renderer for technology options
- `YoloToggle` - Toggle that disables all compatibility checks
- `utils.ts` - All constraint/compatibility logic (separate from UI)

### Reactive Flow

The data flow is unidirectional and reactive:

```
User Click -> handleTechSelect() -> setStack() -> URL updates
                                                      |
                                                      v
                                            useStackState() re-renders
                                                      |
                                                      v
                                    analyzeStackCompatibility(stack)
                                                      |
                                                      v
                                    (if incompatibilities found)
                                                      |
                                                      v
                                    setStack(adjustedStack) + toast notifications
                                                      |
                                                      v
                                    generateStackCommand(finalStack) -> display
```

## 2. Option Definition Model

### Data Structure

**Key file:** `apps/web/src/lib/constant.ts`

All technology options are defined in a single `TECH_OPTIONS` constant, typed as `Record<TechCategory, TechOption[]>`:

```ts
export const TECH_OPTIONS: Record<
  TechCategory,
  {
    id: string;       // CLI-compatible identifier (e.g., "tanstack-router", "hono")
    name: string;     // Display name (e.g., "TanStack Router", "Hono")
    description: string;
    icon: string;     // URL to icon SVG
    color: string;    // Tailwind gradient classes (e.g., "from-blue-500 to-blue-700")
    default?: boolean;
    className?: string; // Additional CSS (e.g., dark mode invert)
  }[]
> = { /* ... */ };
```

### Categories

The `TechCategory` type (from `types.ts`) enumerates all categories:

```ts
export type TechCategory =
  | "api" | "webFrontend" | "nativeFrontend" | "runtime" | "backend"
  | "database" | "orm" | "dbSetup" | "webDeploy" | "serverDeploy"
  | "auth" | "payments" | "packageManager" | "addons" | "examples"
  | "git" | "install";
```

### Category Rendering Order

The `CATEGORY_ORDER` array (in `stack-utils.ts`) controls display order:

```ts
const CATEGORY_ORDER: Array<keyof typeof TECH_OPTIONS> = [
  "webFrontend", "nativeFrontend", "backend", "runtime", "api",
  "database", "orm", "dbSetup", "webDeploy", "serverDeploy",
  "auth", "payments", "packageManager", "addons", "examples",
  "git", "install",
];
```

### Selection Model

The `StackState` type defines which categories are single-select vs multi-select:

```ts
export type StackState = {
  projectName: string | null;
  webFrontend: string[];      // multi-select (array)
  nativeFrontend: string[];   // multi-select (array)
  addons: string[];           // multi-select (array)
  examples: string[];         // multi-select (array)
  runtime: string;            // single-select
  backend: string;            // single-select
  database: string;           // single-select
  orm: string;                // single-select
  // ... all other categories are single-select strings
};
```

Every category includes a `"none"` option to represent "no selection." Boolean categories (`git`, `install`) use `"true"` / `"false"` string IDs.

### Default Configuration

```ts
export const DEFAULT_STACK: StackState = {
  projectName: "my-better-t-app",
  webFrontend: ["tanstack-router"],
  backend: "hono",
  runtime: "bun",
  database: "sqlite",
  orm: "drizzle",
  api: "trpc",
  auth: "better-auth",
  packageManager: "bun",
  addons: ["turborepo"],
  // ...
};
```

## 3. Constraint System

**Key file:** `apps/web/src/app/(home)/new/_components/utils.ts`

The constraint system has **two layers** that work together:

### Layer 1: `getDisabledReason()` - Pre-selection Validation

This function determines whether an option **can be clicked** at all. It returns a human-readable reason string if disabled, or `null` if enabled.

```ts
export const getDisabledReason = (
  currentStack: StackState,
  category: keyof typeof TECH_OPTIONS,
  optionId: string,
): string | null => { /* ... */ };
```

It is wrapped by `isOptionCompatible()`:

```ts
export const isOptionCompatible = (currentStack, category, optionId): boolean => {
  if (currentStack.yolo === "true") return true;  // bypass all checks
  return getDisabledReason(currentStack, category, optionId) === null;
};
```

The `handleTechSelect` handler in the main component guards against clicking disabled options:

```ts
const handleTechSelect = (category, techId) => {
  if (!isOptionCompatible(stack, category, techId)) {
    return;  // click is ignored
  }
  // ... proceed with selection
};
```

Disabled options are **visually greyed out** in the UI with tooltips showing the reason.

### Layer 2: `analyzeStackCompatibility()` - Post-selection Auto-adjustment

After every state change, this function runs and **automatically adjusts** dependent options to maintain consistency. It returns:

```ts
interface CompatibilityResult {
  adjustedStack: StackState | null;  // null if no changes needed
  notes: Record<string, { notes: string[]; hasIssue: boolean }>;
  changes: Array<{ category: string; message: string }>;
}
```

The adjustment follows a **dependency cascade** order:
```
frontend -> backend -> runtime -> database -> orm -> api -> auth -> payments -> addons -> examples -> deploy
```

### Constraint Categories (with examples)

**Backend = Convex** (most constrained):
```ts
if (nextStack.backend === "convex") {
  // Force: runtime=none, database=none, orm=none, api=none, dbSetup=none, serverDeploy=none
  // Remove incompatible frontends: solid, astro
  // Adjust auth based on frontend compatibility
}
```

**Backend = none**:
```ts
if (nextStack.backend === "none") {
  // Force: runtime=none, database=none, orm=none, api=none, auth=none, dbSetup=none,
  //        serverDeploy=none, payments=none, examples=["none"]
}
```

**Fullstack backends** (self-next, self-tanstack-start, self-nuxt, self-astro):
```ts
// Force: runtime=none, serverDeploy=none
// Force correct frontend to match backend (e.g., self-next requires next frontend)
```

**Database/ORM bi-directional constraints:**
```ts
// MongoDB requires prisma or mongoose ORM
// Relational DBs (sqlite, postgres, mysql) require drizzle or prisma
// If ORM selected but no database -> auto-select appropriate database
// If database is none -> ORM and dbSetup must be none
```

**DB Setup provider constraints:**
```ts
// turso -> requires sqlite
// d1 -> requires sqlite + workers runtime + hono backend
// neon -> requires postgres
// mongodb-atlas -> requires mongodb
```

### Design Philosophy

The constraint system follows a clear philosophy documented in the code:

```ts
/**
 * PHILOSOPHY: Only disable options that are TRULY incompatible.
 * - Don't create circular dependencies
 * - Allow users to select options that will trigger auto-adjustments
 * - Follow CLI behavior: filter options based on UPSTREAM selections only
 */
```

This means:
- `getDisabledReason()` only blocks truly impossible combinations
- `analyzeStackCompatibility()` handles cascading adjustments after selection
- Users see toast notifications explaining what was auto-adjusted and why

### YOLO Mode

When `yolo === "true"`, both constraint layers are completely bypassed:
- `isOptionCompatible()` always returns `true`
- `analyzeStackCompatibility()` returns no adjustments

## 4. CLI Command Generation

**Key file:** `apps/web/src/lib/stack-utils.ts`

The `generateStackCommand()` function converts a `StackState` to a CLI command string:

```ts
export function generateStackCommand(stack: StackState) {
  // 1. Determine base command from package manager
  const packageManagerCommands = {
    npm: "npx create-better-t-stack@latest",
    pnpm: "pnpm create better-t-stack@latest",
    default: "bun create better-t-stack@latest",
  };

  // 2. If stack matches defaults, emit short form
  if (isStackDefaultExceptProjectName) {
    return `${base} ${projectName} --yes`;
  }

  // 3. Map each state field to a CLI flag
  const flags = [
    `--frontend ${[...stack.webFrontend, ...stack.nativeFrontend].filter(...).join(" ") || "none"}`,
    `--backend ${mapBackendToCli(stack.backend)}`,  // self-next/self-tanstack-start -> "self"
    `--runtime ${stack.runtime}`,
    `--api ${stack.api}`,
    `--auth ${stack.auth}`,
    `--database ${stack.database}`,
    `--orm ${stack.orm}`,
    `--db-setup ${stack.dbSetup}`,
    `--package-manager ${stack.packageManager}`,
    stack.git === "false" ? "--no-git" : "--git",
    stack.install === "false" ? "--no-install" : "--install",
    `--addons ${filteredAddons.join(" ") || "none"}`,
    `--examples ${stack.examples.join(" ") || "none"}`,
    // conditionally: --yolo
  ];

  return `${base} ${projectName} ${flags.join(" ")}`;
}
```

Key mapping details:
- **Package manager** determines the command prefix (`npx`, `pnpm create`, `bun create`)
- **Project name** is the first positional argument
- **Frontend** merges web + native frontend arrays into a single `--frontend` flag
- **Backend** maps `self-next`, `self-tanstack-start`, `self-nuxt`, `self-astro` to `self`
- **Boolean flags** use `--no-git` / `--no-install` negative form
- **Multi-select** categories (addons, examples, frontends) use space-separated values
- **Default optimization**: if all selections match defaults, emits `--yes` shorthand

The command is reactively regenerated via `useEffect` whenever `stack` or `compatibilityAnalysis.adjustedStack` changes.

## 5. Presets System

**Key file:** `apps/web/src/lib/constant.ts`

Presets are defined as an array of objects, each containing a complete `StackState`:

```ts
export const PRESET_TEMPLATES = [
  {
    id: "mern",
    name: "MERN Stack",
    description: "MongoDB + Express + React + Node.js - Classic MERN stack",
    stack: {
      projectName: "my-better-t-app",
      webFrontend: ["react-router"],
      backend: "express",
      runtime: "node",
      database: "mongodb",
      orm: "mongoose",
      dbSetup: "mongodb-atlas",
      api: "orpc",
      auth: "better-auth",
      addons: ["turborepo"],
      examples: ["todo"],
      // ... all fields specified
    },
  },
  // { id: "pern", ... },   // PostgreSQL + Express + React + Node.js
  // { id: "t3", ... },     // Next.js + tRPC + Prisma + PostgreSQL
  // { id: "uniwind", ... }, // Expo + Uniwind (no backend)
];
```

Applying a preset replaces the entire stack state:

```ts
const applyPreset = (presetId: string) => {
  const preset = PRESET_TEMPLATES.find(t => t.id === presetId);
  if (preset) {
    setStack(preset.stack);
    toast.success(`Applied preset: ${preset.name}`);
  }
};
```

Presets are **complete snapshots** -- every field is specified, so applying one fully resets the configuration. The compatibility analysis still runs after applying a preset, but well-defined presets should not trigger adjustments.

## 6. Key Design Patterns for PLG Builder

### Pattern 1: URL-as-State

Using URL query parameters as the single source of truth is the standout pattern. For the PLG builder:
- Every configuration choice maps to a URL param
- The URL is the shareable artifact
- `nuqs` (or equivalent) handles parsing, validation, and serialization
- Compressed URL keys keep URLs manageable (e.g., `be` for backend, `db` for database)

### Pattern 2: Declarative Option Registry

All options are defined as **data** in a single constant (`TECH_OPTIONS`), not scattered across components. Each option has:
- A stable string ID (matches CLI flag values)
- Display metadata (name, description, icon, color)
- A category grouping

For PLG, we should define a similar registry for products, plans, integrations, and features.

### Pattern 3: Two-Layer Constraint System

The separation between "can this be clicked?" (`getDisabledReason`) and "auto-adjust after clicking" (`analyzeStackCompatibility`) is elegant:
- **Pre-selection**: Only truly impossible options are disabled. User-facing reason strings are returned.
- **Post-selection**: Cascading adjustments happen automatically with toast feedback.
- The constraint evaluation follows a defined **dependency order** (upstream-to-downstream).

For PLG, this translates to:
- Pre-selection: "Can this plan include this feature?" / "Is this integration compatible with the selected tier?"
- Post-selection: "If they downgrade from Pro to Free, auto-remove gated features and notify."

### Pattern 4: Command/Output Generation as Pure Function

`generateStackCommand()` is a **pure function** from `StackState -> string`. It has no side effects and is called reactively. The mapping from state fields to CLI flags is explicit and auditable.

For PLG, the equivalent would be generating:
- Alchemy IaC configuration from builder selections
- Environment variable templates
- Integration code snippets

### Pattern 5: Presets as Complete State Snapshots

Presets are not partial overrides -- they are complete `StackState` objects. This avoids ambiguity about what a preset changes vs. what it leaves alone. For PLG, presets could represent:
- "Starter" (PostHog free + basic auth)
- "Growth" (PostHog + Stripe + feature flags)
- "Enterprise" (full stack with custom domains)

### Pattern 6: YOLO/Bypass Mode

The `yolo` toggle disables all constraints, letting power users make any combination. This is a useful escape hatch for when the constraint system is too conservative. For PLG, consider a similar "advanced mode" that shows all options regardless of plan/tier constraints.

### Pattern 7: Compatibility Analysis Returns Structured Results

Rather than throwing errors, `analyzeStackCompatibility` returns a structured result with `adjustedStack`, `notes`, and `changes`. The UI then decides how to present this (toasts, badges, etc.). This separation of analysis from presentation is clean.

### Anti-Patterns to Avoid

1. **The constraint function is ~650 lines of imperative if-statements.** This works but does not scale well. Consider a **declarative constraint DSL** or a rule engine for the PLG builder.
2. **No constraint graph visualization.** The dependency order is implicit in code flow, not explicitly modeled. Consider making the dependency DAG explicit for debugging and documentation.
3. **Adjustment detection relies on JSON stringify comparison** (`lastAppliedStackString.current`). This is fragile and could be replaced with a proper state diff.

### Summary Comparison Table

| Aspect | Better T Stack | PLG Builder (recommended) |
|--------|---------------|--------------------------|
| State management | URL params via `nuqs` | URL params via `nuqs` or Effect-based state |
| Option registry | `TECH_OPTIONS` constant | `PLG_OPTIONS` constant with richer metadata |
| Constraint model | Imperative if-chains | Declarative constraint rules (Effect Schema) |
| Output generation | CLI command string | IaC config + env vars + code snippets |
| Presets | Complete state snapshots | Complete state snapshots |
| Sharing | URL deep-links | URL deep-links |
| Bypass mode | YOLO toggle | Advanced/expert mode |
