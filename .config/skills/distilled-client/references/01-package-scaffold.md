# Package Scaffolding Reference

This reference contains the exact configuration files needed to scaffold a new distilled client package.

## Directory Structure

```
packages/<service>/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── credentials.ts
│   ├── endpoint.ts
│   ├── errors.ts
│   ├── category.ts
│   ├── retry.ts
│   ├── traits.ts
│   ├── common.ts
│   ├── client/
│   │   ├── api.ts
│   │   ├── operation.ts
│   │   ├── request.ts
│   │   ├── request-builder.ts
│   │   ├── response.ts
│   │   └── response-parser.ts
│   └── services/
│       └── <resource>.ts   (one per API resource)
└── test/
    ├── test.ts             (test harness)
    ├── <resource>.test.ts  (one per service)
    └── client/
        ├── request-builder.test.ts
        └── response-parser.test.ts
```

## package.json Template

Replace `<service>` and `<SERVICE>` with your service name (e.g., `stripe`, `STRIPE`).

```json
{
  "name": "@packages/<service>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./*": {
      "import": {
        "@packages/source": "./src/services/*.ts",
        "types": "./dist/src/services/*.d.ts",
        "default": "./dist/src/services/*.js"
      }
    },
    "./Credentials": {
      "import": {
        "@packages/source": "./src/credentials.ts",
        "types": "./dist/src/credentials.d.ts",
        "default": "./dist/src/credentials.js"
      }
    },
    "./Errors": {
      "import": {
        "@packages/source": "./src/errors.ts",
        "types": "./dist/src/errors.d.ts",
        "default": "./dist/src/errors.js"
      }
    },
    "./Traits": {
      "import": {
        "@packages/source": "./src/traits.ts",
        "types": "./dist/src/traits.d.ts",
        "default": "./dist/src/traits.js"
      }
    },
    "./Retry": {
      "import": {
        "@packages/source": "./src/retry.ts",
        "types": "./dist/src/retry.d.ts",
        "default": "./dist/src/retry.js"
      }
    },
    ".": {
      "import": {
        "@packages/source": "./src/index.ts",
        "types": "./dist/src/index.d.ts",
        "default": "./dist/src/index.js"
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "effect": "^3.16.0",
    "@effect/platform": "^0.82.0"
  },
  "devDependencies": {
    "@effect/platform": "^0.82.0",
    "@effect/platform-node": "0.74.0",
    "@effect/vitest": "^0.18.0",
    "@vitest/coverage-v8": "^3.0.0",
    "effect": "^3.16.0",
    "typescript": "catalog:typescript",
    "vitest": "^3.0.0"
  }
}
```

### Export Conventions

- **`./*`** — wildcard maps to `src/services/*.ts`. Consumers import as `@packages/<service>/dashboards`.
- **`./Credentials`**, **`./Errors`**, **`./Retry`**, **`./Traits`** — infrastructure modules with PascalCase names.
- **`.`** — barrel export from `src/index.ts`.
- **`@packages/source`** — custom condition for live types in dev (no rebuild needed). Resolved by the monorepo's `customConditions` in `tsconfig.base.json`.

## tsconfig.json Template

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## vitest.config.ts Template

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
});
```

## Monorepo Registration

After creating the package:

1. Add to root `tsconfig.json` references:
   ```json
   { "path": "./packages/<service>" }
   ```

2. Run `bun install` to link the workspace.

3. Reference from other packages via:
   ```json
   { "@packages/<service>": "workspace:*" }
   ```

## Live Types Mechanism

The `@packages/source` custom export condition is resolved by:
- `tsconfig.base.json` → `customConditions: ["@packages/source"]`
- Vite/vitest configs → `resolve.conditions: ["@packages/source"]`

During development, TypeScript resolves directly to `.ts` source files. In production builds, it falls back to compiled `.d.ts` + `.js` in `dist/`.
