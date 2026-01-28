import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createInsight,
  deleteInsight,
  getInsight,
  listInsights,
  updateInsight,
} from "../src/services/insights.js";
import { test, TEST_PROJECT_ID } from "./test.js";

const cleanup = (project_id: string, id: number) =>
  deleteInsight({ project_id, id }).pipe(Effect.catchAll(() => Effect.void));

describe("PostHog Insights Service", () => {
  describe("integration tests", () => {
    test("should list insights", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listInsights({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list saved insights only", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listInsights({
          project_id: projectId,
          saved: true,
          limit: 10,
        });

        expect(result.results).toBeDefined();
      }));

    test("should list insights with basic metadata only", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listInsights({
          project_id: projectId,
          basic: true,
          limit: 10,
        });

        expect(result.results).toBeDefined();
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insightName = `test-insight-${Date.now()}`;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createInsight({
            project_id: projectId,
            name: insightName,
            description: "Integration test insight",
            query: {
              kind: "TrendsQuery",
              series: [
                {
                  kind: "EventsNode",
                  event: "$pageview",
                  name: "$pageview",
                },
              ],
            },
            saved: true,
          });
          createdId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.name).toBe(insightName);
          expect(created.description).toBe("Integration test insight");

          const fetched = yield* getInsight({
            project_id: projectId,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.name).toBe(insightName);

          const updatedName = `${insightName}-updated`;
          const updated = yield* updateInsight({
            project_id: projectId,
            id: created.id,
            name: updatedName,
            description: "Updated description",
          });

          expect(updated.name).toBe(updatedName);
          expect(updated.description).toBe("Updated description");

          const deleted = yield* deleteInsight({
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

    test("should create trends insight", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createInsight({
            project_id: projectId,
            name: `test-trends-${Date.now()}`,
            query: {
              kind: "TrendsQuery",
              series: [
                {
                  kind: "EventsNode",
                  event: "$pageview",
                  name: "Page views",
                  math: "total",
                },
                {
                  kind: "EventsNode",
                  event: "$autocapture",
                  name: "Autocapture events",
                  math: "total",
                },
              ],
              interval: "day",
            },
            saved: true,
          });
          createdId = created.id;

          expect(created.query).toBeDefined();

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

    test("should create funnel insight", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createInsight({
            project_id: projectId,
            name: `test-funnel-${Date.now()}`,
            query: {
              kind: "FunnelsQuery",
              series: [
                {
                  kind: "EventsNode",
                  event: "$pageview",
                  name: "Step 1: Page view",
                },
                {
                  kind: "EventsNode",
                  event: "$autocapture",
                  name: "Step 2: Interaction",
                },
              ],
            },
            saved: true,
          });
          createdId = created.id;

          expect(created.query).toBeDefined();

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

    test("should create retention insight", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createInsight({
            project_id: projectId,
            name: `test-retention-${Date.now()}`,
            query: {
              kind: "RetentionQuery",
              retentionFilter: {
                targetEntity: {
                  id: "$pageview",
                  type: "events",
                },
                returningEntity: {
                  id: "$pageview",
                  type: "events",
                },
                period: "Day",
                totalIntervals: 7,
              },
            },
            saved: true,
          });
          createdId = created.id;

          expect(created.query).toBeDefined();

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

    test("should handle insight not found", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* getInsight({
          project_id: projectId,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
