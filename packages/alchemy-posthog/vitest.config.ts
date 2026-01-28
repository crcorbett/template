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
      // Map @packages/posthog/* to the actual source files
      "@packages/posthog/feature-flags": path.resolve(
        __dirname,
        "../posthog/src/services/feature-flags.ts"
      ),
      "@packages/posthog/Credentials": path.resolve(
        __dirname,
        "../posthog/src/credentials.ts"
      ),
      "@packages/posthog": path.resolve(__dirname, "../posthog/src/index.ts"),
    },
  },
});
