import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createAnnotation,
  deleteAnnotation,
  getAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../src/services/annotations.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

const cleanup = (id: number) =>
  deleteAnnotation({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

describe("PostHog Annotations Service", () => {
  describe("integration tests", () => {
    test("should list annotations", () =>
      Effect.gen(function* () {
        const result = yield* listAnnotations({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list annotations with pagination", () =>
      Effect.gen(function* () {
        const firstPage = yield* listAnnotations({
          project_id: TEST_PROJECT_ID,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listAnnotations({
            project_id: TEST_PROJECT_ID,
            limit: 2,
            offset: 2,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const now = new Date().toISOString();
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          // Create
          const created = yield* createAnnotation({
            project_id: TEST_PROJECT_ID,
            content: `test-annotation-${Date.now()}`,
            date_marker: now,
            scope: "project",
          });
          createdId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.content).toContain("test-annotation");
          expect(created.scope).toBe("project");

          // Read
          const fetched = yield* getAnnotation({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.content).toContain("test-annotation");

          // Update
          const updatedContent = `updated-annotation-${Date.now()}`;
          const updated = yield* updateAnnotation({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            content: updatedContent,
          });

          expect(updated.content).toBe(updatedContent);

          // Delete (cleanup handles failure)
          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create annotation for deployment", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAnnotation({
            project_id: TEST_PROJECT_ID,
            content: `v2.0.0 deployed - ${Date.now()}`,
            date_marker: new Date().toISOString(),
            scope: "project",
            creation_type: "USR",
          });
          createdId = created.id;

          expect(created.content).toContain("v2.0.0 deployed");
          expect(created.scope).toBe("project");

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create annotation for marketing campaign", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAnnotation({
            project_id: TEST_PROJECT_ID,
            content: `Q1 Marketing Campaign Start - ${Date.now()}`,
            date_marker: new Date().toISOString(),
            scope: "project",
          });
          createdId = created.id;

          expect(created.content).toContain("Marketing Campaign");

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create organization-scoped annotation", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createAnnotation({
            project_id: TEST_PROJECT_ID,
            content: `Organization-wide notice - ${Date.now()}`,
            date_marker: new Date().toISOString(),
            scope: "organization",
          });
          createdId = created.id;

          expect(created.scope).toBe("organization");

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should search annotations by content", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;
        const uniqueMarker = `searchable-${Date.now()}`;

        yield* Effect.gen(function* () {
          // Create an annotation with unique content
          const created = yield* createAnnotation({
            project_id: TEST_PROJECT_ID,
            content: uniqueMarker,
            date_marker: new Date().toISOString(),
            scope: "project",
          });
          createdId = created.id;

          // Search for it
          const searchResults = yield* listAnnotations({
            project_id: TEST_PROJECT_ID,
            search: uniqueMarker,
          });

          expect(searchResults.results.length).toBeGreaterThanOrEqual(1);
          expect(
            searchResults.results.some((a) => a.content === uniqueMarker)
          ).toBe(true);

          yield* cleanup(created.id);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should handle annotation not found", () =>
      Effect.gen(function* () {
        const result = yield* getAnnotation({
          project_id: TEST_PROJECT_ID,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
