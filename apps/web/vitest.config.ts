import tsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  resolve: {
    conditions: ["@packages/source"],
  },
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**"],
    environment: "node",
  },
});
