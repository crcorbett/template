# Reference: Resource Barrel Export

Source: `packages/alchemy-posthog/src/posthog/feature-flags/index.ts`

The barrel export for a resource module. The side-effect import of `"../config"` ensures the StageConfig module augmentation is loaded.

```typescript
import "../config";

export * from "./feature-flag";
export * from "./feature-flag.provider";
```
