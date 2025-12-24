import type { Plugin } from "@opencode-ai/plugin";

export const HooksPlugin: Plugin = async ({ $, client }) => ({
  event: async ({ event }) => {
    if (event.type === "file.edited") {
      await client.tui.showToast({
        body: { message: "Running turbo fix...", variant: "info" },
      });
      const result = await $`turbo fix`.quiet().nothrow();
      if (result.exitCode === 0) {
        await client.tui.showToast({
          body: { message: "Turbo fix successful", variant: "success" },
        });
      } else {
        await client.tui.showToast({
          body: { message: "Turbo fix failed", variant: "error" },
        });
      }
    }
    if (event.type === "session.idle") {
      await client.tui.showToast({
        body: { message: "Running turbo check-types...", variant: "info" },
      });
      const result = await $`turbo check-types`.quiet().nothrow();
      if (result.exitCode === 0) {
        await client.tui.showToast({
          body: { message: "Type check successful", variant: "success" },
        });
      } else {
        await client.tui.showToast({
          body: { message: "Type check failed", variant: "error" },
        });
      }
    }
  },
});
