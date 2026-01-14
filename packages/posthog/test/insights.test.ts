import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createInsight,
  deleteInsight,
  getInsight,
  listInsights,
  updateInsight,
} from "../src/services/insights.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

describe("PostHog Insights Service", () => {
  describe("integration tests", () => {
    test("should list insights", () =>
      Effect.gen(function* () {
        const result = yield* listInsights({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const insightName = `test-insight-${Date.now()}`;

        const created = yield* createInsight({
          project_id: TEST_PROJECT_ID,
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

        expect(created).toBeDefined();
        expect(created.id).toBeDefined();
        expect(created.name).toBe(insightName);
        expect(created.description).toBe("Integration test insight");

        const fetched = yield* getInsight({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe(insightName);

        const updatedName = `${insightName}-updated`;
        const updated = yield* updateInsight({
          project_id: TEST_PROJECT_ID,
          id: created.id,
          name: updatedName,
          description: "Updated description",
        });

        expect(updated.name).toBe(updatedName);
        expect(updated.description).toBe("Updated description");

        const deleted = yield* deleteInsight({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(deleted.deleted).toBe(true);
      }));
  });
});
