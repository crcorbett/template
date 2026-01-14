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

    test("should perform full CRUD lifecycle", () =>
      Effect.gen(function* () {
        const dashboardName = `test-dashboard-${Date.now()}`;

        const created = yield* createDashboard({
          project_id: TEST_PROJECT_ID,
          name: dashboardName,
          description: "Integration test dashboard",
          pinned: false,
        });

        expect(created).toBeDefined();
        expect(created.id).toBeDefined();
        expect(created.name).toBe(dashboardName);
        expect(created.description).toBe("Integration test dashboard");

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
        });

        expect(updated.name).toBe(updatedName);
        expect(updated.description).toBe("Updated description");

        const deleted = yield* deleteDashboard({
          project_id: TEST_PROJECT_ID,
          id: created.id,
        });

        expect(deleted.deleted).toBe(true);
      }));
  });
});
