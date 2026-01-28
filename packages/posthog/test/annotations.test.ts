import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createAnnotation,
  deleteAnnotation,
  getAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../src/services/annotations.js";
import { test, TEST_PROJECT_ID, withResource } from "./test.js";

describe("PostHog Annotations Service", () => {
  describe("integration tests", () => {
    test("should list annotations", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listAnnotations({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list annotations with pagination", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const firstPage = yield* listAnnotations({
          project_id: projectId,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listAnnotations({
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
        const now = new Date().toISOString();

        yield* withResource({
          acquire: createAnnotation({
            project_id: projectId,
            content: `test-annotation-${Date.now()}`,
            date_marker: now,
            scope: "project",
          }),
          use: (created) =>
            Effect.gen(function* () {
              expect(created).toBeDefined();
              expect(created.id).toBeDefined();
              expect(created.content).toContain("test-annotation");
              expect(created.scope).toBe("project");

              // Read
              const fetched = yield* getAnnotation({
                project_id: projectId,
                id: created.id,
              });

              expect(fetched.id).toBe(created.id);
              expect(fetched.content).toContain("test-annotation");

              // Update
              const updatedContent = `updated-annotation-${Date.now()}`;
              const updated = yield* updateAnnotation({
                project_id: projectId,
                id: created.id,
                content: updatedContent,
              });

              expect(updated.content).toBe(updatedContent);
            }),
          release: (created) =>
            deleteAnnotation({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create annotation for deployment", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createAnnotation({
            project_id: projectId,
            content: `v2.0.0 deployed - ${Date.now()}`,
            date_marker: new Date().toISOString(),
            scope: "project",
            creation_type: "USR",
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.content).toContain("v2.0.0 deployed");
              expect(created.scope).toBe("project");
            }),
          release: (created) =>
            deleteAnnotation({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create annotation for marketing campaign", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createAnnotation({
            project_id: projectId,
            content: `Q1 Marketing Campaign Start - ${Date.now()}`,
            date_marker: new Date().toISOString(),
            scope: "project",
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.content).toContain("Marketing Campaign");
            }),
          release: (created) =>
            deleteAnnotation({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create organization-scoped annotation", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createAnnotation({
            project_id: projectId,
            content: `Organization-wide notice - ${Date.now()}`,
            date_marker: new Date().toISOString(),
            scope: "organization",
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.scope).toBe("organization");
            }),
          release: (created) =>
            deleteAnnotation({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should search annotations by content", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const uniqueMarker = `searchable-${Date.now()}`;

        yield* withResource({
          acquire: createAnnotation({
            project_id: projectId,
            content: uniqueMarker,
            date_marker: new Date().toISOString(),
            scope: "project",
          }),
          use: (created) =>
            Effect.gen(function* () {
              const searchResults = yield* listAnnotations({
                project_id: projectId,
                search: uniqueMarker,
              });

              expect(searchResults.results.length).toBeGreaterThanOrEqual(1);
              expect(
                searchResults.results.some((a) => a.content === uniqueMarker)
              ).toBe(true);
            }),
          release: (created) =>
            deleteAnnotation({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should handle annotation not found", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* getAnnotation({
          project_id: projectId,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
