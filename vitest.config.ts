import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.context/**",
      "**/.output/**",
    ],
    projects: ["packages/*", "apps/*"],
  },
});
