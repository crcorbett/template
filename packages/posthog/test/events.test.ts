import { describe, expect } from "@effect/vitest";
import { Chunk, Effect, Stream } from "effect";

import { type ClickhouseEvent, listEvents } from "../src/services/events.js";
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

    test("should stream pages via listEvents.pages()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const pages = yield* listEvents
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

    test("should stream items via listEvents.items()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const items = yield* listEvents
          .items({
            project_id: projectId,
            limit: 2,
          })
          .pipe(Stream.take(3), Stream.runCollect);

        const itemArray = Chunk.toReadonlyArray(items);
        expect(itemArray.length).toBeGreaterThanOrEqual(0);
        expect(itemArray.length).toBeLessThanOrEqual(3);
        // Verify items are ClickhouseEvent objects
        if (itemArray.length > 0) {
          const firstItem = itemArray[0] as ClickhouseEvent;
          expect(firstItem.id).toBeDefined();
        }
      }));
  });
});
