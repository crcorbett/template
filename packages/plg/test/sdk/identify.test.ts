import { describe, expect, it } from "@effect/vitest";
import { identify, Plans } from "../../src/index.js";
import type { PostHogIdentifyClient, UserPropertyMap } from "../../src/sdk/identify.js";
import type { LifecycleStage } from "../../src/attio.js";
import type { PlanType } from "../../src/plans.js";

function mockPostHog(): PostHogIdentifyClient & { calls: Array<{ distinctId: string; properties: Record<string, unknown> | undefined }> } {
  const calls: Array<{ distinctId: string; properties: Record<string, unknown> | undefined }> = [];
  return {
    calls,
    identify(distinctId: string, properties?: Record<string, unknown>) {
      calls.push({ distinctId, properties });
    },
  };
}

describe("identify", () => {
  it("delegates to posthog.identify with typed properties", () => {
    const posthog = mockPostHog();

    identify(posthog, "user-123", {
      plan: Plans.PRO,
      is_pql: true,
    });

    expect(posthog.calls).toHaveLength(1);
    expect(posthog.calls[0]).toEqual({
      distinctId: "user-123",
      properties: { plan: "pro", is_pql: true },
    });
  });

  it("accepts empty partial properties", () => {
    const posthog = mockPostHog();
    identify(posthog, "user-456", {});
    expect(posthog.calls[0]?.properties).toEqual({});
  });

  it("accepts all properties together", () => {
    const posthog = mockPostHog();
    identify(posthog, "user-789", {
      plan: Plans.ENTERPRISE,
      company: "Acme Corp",
      signup_date: "2026-01-30",
      lifecycle_stage: "Active" as LifecycleStage,
      last_active: "2026-01-30",
      feature_count: 42,
      is_pql: false,
    });

    expect(posthog.calls[0]?.properties).toEqual({
      plan: "enterprise",
      company: "Acme Corp",
      signup_date: "2026-01-30",
      lifecycle_stage: "Active",
      last_active: "2026-01-30",
      feature_count: 42,
      is_pql: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe("identify type safety", () => {
  it("accepts valid partial UserPropertyMap", () => {
    const posthog = mockPostHog();
    // These should all compile
    identify(posthog, "user-1", { plan: Plans.FREE });
    identify(posthog, "user-2", { is_pql: true });
    identify(posthog, "user-3", { feature_count: 10, company: "test" });
  });

  it("rejects invalid property types at compile time", () => {
    const posthog = mockPostHog();

    // @ts-expect-error - plan must be PlanType, not arbitrary string
    identify(posthog, "user-1", { plan: "invalid-plan" });

    // @ts-expect-error - is_pql must be boolean
    identify(posthog, "user-2", { is_pql: "yes" });

    // @ts-expect-error - feature_count must be number
    identify(posthog, "user-3", { feature_count: "many" });
  });

  it("rejects unknown property keys at compile time", () => {
    const posthog = mockPostHog();

    // @ts-expect-error - 'unknown_prop' is not in UserPropertyMap
    identify(posthog, "user-1", { unknown_prop: "value" });
  });

  it("UserPropertyMap has correct field types", () => {
    // Type-level assertions via assignment
    const _plan: UserPropertyMap["plan"] = "pro" as PlanType;
    const _company: UserPropertyMap["company"] = "test";
    const _signupDate: UserPropertyMap["signup_date"] = "2026-01-01";
    const _lifecycleStage: UserPropertyMap["lifecycle_stage"] = "Active" as LifecycleStage;
    const _lastActive: UserPropertyMap["last_active"] = "2026-01-01";
    const _featureCount: UserPropertyMap["feature_count"] = 42;
    const _isPql: UserPropertyMap["is_pql"] = true;

    void [_plan, _company, _signupDate, _lifecycleStage, _lastActive, _featureCount, _isPql];
  });
});
