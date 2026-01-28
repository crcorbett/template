import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createCohort,
  deleteCohort,
  getCohort,
  listCohorts,
  updateCohort,
} from "../src/services/cohorts.js";
import { test, TEST_PROJECT_ID } from "./test.js";

const cleanup = (project_id: string, id: number) =>
  deleteCohort({ project_id, id }).pipe(Effect.catchAll(() => Effect.void));

describe("PostHog Cohorts Service", () => {
  describe("integration tests", () => {
    test("should list cohorts", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listCohorts({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list cohorts with pagination", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const firstPage = yield* listCohorts({
          project_id: projectId,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listCohorts({
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
        const cohortName = `test-cohort-${Date.now()}`;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createCohort({
            project_id: projectId,
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
          createdId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.name).toBe(cohortName);
          expect(created.description).toBe("Integration test cohort");

          const fetched = yield* getCohort({
            project_id: projectId,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.name).toBe(cohortName);

          const updatedName = `${cohortName}-updated`;
          const updated = yield* updateCohort({
            project_id: projectId,
            id: created.id,
            name: updatedName,
            description: "Updated description",
          });

          expect(updated.name).toBe(updatedName);
          expect(updated.description).toBe("Updated description");

          const deleted = yield* deleteCohort({
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

    test("should create cohort with person property filter", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createCohort({
            project_id: projectId,
            name: `test-person-filter-${Date.now()}`,
            description: "Cohort with person property filter",
            is_static: false,
            filters: {
              properties: {
                type: "OR",
                values: [
                  {
                    type: "AND",
                    values: [
                      {
                        key: "email",
                        type: "person",
                        value: ["@example.com"],
                        operator: "icontains",
                      },
                    ],
                  },
                ],
              },
            },
          });
          createdId = created.id;

          expect(created.filters).toBeDefined();

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

    test("should create cohort with multiple conditions (OR)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createCohort({
            project_id: projectId,
            name: `test-or-conditions-${Date.now()}`,
            description: "Cohort with OR conditions",
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
                  {
                    type: "AND",
                    values: [
                      {
                        key: "$browser",
                        type: "person",
                        value: ["Firefox"],
                        operator: "exact",
                      },
                    ],
                  },
                ],
              },
            },
          });
          createdId = created.id;

          expect(created.filters).toBeDefined();

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

    test("should create cohort with multiple conditions (AND)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createCohort({
            project_id: projectId,
            name: `test-and-conditions-${Date.now()}`,
            description: "Cohort with AND conditions",
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
                      {
                        key: "$os",
                        type: "person",
                        value: ["Mac OS X"],
                        operator: "exact",
                      },
                    ],
                  },
                ],
              },
            },
          });
          createdId = created.id;

          expect(created.filters).toBeDefined();

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

    test("should handle cohort not found", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* getCohort({
          project_id: projectId,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
