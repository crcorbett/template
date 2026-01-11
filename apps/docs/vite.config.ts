import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => ({
  server: {
    port: 3001,
  },
  resolve: {
    conditions: ["@packages/source"],
  },
  plugins: [
    mdx(await import("./source.config")),
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    mkcert(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
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
  ],
}));
