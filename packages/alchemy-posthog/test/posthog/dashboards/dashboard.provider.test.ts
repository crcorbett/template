import { expect } from "@effect/vitest";
import * as DashboardsAPI from "@packages/posthog/dashboards";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import { Dashboard } from "@/posthog/dashboards/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { makeAssertDeleted, test } from "../test.js";

const assertDashboardDeleted = makeAssertDeleted(
  "Dashboard",
  DashboardsAPI.getDashboard,
  (dashboard) => dashboard.deleted === true,
);

test(
  "create, update, delete dashboard",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;

    // Create a dashboard
    class TestDashboard extends Dashboard("TestDashboard", {
      name: "Test Dashboard",
      description: "A test dashboard for integration testing",
      pinned: false,
    }) {}

    const stack = yield* apply(TestDashboard);

    // Verify the created dashboard
    expect(stack.TestDashboard.id).toBeDefined();
    expect(typeof stack.TestDashboard.id).toBe("number");
    expect(stack.TestDashboard.name).toBe(TestDashboard.props.name);
    expect(stack.TestDashboard.description).toBe(
      "A test dashboard for integration testing"
    );
    expect(stack.TestDashboard.pinned).toBe(false);

    // Verify via direct API call
    const fetched = yield* DashboardsAPI.getDashboard({
      project_id: projectId,
      id: stack.TestDashboard.id,
    });
    expect(fetched.name).toBe(TestDashboard.props.name);
    expect(fetched.description).toBe(
      "A test dashboard for integration testing"
    );
    expect(fetched.pinned).toBe(false);

    // Update the dashboard
    class UpdatedDashboard extends Dashboard("TestDashboard", {
      name: TestDashboard.props.name,
      description: "Updated description",
      pinned: true,
    }) {}

    const updated = yield* apply(UpdatedDashboard);

    // Verify the update
    expect(updated.TestDashboard.id).toBe(stack.TestDashboard.id); // ID should be stable
    expect(updated.TestDashboard.description).toBe("Updated description");
    expect(updated.TestDashboard.pinned).toBe(true);

    // Verify update via API
    const fetchedUpdated = yield* DashboardsAPI.getDashboard({
      project_id: projectId,
      id: stack.TestDashboard.id,
    });
    expect(fetchedUpdated.description).toBe("Updated description");
    expect(fetchedUpdated.pinned).toBe(true);

    // Destroy the dashboard
    yield* destroy();

    // Verify deletion
    yield* assertDashboardDeleted(stack.TestDashboard.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
