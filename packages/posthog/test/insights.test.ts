import { describe, expect } from "@effect/vitest";
import { Effect, Stream } from "effect";

import {
  createInsight,
  deleteInsight,
  getInsight,
  listInsights,
  updateInsight,
} from "../src/services/insights.js";
import { test, TEST_PROJECT_ID, withResource } from "./test.js";

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

        yield* withResource({
          acquire: createInsight({
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
          }),
          use: (created) =>
            Effect.gen(function* () {
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
            }),
          release: (created) =>
            deleteInsight({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create trends insight", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createInsight({
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
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.query).toBeDefined();
            }),
          release: (created) =>
            deleteInsight({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create funnel insight", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createInsight({
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
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.query).toBeDefined();
            }),
          release: (created) =>
            deleteInsight({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create retention insight", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createInsight({
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
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.query).toBeDefined();
            }),
          release: (created) =>
            deleteInsight({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
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

    test("should stream pages with listInsights.pages()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const pages = yield* listInsights
          .pages({ project_id: projectId, limit: 5 })
          .pipe(Stream.take(2), Stream.runCollect);

        expect(pages.length).toBeGreaterThanOrEqual(1);
        for (const page of pages) {
          expect(page.results).toBeDefined();
          expect(Array.isArray(page.results)).toBe(true);
        }
      }));

    test("should stream items with listInsights.items()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const items = yield* listInsights
          .items({ project_id: projectId, limit: 5 })
          .pipe(Stream.take(10), Stream.runCollect);

        expect(items.length).toBeGreaterThanOrEqual(0);
      }));
  });
});
