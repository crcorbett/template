import { describe, expect, it } from "@effect/vitest";
import { createPlgClient, Events } from "../../src/index.js";
import type { PlgClient, PostHogClient } from "../../src/sdk/track.js";

function mockPostHog(): PostHogClient & { calls: Array<{ event: string; properties: Record<string, unknown> | undefined }> } {
  const calls: Array<{ event: string; properties: Record<string, unknown> | undefined }> = [];
  return {
    calls,
    capture(event: string, properties?: Record<string, unknown>) {
      calls.push({ event, properties });
    },
  };
}

describe("createPlgClient", () => {
  it("returns a PlgClient with a track method", () => {
    const posthog = mockPostHog();
    const client: PlgClient = createPlgClient(posthog);
    expect(typeof client.track).toBe("function");
  });

  it("delegates to posthog.capture with event and properties", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    client.track(Events.FEATURE_USED, { feature: "export" });

    expect(posthog.calls).toHaveLength(1);
    expect(posthog.calls[0]).toEqual({
      event: "feature_used",
      properties: { feature: "export" },
    });
  });

  it("passes optional properties through", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    client.track(Events.FEATURE_USED, { feature: "export", context: "dashboard" });

    expect(posthog.calls[0]?.properties).toEqual({
      feature: "export",
      context: "dashboard",
    });
  });

  it("handles events with all-optional properties", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    client.track(Events.ONBOARDING_STARTED, {});

    expect(posthog.calls[0]).toEqual({
      event: "onboarding_started",
      properties: {},
    });
  });

  it("handles monetization events with required fields", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    client.track(Events.PLAN_UPGRADED, {
      from_plan: "free",
      to_plan: "pro",
      mrr_cents: 4900,
    });

    expect(posthog.calls[0]).toEqual({
      event: "plan_upgraded",
      properties: { from_plan: "free", to_plan: "pro", mrr_cents: 4900 },
    });
  });
});

// ---------------------------------------------------------------------------
// Type-level tests
// ---------------------------------------------------------------------------

describe("track type safety", () => {
  it("compiles with correct required properties", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    // These should all compile without errors
    client.track(Events.FEATURE_USED, { feature: "export" });
    client.track(Events.SIGNUP_COMPLETED, { method: "email" });
    client.track(Events.PLAN_UPGRADED, { from_plan: "free", to_plan: "pro", mrr_cents: 4900 });
    client.track(Events.CHECKOUT_COMPLETED, { plan: "pro", amount_cents: 9900 });
    client.track(Events.ONBOARDING_STARTED, {});
    client.track(Events.SESSION_STARTED, {});
  });

  it("rejects missing required properties at compile time", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    // @ts-expect-error - missing required 'feature' property
    client.track(Events.FEATURE_USED, {});

    // @ts-expect-error - missing required 'method' property
    client.track(Events.SIGNUP_COMPLETED, {});

    // @ts-expect-error - missing required 'from_plan', 'to_plan', 'mrr_cents'
    client.track(Events.PLAN_UPGRADED, { from_plan: "free" });

    // @ts-expect-error - missing required 'plan' and 'amount_cents'
    client.track(Events.CHECKOUT_COMPLETED, {});
  });

  it("rejects invalid property values at compile time", () => {
    const posthog = mockPostHog();
    const client = createPlgClient(posthog);

    // @ts-expect-error - method must be 'email' | 'google' | 'github'
    client.track(Events.SIGNUP_COMPLETED, { method: "invalid" });
  });
});
