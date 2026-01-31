# Research: Dynamic Builder UX for User-Defined Lists

> How interactive builder UIs handle dynamic user-defined lists that drive code generation.

## Context

The PLG builder requires users to define variable-length lists of:
- Pricing plans (name, price, billing interval, features)
- Feature flags (key, name, type, default value)
- Analytics events (key, name, category, payload properties)
- Survey questions (type, text, answer options)
- CRM attributes (name, type, target entity)

This research examines production UIs that solve these same problems.

---

## A. Production Builder UIs That Handle Dynamic Lists

### A.1 Stripe Pricing Table Builder

**How it works:** In the Stripe Dashboard (`Product catalog > Pricing tables > +Create pricing table`), users add products to a visual pricing table. The builder supports up to 4 products per pricing interval and 3 prices per product, with a maximum of 3 unique pricing intervals across all products.

**UX pattern:**
- Products are selected from existing catalog or created inline via a modal
- Each product card shows name, price, and interval
- Users can highlight one product (e.g., "Most popular")
- Display settings control look-and-feel (colors, font, button text)
- Output is an embeddable `<script>` tag + web component -- copy-paste into site

**Key takeaway:** Stripe imposes hard limits (max 4 products) which simplifies the UI. Items are cards in a horizontal row, not a scrollable list. The builder is purely visual -- no code preview, just a rendered preview of the pricing table plus a snippet to copy.

**Sources:**
- [Stripe: Embeddable Pricing Table docs](https://docs.stripe.com/payments/checkout/pricing-table)
- [Stripe: Manage products and prices](https://docs.stripe.com/products-prices/manage-prices)
- [Stripe: Tiered pricing setup](https://docs.stripe.com/subscriptions/pricing-models/tiered-pricing)

---

### A.2 PostHog Feature Flag Creation UI

**How it works:** PostHog's flag creation form has a single primary field: the **flag key** (e.g., `new-landing-page`). There is no separate "name" field that auto-generates a key -- the key *is* the identifier, typed directly by the user. A description field provides human context.

**Multivariate variants:** For multivariate flags, users add variant rows. Each variant has a key, an optional description, and a rollout percentage. The percentages must sum to 100%. Users can add/remove variant rows freely. Each variant can also carry a JSON payload for remote configuration.

**Key takeaway:** PostHog chose a key-first approach. The flag key is manually entered (no auto-derivation), which avoids the complexity of slug generation but puts more burden on the user. Variant management is a simple add/remove row pattern with percentage distribution.

**Notable:** There is an active GitHub issue (#26995) to consolidate boolean and multivariate flag interfaces, acknowledging that boolean flags are just a special case of multivariate (true/false variants).

**Sources:**
- [PostHog: Creating feature flags](https://posthog.com/docs/feature-flags/creating-feature-flags)
- [PostHog: Adding feature flag code](https://posthog.com/docs/feature-flags/adding-feature-flag-code)
- [GitHub issue: Consolidate boolean and multivariate flag interfaces](https://github.com/PostHog/posthog/issues/26995)

---

### A.3 Vercel Environment Variables UI

**How it works:** In project Settings > Environment Variables, users enter key-value pairs with environment checkboxes (Production, Preview, Development).

**UX pattern:**
- Single row with Key input, Value input, environment checkboxes
- "Add Another" button to batch multiple variables before saving
- Click "Save" to persist all at once
- Existing variables shown in a table below with three-dot menu (Edit / Remove)
- Values are encrypted at rest; view permissions are role-based

**Key takeaway:** Vercel uses the simplest possible pattern: a key-value input row with an "Add Another" button. No drag-and-drop, no reordering. Existing items shown in a flat table with inline actions. This works because env vars are unordered and each is independent.

**Sources:**
- [Vercel: Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel: Managing environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Vercel: Environment Variables UI blog post](https://vercel.com/blog/environment-variables-ui)

---

### A.4 Better T Stack Visual Builder

**How it works:** The web UI at `better-t-stack.dev/new` presents categories of options (Frontend, Backend, Database, ORM, Auth, Addons). Users click to select options within each category. The builder then generates the corresponding CLI command.

**UX pattern:**
- Options grouped by category in horizontal card rows
- Single-select for most categories (e.g., one database), multi-select for addons
- Addons are toggleable chips/cards: Turborepo, PWA, Tauri, Biome, Lefthook, Husky, Starlight, etc.
- Output is a CLI command string: `bun create better-t-stack@latest --frontend next --database postgres --orm drizzle --addons turborepo,pwa`
- The generated command is displayed for copy-paste and terminal execution

**Key takeaway:** Better T Stack separates the builder UI (web) from the executor (CLI). The web builder generates a command string, not code files. Options are finite and predefined (not user-defined), which is simpler than our use case. However, the "options -> generated command" pattern is directly applicable.

**Sources:**
- [Better T Stack: Visual Builder](https://better-t-stack.dev/new)
- [GitHub: create-better-t-stack](https://github.com/AmanVarshney01/create-better-t-stack)
- [Medium: Better T-Stack overview](https://medium.com/@raelsei/better-t-stack-the-minimalist-stack-builder-for-lightning-fast-web-development-d90b9e68d313)

---

### A.5 HubSpot CRM Custom Properties

**How it works:** In HubSpot Settings > Properties, users create custom properties for CRM objects (Contacts, Companies, Deals). Each property has a Label (human-readable) and an Internal Name (auto-generated, immutable after creation).

**UX pattern:**
- "Create property" button opens a multi-step modal
- Step 1: Object type selection, Group assignment, Label entry
- Internal name auto-generated from label (click code icon to view/customize)
- Step 2: Field type selection (Number, Text, Dropdown, Checkbox, Date, etc.)
- For enumeration types (dropdown, radio, multi-checkbox): add option rows with label/value pairs
- Properties listed in a searchable/filterable table
- Three-dot menu per row: Edit, Clone, Archive, Delete

**Key takeaway:** HubSpot's Label -> Internal Name pattern is the canonical example of name-to-key derivation. The internal name is shown via a secondary "code" icon toggle, and once saved it becomes immutable. This is exactly the pattern needed for feature flag keys and event names.

**Sources:**
- [HubSpot: Create and edit properties](https://knowledge.hubspot.com/properties/create-and-edit-properties)
- [HubSpot: Property field types](https://knowledge.hubspot.com/properties/property-field-types-in-hubspot)

---

### A.6 Typeform / SurveyJS Survey Builders

**Typeform:** Questions are added from a sidebar panel. Each question type (Multiple Choice, Short Text, etc.) is a card. Drag-and-drop reordering within the question list. For Multiple Choice, answer options are added/removed with +/x buttons and reordered via drag handles. Question Groups allow grouping related questions.

**SurveyJS (open-source alternative):** More advanced dynamic list support. The Creator UI allows adding, removing, rearranging form elements, grouping into categories, and custom icons. Supports nested field arrays (e.g., matrix rows with drag-and-drop reordering via `allowRowsDragAndDrop`).

**Key takeaway:** Survey builders are the closest analogy to our "add/remove items with sub-properties" pattern. The universal UX is: vertical list of cards, each expandable to edit properties, with + button at bottom and x button per card. Drag handles for reordering.

**Sources:**
- [Typeform: Question Groups](https://www.typeform.com/help/a/question-groups-360052316132/)
- [SurveyJS: Open-Source Form Builder](https://surveyjs.io/open-source)

---

### A.7 LaunchDarkly Feature Flag Creation

**How it works:** When creating a flag, you enter a human-readable **Name** and a **Key** auto-populates from the name. You can click "Edit key" to customize it. Once saved, the key is immutable (but the name can change anytime).

**Key convention enforcement:** Project settings allow specifying a required key format: camelCase, PascalCase, snake_case, or kebab-case. You can also require a specific prefix. LaunchDarkly enforces these conventions for all new flags.

**Key takeaway:** This is the gold-standard UX for name-to-key derivation: auto-populate with an "edit" toggle, plus organization-wide convention enforcement. The immutable-after-save rule prevents breaking references in code.

**Sources:**
- [LaunchDarkly: Creating new flags](https://launchdarkly.com/docs/home/flags/new)
- [LaunchDarkly: Flag conventions](https://launchdarkly.com/docs/guides/flags/flag-conventions)

---

## B. Key-from-Name Derivation Patterns

### B.1 The Standard Pattern

When a user types a human-readable name, the system derives a machine-safe key:

| Input Name | kebab-case slug | SCREAMING_SNAKE constant | camelCase key |
|---|---|---|---|
| Dark Mode | `dark-mode` | `DARK_MODE` | `darkMode` |
| Free Trial 30 Days | `free-trial-30-days` | `FREE_TRIAL_30_DAYS` | `freeTrial30Days` |
| Page Viewed | `page-viewed` | `PAGE_VIEWED` | `pageViewed` |
| Pro Plan ($99/mo) | `pro-plan-99-mo` | `PRO_PLAN_99_MO` | `proPlan99Mo` |

### B.2 JavaScript Slugify Libraries

**`slugify` (npm):** The most popular option. Vanilla ES2015, no dependencies, works in browser. Supports custom separators (`-` or `_`), locale-aware transliteration, strict mode to strip special characters.

```typescript
import slugify from 'slugify'

slugify('Dark Mode')           // 'Dark-Mode'
slugify('Dark Mode', { lower: true }) // 'dark-mode'
slugify('Dark Mode', '_')      // 'Dark_Mode'
```

**`@sindresorhus/slugify`:** 2.3k stars, handles major languages (German umlauts, Vietnamese, Arabic, Russian). Better for internationalized inputs.

**Lodash `kebabCase` / `snakeCase` / `camelCase`:** Built-in case transforms. `_.kebabCase('Dark Mode')` -> `'dark-mode'`, `_.snakeCase('Dark Mode').toUpperCase()` -> `'DARK_MODE'`.

**Vanilla approach:**
```typescript
function toSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
```

**Sources:**
- [npm: slugify](https://www.npmjs.com/package/slugify)
- [DEV.to: How to slugify a string in JavaScript](https://dev.to/bybydev/how-to-slugify-a-string-in-javascript-4o9n)

### B.3 Should Users Be Able to Override the Derived Key?

**Yes, with caveats.** Every production system reviewed allows override:

| System | Auto-derive? | Override? | Immutable after save? |
|---|---|---|---|
| LaunchDarkly | Yes (name -> key) | Yes ("Edit key" toggle) | Yes |
| HubSpot | Yes (label -> internal name) | Yes (click code icon) | Yes |
| Sanity CMS | Yes ("Generate" button) | Yes (editable text field) | No (but warns about SEO) |
| PostHog | No (key-first entry) | N/A | N/A |

**Recommended UX for our builder:**
1. Auto-derive key from name as user types (debounced)
2. Show derived key in a secondary field with muted styling
3. Provide a "lock/unlock" or "edit" toggle to allow override
4. Once overridden, stop auto-deriving (user owns the key)
5. Validate uniqueness in real-time within the current list

### B.4 Handling Key Collisions

When two items generate the same key, there are several strategies:

**1. Auto-suffix (CMS pattern):** `dark-mode` -> `dark-mode-2` -> `dark-mode-3`. Used by WordPress, Sanity, Payload CMS. Simple but produces ugly keys.

**2. Real-time validation error (form pattern):** Show inline error: "This key is already in use by [other item name]." Block save until resolved. Used by LaunchDarkly, HubSpot. Preferred for developer-facing tools where key quality matters.

**3. Namespace by type (advanced):** Feature flag keys and event keys live in different namespaces, so `dark-mode` can exist as both a flag key and an event key without collision. Only check within the same list.

**Recommended approach:** Real-time validation error with a helpful message. For our builder, since all lists are in-memory, collision detection is instant -- just scan the current array.

**Sources:**
- [URL Slug pattern (Data Incubator)](https://patterns.dataincubator.org/book/url-slug.html)
- [Payload CMS: Slugs and SKUs with uniqueness](https://www.buildwithmatija.com/blog/payload-cms-slugs-and-skus)
- [Sanity: Slug type docs](https://www.sanity.io/docs/studio/slug-type)

---

## C. Code Preview UX

### C.1 Do Builders Show Live Code Preview?

| Builder | Live preview? | What is shown? |
|---|---|---|
| Better T Stack | Yes | CLI command string |
| Stripe Pricing Table | Yes | Rendered pricing table visual + embed snippet |
| v0 (Vercel) | Yes | Split-pane: prompt/code on left, rendered component on right |
| Shadcn Registry | No (build step) | JSON output via `shadcn build` |
| Bolt.new | Yes | Split-pane: code editor + live app preview |

**Trend:** Modern builder UIs overwhelmingly use live preview. The split-pane pattern (config on left, output on right) is dominant. For code-generating builders specifically, the output is typically syntax-highlighted code that updates in real-time.

### C.2 Split-Pane Implementation

The standard layout:
- **Left panel:** Configuration form (inputs, toggles, dynamic lists)
- **Right panel:** Generated code preview with syntax highlighting
- **Resizable divider** between panels (often via CSS `resize` or a drag handle)
- **Responsive:** On mobile, panels stack vertically or the preview becomes a toggleable tab

**Code highlighting libraries for React:**
- **Shiki:** Used by shadcn/ui components. Async highlighting that does not block rendering. 100+ language support. Used in the shadcn Code Block component with line numbers and copy button.
- **Prism / react-prism-renderer:** Lightweight, widely used. Theme support via CSS.
- **CodeMirror / Monaco:** Full editors, overkill for read-only preview but useful if users need to edit generated code.

**Sources:**
- [shadcn: Code Block component](https://www.shadcn.io/components/code/code-block)
- [shadcn: React AI Code Block (streaming-friendly)](https://www.shadcn.io/ai/code-block)

### C.3 Diff Highlighting When Items Change

When a user adds/removes an item, showing what changed in the code preview is valuable. Options:

- **Full re-render:** Simply re-render the entire code block. Simplest, works well for small outputs.
- **Line highlighting:** Highlight added lines in green, removed lines in red (git diff style). Libraries like `react-diff-viewer` or Shiki's line highlighting API support this.
- **Animation:** Fade-in new lines, fade-out removed lines. The shadcn animated code editor component (built with Shiki + Motion) supports typing animations and could be adapted.

**Recommendation:** For a PLG builder, full re-render with optional "show diff" toggle is sufficient. The generated code is typically small (50-200 lines), so diff highlighting adds polish but is not critical for usability.

### C.4 Output Modes

Production builders offer multiple output modes:

| Mode | Use case | Example |
|---|---|---|
| Copy to clipboard | Quick paste into existing project | Better T Stack, Stripe |
| Download file(s) | Save generated config/code files | shadcn `add` command |
| Install via CLI | Run a command that scaffolds code | `npx shadcn@latest add button` |
| Open in editor | Direct IDE integration | v0 "Open in VS Code" |

**Recommendation for PLG builder:**
1. **Primary:** "Copy to clipboard" with per-file tabs (e.g., `config.ts`, `flags.ts`, `events.ts`)
2. **Secondary:** "Download as zip" for the full generated package
3. **Advanced:** CLI command (`npx create-plg-stack@latest --config <base64>`) that reads the builder state from a URL parameter

---

## D. Undo/Redo and State Persistence

### D.1 Undo/Redo for List Operations

**The past/present/future pattern** is the standard approach:

```typescript
interface UndoState<T> {
  past: T[]      // previous states (stack)
  present: T     // current state
  future: T[]    // states after undo (for redo)
}
```

**Production libraries for React:**

| Library | Pattern | Best for |
|---|---|---|
| `useHistoryState` (@uidotdev/usehooks) | Simple hook | Quick setup, small state |
| `useUndoable` (xplato) | Hook with configurable behaviors | Async data, history limits |
| `react-undo-redo` (frontendphil) | Reducer wrapper | Reducer-based apps, selective tracking |
| `redux-undo` (omnidan) | Higher-order reducer | Redux apps |

**Command pattern (Kapwing):** For complex builders, each action (add item, remove item, reorder) is an object with `undo` and `redo` functions. This is more flexible than snapshotting entire state and allows for efficient undo of individual operations.

```typescript
interface UndoEntry {
  undo: (() => void) | Action   // function or dispatchable action
  redo: (() => void) | Action
  description: string           // "Added pricing plan 'Pro'"
}
```

**Recommendation:** For a PLG builder with multiple independent lists, the simplest approach is `useHistoryState` wrapping the entire builder state. If performance becomes an issue (large state snapshots), switch to the command pattern. Set a history limit (e.g., 50 entries) to prevent memory bloat.

**Sources:**
- [useHistoryState (usehooks.com)](https://usehooks.com/usehistorystate)
- [useUndoable (GitHub)](https://github.com/xplato/useUndoable)
- [Kapwing: How to implement undo in React + Redux](https://www.kapwing.com/blog/how-to-implement-undo-in-a-react-redux-application/)
- [redux-undo (GitHub)](https://github.com/omnidan/redux-undo)

### D.2 State Persistence

**LocalStorage:** The simplest persistence mechanism. Serialize builder state to JSON and save on every change (debounced). Restore on page load. Works offline. Risk: stale state if schema changes between versions.

**URL parameter encoding:** Enables shareable links. Several encoding strategies:

| Strategy | Pros | Cons |
|---|---|---|
| Individual query params | Human-readable, easy to parse | Does not scale for lists |
| Repeated params (`?flag=a&flag=b`) | Simple lists | No nested structure |
| JSON in single param (`?config={...}`) | Full fidelity | URL-encoded JSON is ugly, length limits |
| Base64-encoded JSON (`?c=eyJmb...`) | Compact, hides complexity | Opaque, not human-readable |
| Compressed Base64 (lz-string) | Very compact | Extra dependency, fully opaque |

**`nuqs` library (recommended for React):** Type-safe URL state management. Used by Sentry, Supabase, Vercel, Clerk. Supports parsers (integer, boolean, date, JSON), debouncing/throttling, builder pattern for defaults, and works with Next.js App Router, Remix, React Router, and TanStack Router.

```typescript
import { useQueryState, parseAsJson } from 'nuqs'
import { z } from 'zod'

const configSchema = z.object({
  plans: z.array(z.object({ name: z.string(), price: z.number() })),
  flags: z.array(z.object({ key: z.string(), type: z.enum(['boolean', 'multivariate']) })),
})

const [config, setConfig] = useQueryState(
  'c',
  parseAsJson(configSchema.parse)
    .withDefault({ plans: [], flags: [] })
)
```

**Recommendation:** Use a hybrid approach:
1. **Primary persistence:** `nuqs` with base64-encoded JSON for shareable URLs
2. **Backup persistence:** LocalStorage auto-save (debounced 1s) for crash recovery
3. **URL format:** `?c=<base64-encoded-lz-compressed-json>` for compact shareable links
4. **Named saves:** Allow users to name and save configurations (stored in LocalStorage as a list)

**Sources:**
- [nuqs: Type-safe URL state management](https://nuqs.dev/)
- [GitHub: 47ng/nuqs](https://github.com/47ng/nuqs)
- [InfoQ: React Advanced 2025 -- nuqs](https://www.infoq.com/news/2025/12/nuqs-react-advanced/)
- [use-query-params (GitHub)](https://github.com/pbeshai/use-query-params)

### D.3 Form State for Dynamic Lists

**React Hook Form `useFieldArray`** is the standard pattern for managing dynamic lists in React forms:

```typescript
const { fields, append, remove, move } = useFieldArray({
  control,
  name: 'pricingPlans'
})
```

Provides: `append()`, `remove()`, `insert()`, `swap()`, `move()`, `prepend()`, `update()`, `replace()`. Auto-generates unique `id` per item for React keys. Integrates with Zod/Yup validation via resolvers.

**Key rule:** Use `field.id` (not array index) as the React key to prevent re-render issues on remove/reorder.

**Sources:**
- [React Hook Form: useFieldArray](https://react-hook-form.com/docs/usefieldarray)

---

## E. Synthesis: Recommended Architecture for PLG Builder

### E.1 Dynamic List UX Pattern

Each list section (plans, flags, events, surveys, CRM attributes) should use the same component pattern:

```
+--------------------------------------------------+
| Feature Flags                             [+ Add] |
+--------------------------------------------------+
| [drag] Dark Mode                    [edit] [x]   |
|         Key: dark-mode  Type: boolean             |
+--------------------------------------------------+
| [drag] Pricing Experiment           [edit] [x]   |
|         Key: pricing-experiment  Type: multivariate|
+--------------------------------------------------+
| [drag] Beta Access                  [edit] [x]   |
|         Key: beta-access  Type: percentage        |
+--------------------------------------------------+
```

- Collapsed view shows name + key + type
- Click to expand and edit all fields
- Drag handle on left for reordering
- Delete (x) button on right with confirmation
- "+ Add" button at section header

### E.2 Name-to-Key Derivation

```typescript
function deriveKey(name: string, format: 'kebab' | 'snake' | 'screaming_snake' | 'camel'): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  switch (format) {
    case 'kebab': return slug
    case 'snake': return slug.replace(/-/g, '_')
    case 'screaming_snake': return slug.replace(/-/g, '_').toUpperCase()
    case 'camel': return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
  }
}
```

Per-list key format defaults:
- Feature flags: `kebab-case` (PostHog convention)
- Analytics events: `snake_case` (PostHog convention)
- Pricing plans: `kebab-case` (URL-safe identifiers)
- CRM attributes: `snake_case` (HubSpot convention)

### E.3 State Architecture

```typescript
interface BuilderState {
  plans: PricingPlan[]
  flags: FeatureFlag[]
  events: AnalyticsEvent[]
  surveys: SurveyQuestion[]
  crmAttributes: CrmAttribute[]
}

// Use react-hook-form + useFieldArray for each list
// Use nuqs for URL persistence
// Use useHistoryState wrapper for undo/redo
// Use Shiki for code preview syntax highlighting
```

### E.4 Code Preview Layout

```
+----------------------------+----------------------------+
|  Configuration Panel       |  Code Preview              |
|                            |                            |
|  [Pricing Plans]           |  // config.ts              |
|    + Pro Plan              |  export const config = {   |
|    + Free Plan             |    plans: [                |
|                            |      { name: 'Pro', ... }, |
|  [Feature Flags]           |      { name: 'Free', ...},|
|    + Dark Mode             |    ],                      |
|    + Beta Access           |    flags: [                |
|                            |      { key: 'dark-mode' }, |
|  [Analytics Events]        |      { key: 'beta-access'}|
|    + Page Viewed           |    ],                      |
|    + Button Clicked        |    events: [...]           |
|                            |  }                         |
|                            |                            |
|                            |  [Copy] [Download] [CLI]   |
+----------------------------+----------------------------+
```

---

## F. Open Questions

1. **Should the builder support templates/presets?** e.g., "SaaS Starter" pre-populates Free/Pro/Enterprise plans + common flags. This would reduce initial friction.

2. **How to handle cross-list references?** e.g., a pricing plan that references feature flags ("Pro plan includes dark-mode flag"). This adds complexity but enables richer code generation.

3. **Should code preview show multiple files or one merged output?** Multiple tabs (one per file) is cleaner but requires tab UI. Single file is simpler but can get long.

4. **Real-time validation vs. validate-on-generate?** Real-time validation (inline errors as user types) is better UX but adds complexity. Validate-on-generate is simpler but users discover errors late.
