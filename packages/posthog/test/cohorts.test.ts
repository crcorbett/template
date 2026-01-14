import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createCohort,
  deleteCohort,
  getCohort,
  listCohorts,
  updateCohort,
} from "../src/services/cohorts.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

describe("PostHog Cohorts Service", () => {
  describe("integration tests", () => {
    test("should list cohorts", () =>
      Effect.gen(function* () {
        const result = yield* listCohorts({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const cohortName = `test-cohort-${Date.now()}`;

        const created = yield* createCohort({
          project_id: TEST_PROJECT_ID,
          name: cohortName,
          description: "Integration test cohort",
          is_static: false,
          filters: {
            properties: {
              type: "OR",
              values: [
                {
                  type: "AND",
                  values: [
                    {
                      key: "$browser",
                      type: "person",
                      value: ["Chrome"],
                      operator: "exact",
                    },
                  ],
                },
              ],
            },
          },
        });

        expect(created).toBeDefined();
        expect(created.id).toBeDefined();
        expect(created.name).toBe(cohortName);
        expect(created.description).toBe("Integration test cohort");

        const fetched = yield* getCohort({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe(cohortName);

        const updatedName = `${cohortName}-updated`;
        const updated = yield* updateCohort({
          project_id: TEST_PROJECT_ID,
          id: created.id,
          name: updatedName,
          description: "Updated description",
        });

        expect(updated.name).toBe(updatedName);
        expect(updated.description).toBe("Updated description");

        const deleted = yield* deleteCohort({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(deleted.deleted).toBe(true);
      }));
  });
});
