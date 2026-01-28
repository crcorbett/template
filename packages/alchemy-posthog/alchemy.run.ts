import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import {
  type StageConfig,
  defineStack,
  defineStages,
  USER,
} from "alchemy-effect";
import * as PostHog from "./src/posthog/index.js";
import { FeatureFlag } from "./src/posthog/feature-flags/index.js";

const stages = defineStages(
  Effect.fn(function* () {
    return {
      posthog: {
        projectId: yield* Config.string("POSTHOG_PROJECT_ID"),
      },
    } satisfies StageConfig;
  }),
);

// Feature Flags

export class DarkMode extends FeatureFlag("DarkMode", {
  key: "dark-mode",
  name: "Dark Mode",
  active: true,
  rolloutPercentage: 100,
}) {}

export class BetaSignup extends FeatureFlag("BetaSignup", {
  key: "beta-signup",
  name: "Beta Signup Flow",
  active: true,
  rolloutPercentage: 50,
}) {}

export class NewCheckout extends FeatureFlag("NewCheckout", {
  key: "new-checkout",
  name: "New Checkout Experience",
  active: false,
  rolloutPercentage: 0,
}) {}

// Stack

export const MyPostHogApp = stages
  .ref<typeof stack>("posthog-feature-flags")
  .as({
    prod: "prod",
    staging: "staging",
    dev: (user: USER = USER) => `dev_${user}`,
  });

const stack = defineStack({
  name: "posthog-feature-flags",
  stages,
  resources: [DarkMode, BetaSignup, NewCheckout],
  providers: PostHog.providers(),
  tap: (outputs) =>
    Effect.log(
      `Feature flags deployed: ${Object.keys(outputs).join(", ")}`,
    ),
});

export default stack;
