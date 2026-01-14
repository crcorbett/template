import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import { listPersons } from "../src/services/persons.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

describe("PostHog Persons Service", () => {
  describe("integration tests", () => {
    test("should list persons", () =>
      Effect.gen(function* () {
        const result = yield* listPersons({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list persons with pagination", () =>
      Effect.gen(function* () {
        const firstPage = yield* listPersons({
          project_id: TEST_PROJECT_ID,
          limit: 5,
          offset: 0,
        });

        expect(firstPage.results).toBeDefined();
        expect(firstPage.results.length).toBeLessThanOrEqual(5);

        if (firstPage.next) {
          const secondPage = yield* listPersons({
            project_id: TEST_PROJECT_ID,
            limit: 5,
            offset: 5,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should return person properties", () =>
      Effect.gen(function* () {
        const result = yield* listPersons({
          project_id: TEST_PROJECT_ID,
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
        const result = yield* listPersons({
          project_id: TEST_PROJECT_ID,
          search: "test",
          limit: 10,
        });

        expect(result.results).toBeDefined();
      }));

    test("should filter persons by distinct_id", () =>
      Effect.gen(function* () {
        const allPersons = yield* listPersons({
          project_id: TEST_PROJECT_ID,
          limit: 1,
        });

        if (allPersons.results.length > 0) {
          const distinctId = allPersons.results[0].distinct_ids[0];
          if (distinctId) {
            const filtered = yield* listPersons({
              project_id: TEST_PROJECT_ID,
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
  });
});
