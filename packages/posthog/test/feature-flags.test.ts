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

const cleanup = (id: number) =>
  deleteFeatureFlag({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

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

    test("should filter feature flags by active status", () =>
      Effect.gen(function* () {
        const activeFlags = yield* listFeatureFlags({
          project_id: TEST_PROJECT_ID,
          active: "true",
          limit: 10,
        });

        expect(activeFlags.results).toBeDefined();
        for (const flag of activeFlags.results) {
          expect(flag.active).toBe(true);
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const flagKey = `test-flag-${Date.now()}`;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
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
          createdId = created.id;

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
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create flag with rollout percentage", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: TEST_PROJECT_ID,
            key: `test-rollout-${Date.now()}`,
            name: "Rollout test flag",
            active: true,
            filters: {
              groups: [
                {
                  properties: [],
                  rollout_percentage: 50,
                },
              ],
            },
          });
          createdId = created.id;

          expect(created.filters).toBeDefined();

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create flag with property filters", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: TEST_PROJECT_ID,
            key: `test-filtered-${Date.now()}`,
            name: "Filtered flag",
            active: true,
            filters: {
              groups: [
                {
                  properties: [
                    {
                      key: "$browser",
                      type: "person",
                      value: ["Chrome"],
                      operator: "exact",
                    },
                  ],
                  rollout_percentage: 100,
                },
              ],
            },
          });
          createdId = created.id;

          expect(created.filters).toBeDefined();

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should toggle flag active state", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: TEST_PROJECT_ID,
            key: `test-toggle-${Date.now()}`,
            name: "Toggle test",
            active: false,
          });
          createdId = created.id;

          expect(created.active).toBe(false);

          const activated = yield* updateFeatureFlag({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            active: true,
          });
          expect(activated.active).toBe(true);

          const deactivated = yield* updateFeatureFlag({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            active: false,
          });
          expect(deactivated.active).toBe(false);

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should handle flag not found", () =>
      Effect.gen(function* () {
        const result = yield* getFeatureFlag({
          project_id: TEST_PROJECT_ID,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
