import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  server: {
    port: 3000,
  },
  resolve: {
    conditions: ["@packages/source"],
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
    command === "build" ? nitro({ preset: "bun" }) : null,
    viteReact(),
  ],
}));
