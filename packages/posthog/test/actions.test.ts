import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createAction,
  deleteAction,
  getAction,
  listActions,
  updateAction,
} from "../src/services/actions.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

const cleanup = (id: number) =>
  deleteAction({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

describe("PostHog Actions Service", () => {
  describe("integration tests", () => {
    test("should list actions", () =>
      Effect.gen(function* () {
        const result = yield* listActions({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list actions with pagination", () =>
      Effect.gen(function* () {
        const firstPage = yield* listActions({
          project_id: TEST_PROJECT_ID,
          limit: 5,
          offset: 0,
        });

        expect(firstPage.results).toBeDefined();
        expect(Array.isArray(firstPage.results)).toBe(true);

        if (firstPage.next) {
          const secondPage = yield* listActions({
            project_id: TEST_PROJECT_ID,
            limit: 5,
            offset: 5,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const actionName = `test-action-${Date.now()}`;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          // Create
          const created = yield* createAction({
            project_id: TEST_PROJECT_ID,
            name: actionName,
            description: "Integration test action",
            steps: [
              {
                event: "user_signed_up",
              },
            ],
          });
          createdId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.name).toBe(actionName);
          expect(created.description).toBe("Integration test action");

          // Read
          const fetched = yield* getAction({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.name).toBe(actionName);

          // Update
          const updatedName = `${actionName}-updated`;
          const updated = yield* updateAction({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            name: updatedName,
            description: "Updated description",
          });

          expect(updated.name).toBe(updatedName);
          expect(updated.description).toBe("Updated description");

          // Delete (soft delete)
          yield* deleteAction({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          }).pipe(Effect.catchAll(() => Effect.void));
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create action with URL matching", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAction({
            project_id: TEST_PROJECT_ID,
            name: `test-url-action-${Date.now()}`,
            description: "Action with URL matching",
            steps: [
              {
                event: "$pageview",
                url: "/checkout",
                url_matching: "contains",
              },
            ],
          });
          createdId = created.id;

          expect(created.steps).toBeDefined();
          expect(created.steps?.length).toBe(1);

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create action with multiple steps", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAction({
            project_id: TEST_PROJECT_ID,
            name: `test-multistep-action-${Date.now()}`,
            description: "Action with multiple steps",
            steps: [
              {
                event: "project_created",
              },
              {
                event: "task_created",
              },
              {
                event: "member_invited",
              },
            ],
          });
          createdId = created.id;

          expect(created.steps?.length).toBe(3);

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create action with element selector", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAction({
            project_id: TEST_PROJECT_ID,
            name: `test-selector-action-${Date.now()}`,
            description: "Action with CSS selector",
            steps: [
              {
                event: "$autocapture",
                selector: "button.signup-btn",
                tag_name: "button",
                text: "Sign Up",
              },
            ],
          });
          createdId = created.id;

          expect(created.steps).toBeDefined();

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create action with tags", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAction({
            project_id: TEST_PROJECT_ID,
            name: `test-tagged-action-${Date.now()}`,
            description: "Action with tags",
            tags: ["conversion", "funnel"],
            steps: [
              {
                event: "checkout_completed",
              },
            ],
          });
          createdId = created.id;

          expect(created.tags).toBeDefined();

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should handle action not found", () =>
      Effect.gen(function* () {
        const result = yield* getAction({
          project_id: TEST_PROJECT_ID,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
