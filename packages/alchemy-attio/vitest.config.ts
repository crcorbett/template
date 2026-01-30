import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
  resolve: {
    conditions: ["@packages/source", "import", "default"],
    alias: {
      // Map @/* to src/* for test imports
      "@": path.resolve(__dirname, "src"),
      // Map @packages/attio/* to the actual source files
      "@packages/attio/objects": path.resolve(
        __dirname,
        "../attio/src/services/objects.ts"
      ),
      "@packages/attio/records": path.resolve(
        __dirname,
        "../attio/src/services/records.ts"
      ),
      "@packages/attio/lists": path.resolve(
        __dirname,
        "../attio/src/services/lists.ts"
      ),
      "@packages/attio/entries": path.resolve(
        __dirname,
        "../attio/src/services/entries.ts"
      ),
      "@packages/attio/attributes": path.resolve(
        __dirname,
        "../attio/src/services/attributes.ts"
      ),
      "@packages/attio/select-options": path.resolve(
        __dirname,
        "../attio/src/services/select-options.ts"
      ),
      "@packages/attio/statuses": path.resolve(
        __dirname,
        "../attio/src/services/statuses.ts"
      ),
      "@packages/attio/notes": path.resolve(
        __dirname,
        "../attio/src/services/notes.ts"
      ),
      "@packages/attio/tasks": path.resolve(
        __dirname,
        "../attio/src/services/tasks.ts"
      ),
      "@packages/attio/webhooks": path.resolve(
        __dirname,
        "../attio/src/services/webhooks.ts"
      ),
      "@packages/attio/Credentials": path.resolve(
        __dirname,
        "../attio/src/credentials.ts"
      ),
      "@packages/attio": path.resolve(__dirname, "../attio/src/index.ts"),
    },
  },
});
