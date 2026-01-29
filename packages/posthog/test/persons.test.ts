import { describe, expect } from "@effect/vitest";
import { Chunk, Effect, Stream } from "effect";

import { listPersons, type Person } from "../src/services/persons.js";
import { test, TEST_PROJECT_ID } from "./test.js";

describe("PostHog Persons Service", () => {
  describe("integration tests", () => {
    test("should list persons", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listPersons({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list persons with pagination", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const firstPage = yield* listPersons({
          project_id: projectId,
          limit: 5,
          offset: 0,
        });

        expect(firstPage.results).toBeDefined();
        expect(firstPage.results.length).toBeLessThanOrEqual(5);

        if (firstPage.next) {
          const secondPage = yield* listPersons({
            project_id: projectId,
            limit: 5,
            offset: 5,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should return person properties", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listPersons({
          project_id: projectId,
          limit: 5,
        });

        if (result.results.length > 0) {
          const person = result.results[0];
          expect(person.id).toBeDefined();
          expect(person.uuid).toBeDefined();
          expect(person.distinct_ids).toBeDefined();
          expect(Array.isArray(person.distinct_ids)).toBe(true);
        }
      }));

    test("should search persons by query", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listPersons({
          project_id: projectId,
          search: "test",
          limit: 10,
        });

        expect(result.results).toBeDefined();
      }));

    test("should filter persons by distinct_id", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const allPersons = yield* listPersons({
          project_id: projectId,
          limit: 1,
        });

        if (allPersons.results.length > 0) {
          const distinctId = allPersons.results[0].distinct_ids[0];
          if (distinctId) {
            const filtered = yield* listPersons({
              project_id: projectId,
              distinct_id: distinctId,
              limit: 10,
            });

            expect(filtered.results).toBeDefined();
            if (filtered.results.length > 0) {
              expect(filtered.results[0].distinct_ids).toContain(distinctId);
            }
          }
        }
      }));

    test("should stream pages via listPersons.pages()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const pages = yield* listPersons
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

    test("should stream items via listPersons.items()", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        const items = yield* listPersons
          .items({
            project_id: projectId,
            limit: 2,
          })
          .pipe(Stream.take(3), Stream.runCollect);

        const itemArray = Chunk.toReadonlyArray(items);
        expect(itemArray.length).toBeGreaterThanOrEqual(0);
        expect(itemArray.length).toBeLessThanOrEqual(3);
        // Verify items are Person objects
        if (itemArray.length > 0) {
          const firstItem = itemArray[0] as Person;
          expect(firstItem.id).toBeDefined();
        }
      }));
  });
});
