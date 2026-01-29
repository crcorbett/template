import { describe, expect } from "@effect/vitest";
import { Chunk, Effect, Stream } from "effect";

import {
  createExperiment,
  deleteExperiment,
  type Experiment,
  getExperiment,
  listExperiments,
  updateExperiment,
} from "../src/services/experiments.js";
import {
  createFeatureFlag,
  deleteFeatureFlag,
} from "../src/services/feature-flags.js";
import { test, TEST_PROJECT_ID, withResource } from "./test.js";

describe("PostHog Experiments Service", () => {
  describe("integration tests", () => {
    test("should list experiments", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listExperiments({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list experiments with pagination", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const firstPage = yield* listExperiments({
          project_id: projectId,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listExperiments({
            project_id: projectId,
            limit: 2,
            offset: 2,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const timestamp = Date.now();
        const experimentName = `test-experiment-${timestamp}`;
        const flagKey = `test-exp-flag-${timestamp}`;

        yield* withResource({
          acquire: createFeatureFlag({
            project_id: projectId,
            key: flagKey,
            name: `Test Experiment Flag ${timestamp}`,
            filters: {
              groups: [
                {
                  properties: [],
                  rollout_percentage: 100,
                },
              ],
              multivariate: {
                variants: [
                  { key: "control", rollout_percentage: 50 },
                  { key: "test", rollout_percentage: 50 },
                ],
              },
            },
          }),
          use: (flag) =>
            withResource({
              acquire: createExperiment({
                project_id: projectId,
                name: experimentName,
                description: "Integration test experiment",
                feature_flag_key: flagKey,
              }),
              use: (created) =>
                Effect.gen(function* () {
                  expect(created).toBeDefined();
                  expect(created.id).toBeDefined();
                  expect(created.name).toBe(experimentName);
                  expect(created.description).toBe(
                    "Integration test experiment"
                  );
                  expect(created.feature_flag_key).toBe(flagKey);

                  // Read
                  const fetched = yield* getExperiment({
                    project_id: projectId,
                    id: created.id,
                  });

                  expect(fetched.id).toBe(created.id);
                  expect(fetched.name).toBe(experimentName);

                  // Update
                  const updatedName = `${experimentName}-updated`;
                  const updated = yield* updateExperiment({
                    project_id: projectId,
                    id: created.id,
                    name: updatedName,
                    description: "Updated description",
                  });

                  expect(updated.name).toBe(updatedName);
                  expect(updated.description).toBe("Updated description");
                }),
              release: (experiment) =>
                deleteExperiment({
                  project_id: projectId,
                  id: experiment.id,
                }).pipe(Effect.catchAll(() => Effect.void)),
            }),
          release: (flag) =>
            deleteFeatureFlag({ project_id: projectId, id: flag.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create experiment with start date", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const timestamp = Date.now();
        const flagKey = `test-exp-start-${timestamp}`;
        const startDate = new Date().toISOString();

        yield* withResource({
          acquire: createFeatureFlag({
            project_id: projectId,
            key: flagKey,
            name: `Test Start Date Flag ${timestamp}`,
            filters: {
              groups: [{ properties: [], rollout_percentage: 100 }],
              multivariate: {
                variants: [
                  { key: "control", rollout_percentage: 50 },
                  { key: "test", rollout_percentage: 50 },
                ],
              },
            },
          }),
          use: (flag) =>
            withResource({
              acquire: createExperiment({
                project_id: projectId,
                name: `test-experiment-started-${timestamp}`,
                feature_flag_key: flagKey,
                start_date: startDate,
              }),
              use: (created) =>
                Effect.sync(() => {
                  expect(created.start_date).toBeDefined();
                }),
              release: (experiment) =>
                deleteExperiment({
                  project_id: projectId,
                  id: experiment.id,
                }).pipe(Effect.catchAll(() => Effect.void)),
            }),
          release: (flag) =>
            deleteFeatureFlag({ project_id: projectId, id: flag.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should archive experiment", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const timestamp = Date.now();
        const flagKey = `test-exp-archive-${timestamp}`;

        yield* withResource({
          acquire: createFeatureFlag({
            project_id: projectId,
            key: flagKey,
            name: `Test Archive Flag ${timestamp}`,
            filters: {
              groups: [{ properties: [], rollout_percentage: 100 }],
              multivariate: {
                variants: [
                  { key: "control", rollout_percentage: 50 },
                  { key: "test", rollout_percentage: 50 },
                ],
              },
            },
          }),
          use: (flag) =>
            withResource({
              acquire: createExperiment({
                project_id: projectId,
                name: `test-experiment-archive-${timestamp}`,
                feature_flag_key: flagKey,
              }),
              use: (created) =>
                Effect.gen(function* () {
                  // Archive the experiment
                  const archived = yield* updateExperiment({
                    project_id: projectId,
                    id: created.id,
                    archived: true,
                  });

                  expect(archived.archived).toBe(true);
                }),
              release: (experiment) =>
                deleteExperiment({
                  project_id: projectId,
                  id: experiment.id,
                }).pipe(Effect.catchAll(() => Effect.void)),
            }),
          release: (flag) =>
            deleteFeatureFlag({ project_id: projectId, id: flag.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should handle experiment not found", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* getExperiment({
          project_id: projectId,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));

    test("should stream pages via listExperiments.pages()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const pages = yield* listExperiments
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

    test("should stream items via listExperiments.items()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const items = yield* listExperiments
          .items({
            project_id: projectId,
            limit: 2,
          })
          .pipe(Stream.take(3), Stream.runCollect);

        const itemArray = Chunk.toReadonlyArray(items);
        expect(itemArray.length).toBeGreaterThanOrEqual(0);
        expect(itemArray.length).toBeLessThanOrEqual(3);
        // Verify items are Experiment objects
        if (itemArray.length > 0) {
          const firstItem = itemArray[0] as Experiment;
          expect(firstItem.id).toBeDefined();
        }
      }));
  });
});
