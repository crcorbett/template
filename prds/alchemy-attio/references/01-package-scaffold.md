# 01 — Package Scaffolding

This reference specifies the exact directory structure and configuration files for `@packages/attio`.

## Directory Structure

```
packages/attio/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Barrel exports
│   ├── credentials.ts              # Auth credential management
│   ├── endpoint.ts                 # API base URL configuration
│   ├── errors.ts                   # Typed error classes
│   ├── category.ts                 # Error category system
│   ├── retry.ts                    # Retry policy definitions
│   ├── traits.ts                   # HTTP annotation system
│   ├── common.ts                   # Shared schemas
│   ├── client/
│   │   ├── api.ts                  # Core client (makeClient, makePaginated)
│   │   ├── operation.ts            # Operation type definitions
│   │   ├── request.ts              # Request interface
│   │   ├── request-builder.ts      # Schema → HTTP request serializer
│   │   ├── response.ts             # Response interface
│   │   └── response-parser.ts      # HTTP response → Schema deserializer
│   └── services/
│       ├── objects.ts
│       ├── records.ts
│       ├── lists.ts
│       ├── entries.ts
│       ├── attributes.ts
│       ├── select-options.ts
│       ├── notes.ts
│       ├── tasks.ts
│       ├── comments.ts
│       ├── webhooks.ts
│       ├── workspace-members.ts
│       └── self.ts
└── test/
    ├── test.ts                     # Test harness
    ├── self.test.ts
    ├── objects.test.ts
    ├── records.test.ts
    ├── lists.test.ts
    ├── entries.test.ts
    ├── attributes.test.ts
    ├── select-options.test.ts
    ├── notes.test.ts
    ├── tasks.test.ts
    ├── comments.test.ts
    ├── webhooks.test.ts
    ├── workspace-members.test.ts
    └── client/
        ├── request-builder.test.ts
        └── response-parser.test.ts
```

## package.json

```json
{
  "name": "@packages/attio",
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
    "./Retry": {
      "import": {
        "@packages/source": "./src/retry.ts",
        "types": "./dist/src/retry.d.ts",
        "default": "./dist/src/retry.js"
      }
    },
    "./Traits": {
      "import": {
        "@packages/source": "./src/traits.ts",
        "types": "./dist/src/traits.d.ts",
        "default": "./dist/src/traits.js"
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

- **`./*`** — wildcard maps to `src/services/*.ts`. Consumers import as `@packages/attio/records`.
- **`./Credentials`**, **`./Errors`**, **`./Retry`**, **`./Traits`** — infrastructure modules with PascalCase names.
- **`.`** — barrel export from `src/index.ts`.
- **`@packages/source`** — custom condition for live types in dev (no rebuild needed).

## tsconfig.json

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

## vitest.config.ts

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

1. Add to root `tsconfig.json` references:
   ```json
   { "path": "./packages/attio" }
   ```

2. Run `bun install` to link the workspace.

3. Reference from other packages (e.g., `@packages/alchemy-attio`):
   ```json
   { "@packages/attio": "workspace:*" }
   ```
