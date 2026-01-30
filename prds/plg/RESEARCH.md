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

### DeploymentAnnotation Anti-Pattern

Using `new Date().toISOString()` in a resource prop is an anti-pattern because:
- The value changes on every module load
- Every `alchemy plan` / `alchemy diff` shows a change
- Annotations should be created as side effects of deploys, not as declarative resources
