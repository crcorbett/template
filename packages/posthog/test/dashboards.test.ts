import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  listDashboards,
  updateDashboard,
} from "../src/services/dashboards.js";
import { test, TEST_PROJECT_ID, withResource } from "./test.js";

describe("PostHog Dashboards Service", () => {
  describe("integration tests", () => {
    test("should list dashboards", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* listDashboards({
          project_id: projectId,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list dashboards with pagination", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const firstPage = yield* listDashboards({
          project_id: projectId,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listDashboards({
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
        const dashboardName = `test-dashboard-${Date.now()}`;

        yield* withResource({
          acquire: createDashboard({
            project_id: projectId,
            name: dashboardName,
            description: "Integration test dashboard",
            pinned: false,
          }),
          use: (created) =>
            Effect.gen(function* () {
              expect(created).toBeDefined();
              expect(created.id).toBeDefined();
              expect(created.name).toBe(dashboardName);
              expect(created.description).toBe("Integration test dashboard");
              expect(created.pinned).toBe(false);

              const fetched = yield* getDashboard({
                project_id: projectId,
                id: created.id,
              });

              expect(fetched.id).toBe(created.id);
              expect(fetched.name).toBe(dashboardName);

              const updatedName = `${dashboardName}-updated`;
              const updated = yield* updateDashboard({
                project_id: projectId,
                id: created.id,
                name: updatedName,
                description: "Updated description",
                pinned: true,
              });

              expect(updated.name).toBe(updatedName);
              expect(updated.description).toBe("Updated description");
              expect(updated.pinned).toBe(true);

              const deleted = yield* deleteDashboard({
                project_id: projectId,
                id: created.id,
              });

              expect(deleted.deleted).toBe(true);
            }),
          release: (created) =>
            deleteDashboard({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should create dashboard with tags", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;

        yield* withResource({
          acquire: createDashboard({
            project_id: projectId,
            name: `test-dashboard-tags-${Date.now()}`,
            description: "Dashboard with tags",
            tags: ["test", "integration"],
          }),
          use: (created) =>
            Effect.sync(() => {
              expect(created.tags).toBeDefined();
            }),
          release: (created) =>
            deleteDashboard({ project_id: projectId, id: created.id }).pipe(
              Effect.catchAll(() => Effect.void)
            ),
        });
      }));

    test("should handle dashboard not found", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const result = yield* getDashboard({
          project_id: projectId,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
