import type { Plugin } from "@opencode-ai/plugin";

export const HooksPlugin: Plugin = () => {
  return Promise.resolve({
    event: async () => {
      // Hooks disabled - turbo fix/check-types no longer auto-run
    },
  });
};
