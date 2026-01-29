import { expect } from "@effect/vitest";
import * as AnnotationsAPI from "@packages/posthog/annotations";
import * as DashboardsAPI from "@packages/posthog/dashboards";
import * as FeatureFlagsAPI from "@packages/posthog/feature-flags";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import { Annotation } from "@/posthog/annotations/index.js";
import { Dashboard } from "@/posthog/dashboards/index.js";
import { FeatureFlag } from "@/posthog/feature-flags/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { makeAssertDeleted, test } from "./test.js";

const assertFeatureFlagDeleted = makeAssertDeleted(
  "FeatureFlag",
  FeatureFlagsAPI.getFeatureFlag,
  (flag) => flag.deleted === true,
);

const assertDashboardDeleted = makeAssertDeleted(
  "Dashboard",
  DashboardsAPI.getDashboard,
  (dashboard) => dashboard.deleted === true,
);

const assertAnnotationDeleted = makeAssertDeleted(
  "Annotation",
  AnnotationsAPI.getAnnotation,
  (annotation) => annotation.deleted === true,
);

test(
  "create and manage related PostHog resources",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;

    // Create a FeatureFlag
    class SmokeFlag extends FeatureFlag("SmokeFlag", {
      key: "smoke-test-flag",
      name: "Smoke Test Flag",
      active: true,
    }) {}

    // Create a Dashboard
    class SmokeDashboard extends Dashboard("SmokeDashboard", {
      name: "Smoke Test Dashboard",
      description: "Dashboard for smoke testing",
    }) {}

    // Create an Annotation
    class SmokeAnnotation extends Annotation("SmokeAnnotation", {
      content: "Smoke test annotation",
      scope: "project" as const,
    }) {}

    // Apply all resources together
    const stack = yield* apply(SmokeFlag, SmokeDashboard, SmokeAnnotation);

    // Verify FeatureFlag
    expect(stack.SmokeFlag.id).toBeDefined();
    expect(typeof stack.SmokeFlag.id).toBe("number");
    expect(stack.SmokeFlag.key).toBe("smoke-test-flag");
    expect(stack.SmokeFlag.active).toBe(true);

    const fetchedFlag = yield* FeatureFlagsAPI.getFeatureFlag({
      project_id: projectId,
      id: stack.SmokeFlag.id,
    });
    expect(fetchedFlag.key).toBe("smoke-test-flag");
    expect(fetchedFlag.name).toBe("Smoke Test Flag");

    // Verify Dashboard
    expect(stack.SmokeDashboard.id).toBeDefined();
    expect(typeof stack.SmokeDashboard.id).toBe("number");
    expect(stack.SmokeDashboard.name).toBe("Smoke Test Dashboard");

    const fetchedDashboard = yield* DashboardsAPI.getDashboard({
      project_id: projectId,
      id: stack.SmokeDashboard.id,
    });
    expect(fetchedDashboard.name).toBe("Smoke Test Dashboard");
    expect(fetchedDashboard.description).toBe(
      "Dashboard for smoke testing"
    );

    // Verify Annotation
    expect(stack.SmokeAnnotation.id).toBeDefined();
    expect(typeof stack.SmokeAnnotation.id).toBe("number");
    expect(stack.SmokeAnnotation.content).toBe("Smoke test annotation");
    expect(stack.SmokeAnnotation.scope).toBe("project");

    const fetchedAnnotation = yield* AnnotationsAPI.getAnnotation({
      project_id: projectId,
      id: stack.SmokeAnnotation.id,
    });
    expect(fetchedAnnotation.content).toBe("Smoke test annotation");
    expect(fetchedAnnotation.scope).toBe("project");

    // Destroy all resources
    yield* destroy();

    // Verify all cleaned up
    yield* assertFeatureFlagDeleted(stack.SmokeFlag.id);
    yield* assertDashboardDeleted(stack.SmokeDashboard.id);
    yield* assertAnnotationDeleted(stack.SmokeAnnotation.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
