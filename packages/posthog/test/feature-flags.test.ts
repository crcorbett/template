import { describe, expect } from "@effect/vitest";
import { Chunk, Effect, Stream } from "effect";

import {
  createFeatureFlag,
  deleteFeatureFlag,
  FeatureFlag,
  getFeatureFlag,
  listFeatureFlags,
  updateFeatureFlag,
} from "../src/services/feature-flags.js";
import { test, TEST_PROJECT_ID, withResource } from "./test.js";

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

        yield* withResource({
          acquire: createFeatureFlag({
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
          }),
          use: (created) =>
            Effect.gen(function* () {
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
            }),
          release: (created) =>
            deleteFeatureFlag({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create flag with rollout percentage", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createFeatureFlag({
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
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.filters).toBeDefined();
            }),
          release: (created) =>
            deleteFeatureFlag({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create flag with property filters", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createFeatureFlag({
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
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.filters).toBeDefined();
            }),
          release: (created) =>
            deleteFeatureFlag({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should toggle flag active state", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createFeatureFlag({
            project_id: projectId,
            key: `test-toggle-${Date.now()}`,
            name: "Toggle test",
            active: false,
          }),
          use: (created) =>
            Effect.gen(function* () {
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
            }),
          release: (created) =>
            deleteFeatureFlag({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
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

    test("should stream pages via listFeatureFlags.pages()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const pages = yield* listFeatureFlags
          .pages({
            project_id: projectId,
            limit: 2,
          })
          .pipe(Stream.take(2), Stream.runCollect);

        const pageArray = Chunk.toReadonlyArray(pages);
        expect(pageArray.length).toBeGreaterThanOrEqual(1);
        expect(pageArray[0].results).toBeDefined();
        expect(Array.isArray(pageArray[0].results)).toBe(true);
      }));

    test("should stream items via listFeatureFlags.items()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const items = yield* listFeatureFlags
          .items({
            project_id: projectId,
            limit: 2,
          })
          .pipe(Stream.take(3), Stream.runCollect);

        const itemArray = Chunk.toReadonlyArray(items);
        expect(itemArray.length).toBeGreaterThanOrEqual(1);
        expect(itemArray.length).toBeLessThanOrEqual(3);
        // Verify items are FeatureFlag objects
        if (itemArray.length > 0) {
          const firstItem = itemArray[0] as FeatureFlag;
          expect(firstItem.id).toBeDefined();
        }
      }));
  });
});
