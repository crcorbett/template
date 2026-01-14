import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  listDashboards,
  updateDashboard,
} from "../src/services/dashboards.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

const cleanup = (id: number) =>
  deleteDashboard({ project_id: TEST_PROJECT_ID, id }).pipe(
    Effect.catchAll(() => Effect.void)
  );

describe("PostHog Dashboards Service", () => {
  describe("integration tests", () => {
    test("should list dashboards", () =>
      Effect.gen(function* () {
        const result = yield* listDashboards({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));

    test("should list dashboards with pagination", () =>
      Effect.gen(function* () {
        const firstPage = yield* listDashboards({
          project_id: TEST_PROJECT_ID,
          limit: 2,
          offset: 0,
        });

        expect(firstPage.results.length).toBeLessThanOrEqual(2);

        if (firstPage.next) {
          const secondPage = yield* listDashboards({
            project_id: TEST_PROJECT_ID,
            limit: 2,
            offset: 2,
          });
          expect(secondPage.results).toBeDefined();
        }
      }));

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const dashboardName = `test-dashboard-${Date.now()}`;
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createDashboard({
            project_id: TEST_PROJECT_ID,
            name: dashboardName,
            description: "Integration test dashboard",
            pinned: false,
          });
          createdId = created.id;

          expect(created).toBeDefined();
          expect(created.id).toBeDefined();
          expect(created.name).toBe(dashboardName);
          expect(created.description).toBe("Integration test dashboard");
          expect(created.pinned).toBe(false);

          const fetched = yield* getDashboard({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });

          expect(fetched.id).toBe(created.id);
          expect(fetched.name).toBe(dashboardName);

          const updatedName = `${dashboardName}-updated`;
          const updated = yield* updateDashboard({
            project_id: TEST_PROJECT_ID,
            id: created.id,
            name: updatedName,
            description: "Updated description",
            pinned: true,
          });

          expect(updated.name).toBe(updatedName);
          expect(updated.description).toBe("Updated description");
          expect(updated.pinned).toBe(true);

          const deleted = yield* deleteDashboard({
            project_id: TEST_PROJECT_ID,
            id: created.id,
          });

          expect(deleted.deleted).toBe(true);
          createdId = undefined;
        }).pipe(
          Effect.ensuring(
            createdId !== undefined ? cleanup(createdId) : Effect.void
          )
        );
      }));

    test("should create dashboard with tags", () =>
      Effect.gen(function* () {
        let createdId: number | undefined;

        yield* Effect.gen(function* () {
          const created = yield* createDashboard({
            project_id: TEST_PROJECT_ID,
            name: `test-dashboard-tags-${Date.now()}`,
            description: "Dashboard with tags",
            tags: ["test", "integration"],
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

    test("should handle dashboard not found", () =>
      Effect.gen(function* () {
        const result = yield* getDashboard({
          project_id: TEST_PROJECT_ID,
          id: 999999999,
        }).pipe(Effect.either);

        expect(result._tag).toBe("Left");
      }));
  });
});
