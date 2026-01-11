import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import path from "node:path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  server: {
    port: 3001,
  },
  resolve: {
    conditions: ["@packages/source"],
    alias: {
      // Resolve @packages/ui internal paths when consuming source files
      "@/lib": path.resolve(__dirname, "../../packages/ui/src/lib"),
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    mkcert(),
    tanstackStart({
      srcDirectory: "src",
    }),
    // Nitro disabled in dev due to HTTP/2 + Transfer-Encoding bug with Bun
    // https://github.com/TanStack/router/issues/6050
    command === "build"
      ? nitro({
          preset: "vercel",
          vercel: {
            functions: {
              runtime: "bun1.x",
            },
          },
        })
      : null,
    viteReact(),
  ],
}));
