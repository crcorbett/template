import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createExperiment,
  deleteExperiment,
  getExperiment,
  listExperiments,
  updateExperiment,
} from "../src/services/experiments.js";
import {
  createFeatureFlag,
  deleteFeatureFlag,
} from "../src/services/feature-flags.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

const cleanupExperiment = (id: number) =>
  deleteExperiment({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

const cleanupFlag = (id: number) =>
  deleteFeatureFlag({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

describe("PostHog Experiments Service", () => {
  describe("integration tests", () => {
    test("should list experiments", () =>
      Effect.gen(function* () {
        const result = yield* listExperiments({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list experiments with pagination", () =>
      Effect.gen(function* () {
        const firstPage = yield* listExperiments({
          project_id: TEST_PROJECT_ID,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listExperiments({
            project_id: TEST_PROJECT_ID,
            limit: 2,
            offset: 2,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const timestamp = Date.now();
        const experimentName = `test-experiment-${timestamp}`;
        const flagKey = `test-exp-flag-${timestamp}`;
        let createdExperimentId: number | undefined;
        let createdFlagId: number | undefined;

        yield* Effect.gen(function* () {
          // First create a feature flag for the experiment
          const flag = yield* createFeatureFlag({
            project_id: TEST_PROJECT_ID,
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
          });
          createdFlagId = flag.id;

          // Create experiment
          const created = yield* createExperiment({
            project_id: TEST_PROJECT_ID,
            name: experimentName,
            description: "Integration test experiment",
            feature_flag_key: flagKey,
          });
          createdExperimentId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.name).toBe(experimentName);
          expect(created.description).toBe("Integration test experiment");
          expect(created.feature_flag_key).toBe(flagKey);

          // Read
          const fetched = yield* getExperiment({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.name).toBe(experimentName);

          // Update
          const updatedName = `${experimentName}-updated`;
          const updated = yield* updateExperiment({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            name: updatedName,
            description: "Updated description",
          });

          expect(updated.name).toBe(updatedName);
          expect(updated.description).toBe("Updated description");

          // Cleanup
          yield* cleanupExperiment(created.id);
          createdExperimentId = undefined;
          yield* cleanupFlag(flag.id);
          createdFlagId = undefined;
        }).pipe(
          Effect.ensuring(
            Effect.all([
              createdExperimentId !== undefined
                ? cleanupExperiment(createdExperimentId)
                : Effect.void,
              createdFlagId !== undefined
                ? cleanupFlag(createdFlagId)
                : Effect.void,
            ])
          )
        );
      }));

    test("should create experiment with start date", () =>
      Effect.gen(function* () {
        const timestamp = Date.now();
        const flagKey = `test-exp-start-${timestamp}`;
        let createdExperimentId: number | undefined;
        let createdFlagId: number | undefined;

        yield* Effect.gen(function* () {
          const flag = yield* createFeatureFlag({
            project_id: TEST_PROJECT_ID,
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
          });
          createdFlagId = flag.id;

          const startDate = new Date().toISOString();
          const created = yield* createExperiment({
            project_id: TEST_PROJECT_ID,
            name: `test-experiment-started-${timestamp}`,
            feature_flag_key: flagKey,
            start_date: startDate,
          });
          createdExperimentId = created.id;

          expect(created.start_date).toBeDefined();

          yield* cleanupExperiment(created.id);
          createdExperimentId = undefined;
          yield* cleanupFlag(flag.id);
          createdFlagId = undefined;
        }).pipe(
          Effect.ensuring(
            Effect.all([
              createdExperimentId !== undefined
                ? cleanupExperiment(createdExperimentId)
                : Effect.void,
              createdFlagId !== undefined
                ? cleanupFlag(createdFlagId)
                : Effect.void,
            ])
          )
        );
      }));

    test("should archive experiment", () =>
      Effect.gen(function* () {
        const timestamp = Date.now();
        const flagKey = `test-exp-archive-${timestamp}`;
        let createdExperimentId: number | undefined;
        let createdFlagId: number | undefined;

        yield* Effect.gen(function* () {
          const flag = yield* createFeatureFlag({
            project_id: TEST_PROJECT_ID,
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
          });
          createdFlagId = flag.id;

          const created = yield* createExperiment({
            project_id: TEST_PROJECT_ID,
            name: `test-experiment-archive-${timestamp}`,
            feature_flag_key: flagKey,
          });
          createdExperimentId = created.id;

          // Archive the experiment
          const archived = yield* updateExperiment({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            archived: true,
          });

          expect(archived.archived).toBe(true);

          yield* cleanupExperiment(created.id);
          createdExperimentId = undefined;
          yield* cleanupFlag(flag.id);
          createdFlagId = undefined;
        }).pipe(
          Effect.ensuring(
            Effect.all([
              createdExperimentId !== undefined
                ? cleanupExperiment(createdExperimentId)
                : Effect.void,
              createdFlagId !== undefined
                ? cleanupFlag(createdFlagId)
                : Effect.void,
            ])
          )
        );
      }));

    test("should handle experiment not found", () =>
      Effect.gen(function* () {
        const result = yield* getExperiment({
          project_id: TEST_PROJECT_ID,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
