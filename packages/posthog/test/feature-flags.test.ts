import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createFeatureFlag,
  deleteFeatureFlag,
  getFeatureFlag,
  listFeatureFlags,
  updateFeatureFlag,
} from "../src/services/feature-flags.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

describe("PostHog Feature Flags Service", () => {
  describe("integration tests", () => {
    test("should list feature flags", () =>
      Effect.gen(function* () {
        const result = yield* listFeatureFlags({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const flagKey = `test-flag-${Date.now()}`;

        const created = yield* createFeatureFlag({
          project_id: TEST_PROJECT_ID,
          key: flagKey,
          name: "Integration test flag",
          active: false,
          filters: {
            groups: [
              {
                properties: [],
                rollout_percentage: 100,
              },
            ],
          },
        });

        expect(created).toBeDefined();
        expect(created.id).toBeDefined();
        expect(created.key).toBe(flagKey);
        expect(created.name).toBe("Integration test flag");
        expect(created.active).toBe(false);

        const fetched = yield* getFeatureFlag({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(fetched.id).toBe(created.id);
        expect(fetched.key).toBe(flagKey);

        const updated = yield* updateFeatureFlag({
          project_id: TEST_PROJECT_ID,
          id: created.id,
          name: "Updated flag name",
          active: true,
        });

        expect(updated.name).toBe("Updated flag name");
        expect(updated.active).toBe(true);

        const deleted = yield* deleteFeatureFlag({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(deleted.deleted).toBe(true);
      }));
  });
});
