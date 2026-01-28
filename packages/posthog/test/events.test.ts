import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import { listEvents } from "../src/services/events.js";
import { test, TEST_PROJECT_ID } from "./test.js";

describe("PostHog Events Service", () => {
  describe("integration tests", () => {
    test("should list events", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listEvents({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should filter events by event type", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listEvents({
          project_id: projectId,
          event: "$pageview",
          limit: 10,
        });

        expect(result.results).toBeDefined();
        for (const event of result.results) {
          expect(event.event).toBe("$pageview");
        }
      }));

    test("should filter events by date range", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const result = yield* listEvents({
          project_id: projectId,
          after: yesterday.toISOString(),
          before: now.toISOString(),
          limit: 10,
        });

        expect(result.results).toBeDefined();
        for (const event of result.results) {
          const eventTime = new Date(event.timestamp);
          expect(eventTime.getTime()).toBeGreaterThanOrEqual(
            yesterday.getTime()
          );
          expect(eventTime.getTime()).toBeLessThanOrEqual(now.getTime());
        }
      }));

    test("should return event properties", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listEvents({
          project_id: projectId,
          limit: 5,
        });

        if (result.results.length > 0) {
          const event = result.results[0];
          expect(event.id).toBeDefined();
          expect(event.distinct_id).toBeDefined();
          expect(event.event).toBeDefined();
          expect(event.timestamp).toBeDefined();
        }
      }));

    test("should handle pagination with next cursor", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const firstPage = yield* listEvents({
          project_id: projectId,
          limit: 5,
        });

        expect(firstPage.results).toBeDefined();
        expect(firstPage.results.length).toBeLessThanOrEqual(5);

        if (firstPage.next) {
          expect(typeof firstPage.next).toBe("string");
        }
      }));
  });
});
