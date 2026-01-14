import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createSurvey,
  deleteSurvey,
  getSurvey,
  listSurveys,
  updateSurvey,
} from "../src/services/surveys.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

const cleanup = (id: string) =>
  deleteSurvey({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

describe("PostHog Surveys Service", () => {
  describe("integration tests", () => {
    test("should list surveys", () =>
      Effect.gen(function* () {
        const result = yield* listSurveys({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list surveys with pagination", () =>
      Effect.gen(function* () {
        const firstPage = yield* listSurveys({
          project_id: TEST_PROJECT_ID,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listSurveys({
            project_id: TEST_PROJECT_ID,
            limit: 2,
            offset: 2,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const surveyName = `test-survey-${Date.now()}`;
        let createdId: string | undefined;

        yield* Effect.gen(function* () {
          // Create
          const created = yield* createSurvey({
            project_id: TEST_PROJECT_ID,
            name: surveyName,
            description: "Integration test survey",
            type: "popover",
            questions: [
              {
                type: "open",
                question: "What do you think of our product?",
                description: "We value your feedback",
                optional: false,
                buttonText: "Submit",
              },
            ],
          });
          createdId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.name).toBe(surveyName);
          expect(created.description).toBe("Integration test survey");
          expect(created.type).toBe("popover");

          // Read
          const fetched = yield* getSurvey({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.name).toBe(surveyName);

          // Update
          const updatedName = `${surveyName}-updated`;
          const updated = yield* updateSurvey({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            name: updatedName,
            description: "Updated description",
          });

          expect(updated.name).toBe(updatedName);
          expect(updated.description).toBe("Updated description");

          // Delete
          yield* deleteSurvey({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });
          createdId = undefined;

          // Verify deleted (should error)
          const getResult = yield* getSurvey({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          }).pipe(Effect.either);

          expect(getResult._tag).toBe("Left");
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create NPS survey with rating question", () =>
      Effect.gen(function* () {
        let createdId: string | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createSurvey({
            project_id: TEST_PROJECT_ID,
            name: `test-nps-survey-${Date.now()}`,
            description: "NPS Survey",
            type: "popover",
            questions: [
              {
                type: "rating",
                question:
                  "How likely are you to recommend us to a friend or colleague?",
                display: "number",
                scale: 10,
                lowerBoundLabel: "Not at all likely",
                upperBoundLabel: "Extremely likely",
              },
            ],
          });
          createdId = created.id;

          expect(created.type).toBe("popover");
          expect(created.questions).toBeDefined();

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create survey with multiple choice question", () =>
      Effect.gen(function* () {
        let createdId: string | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createSurvey({
            project_id: TEST_PROJECT_ID,
            name: `test-multichoice-survey-${Date.now()}`,
            description: "Multiple Choice Survey",
            type: "popover",
            questions: [
              {
                type: "single_choice",
                question: "What feature do you use most?",
                choices: ["Dashboard", "Reports", "Settings", "API"],
              },
            ],
          });
          createdId = created.id;

          expect(created.type).toBe("popover");

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create API survey type", () =>
      Effect.gen(function* () {
        let createdId: string | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createSurvey({
            project_id: TEST_PROJECT_ID,
            name: `test-api-survey-${Date.now()}`,
            description: "API Survey for programmatic access",
            type: "api",
            questions: [
              {
                type: "open",
                question: "Feedback via API",
              },
            ],
          });
          createdId = created.id;

          expect(created.type).toBe("api");

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should handle survey not found", () =>
      Effect.gen(function* () {
        const result = yield* getSurvey({
          project_id: TEST_PROJECT_ID,
          id: "00000000-0000-0000-0000-000000000000",
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
