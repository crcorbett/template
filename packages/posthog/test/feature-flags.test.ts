import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createFeatureFlag,
  deleteFeatureFlag,
  getFeatureFlag,
  listFeatureFlags,
  updateFeatureFlag,
} from "../src/services/feature-flags.js";
import { test, TEST_PROJECT_ID } from "./test.js";

const cleanup = (project_id: string, id: number) =>
  deleteFeatureFlag({ project_id, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

describe("PostHog Feature Flags Service", () => {
  describe("integration tests", () => {
    test("should list feature flags", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listFeatureFlags({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should filter feature flags by active status", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const activeFlags = yield* listFeatureFlags({
          project_id: projectId,
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
        const projectId = yield* TEST_PROJECT_ID;
        const flagKey = `test-flag-${Date.now()}`;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: projectId,
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
            project_id: projectId,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.key).toBe(flagKey);

          const updated = yield* updateFeatureFlag({
            project_id: projectId,
            id: created.id,
            name: "Updated flag name",
            active: true,
          });

          expect(updated.name).toBe("Updated flag name");
          expect(updated.active).toBe(true);

          const deleted = yield* deleteFeatureFlag({
            project_id: projectId,
            id: created.id,
          });

          expect(deleted.deleted).toBe(true);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined
              ? cleanup(projectId, createdId)
              : Effect.void
          )
        );
      }));

    test("should create flag with rollout percentage", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: projectId,
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

          yield* cleanup(projectId, created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined
              ? cleanup(projectId, createdId)
              : Effect.void
          )
        );
      }));

    test("should create flag with property filters", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: projectId,
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

          yield* cleanup(projectId, created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined
              ? cleanup(projectId, createdId)
              : Effect.void
          )
        );
      }));

    test("should toggle flag active state", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createFeatureFlag({
            project_id: projectId,
            key: `test-toggle-${Date.now()}`,
            name: "Toggle test",
            active: false,
          });
          createdId = created.id;

          expect(created.active).toBe(false);

          const activated = yield* updateFeatureFlag({
            project_id: projectId,
            id: created.id,
            active: true,
          });
          expect(activated.active).toBe(true);

          const deactivated = yield* updateFeatureFlag({
            project_id: projectId,
            id: created.id,
            active: false,
          });
          expect(deactivated.active).toBe(false);

          yield* cleanup(projectId, created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined
              ? cleanup(projectId, createdId)
              : Effect.void
          )
        );
      }));

    test("should handle flag not found", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* getFeatureFlag({
          project_id: projectId,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
