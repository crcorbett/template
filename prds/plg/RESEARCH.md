# PLG Stack Research

## alchemy-effect Resource Class Props Are Static

Resource class definitions in alchemy-effect are plain static class declarations. Props are evaluated at class definition time (module load). This means:

- **Cannot use `yield*`** — class bodies are in strict mode, `yield` is not available
- **Cannot use `Config.string()`** — requires an Effect generator context
- **`Input<T>` accepts `T | Output<T>`** — allows binding to other resource outputs, but not Config values
- **Config values are only accessible** in `defineStages()` via `Effect.fn()` and in provider implementations

### Implication for Webhooks

Webhook `targetUrl` is typed as `string` (not `Input<string>`), so it cannot even accept an `Output<string>` binding. The URL must be a static string literal at definition time.

To make webhook URLs configurable per environment, you would need to:
1. Define a wrapper function that reads Config in an Effect generator
2. Dynamically construct the Webhook resource class with the resolved URL
3. Or use stage-specific stack files that import different URL constants

### Interface Cannot Extend Computed Index Access Types

TypeScript does not allow `interface Foo extends EventPayloads[typeof Events.SIGNUP_COMPLETED]` — the `extends` clause requires an identifier or qualified name, not a computed type expression. Use a type alias with intersection instead:

```typescript
// ✗ Fails: "An interface can only extend an identifier/qualified-name"
interface Params extends EventPayloads[typeof Events.SIGNUP_COMPLETED] {
  companyId: string;
}

// ✓ Works: type alias with intersection
type Params = EventPayloads[typeof Events.SIGNUP_COMPLETED] & {
  companyId: string;
};
```

This is relevant when building typed parameter objects that extend event payload schemas.

### DeploymentAnnotation Anti-Pattern

Using `new Date().toISOString()` in a resource prop is an anti-pattern because:
- The value changes on every module load
- Every `alchemy plan` / `alchemy diff` shows a change
- Annotations should be created as side effects of deploys, not as declarative resources
