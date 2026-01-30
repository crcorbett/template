import { describe, expect, it } from "@effect/vitest";
import { Events } from "../src/events.js";
import { FeatureFlags } from "../src/feature-flags.js";
import { Surveys } from "../src/surveys.js";
import { AttioAttributes } from "../src/attio.js";
import { Plans, BillingIntervals } from "../src/plans.js";
import { UserProperties } from "../src/user-properties.js";

const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function values<T extends Record<string, string>>(obj: T): string[] {
  return Object.values(obj);
}

describe("Events constants", () => {
  it("all values are lowercase snake_case", () => {
    for (const [key, value] of Object.entries(Events)) {
      expect(value, `Events.${key} = "${value}"`).toMatch(SNAKE_CASE_RE);
    }
  });

  it("has no duplicate values", () => {
    const vals = values(Events);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("has at least 10 events defined", () => {
    expect(Object.keys(Events).length).toBeGreaterThanOrEqual(10);
  });
});

describe("FeatureFlags constants", () => {
  it("all values are kebab-case", () => {
    for (const [key, value] of Object.entries(FeatureFlags)) {
      expect(value, `FeatureFlags.${key} = "${value}"`).toMatch(KEBAB_CASE_RE);
    }
  });

  it("has no duplicate values", () => {
    const vals = values(FeatureFlags);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("Surveys constants", () => {
  it("all values are kebab-case", () => {
    for (const [key, value] of Object.entries(Surveys)) {
      expect(value, `Surveys.${key} = "${value}"`).toMatch(KEBAB_CASE_RE);
    }
  });

  it("has no duplicate values", () => {
    const vals = values(Surveys);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("AttioAttributes constants", () => {
  it("all values are lowercase snake_case", () => {
    for (const [key, value] of Object.entries(AttioAttributes)) {
      expect(value, `AttioAttributes.${key} = "${value}"`).toMatch(SNAKE_CASE_RE);
    }
  });

  it("has no duplicate values", () => {
    const vals = values(AttioAttributes);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("Plans constants", () => {
  it("all values are lowercase", () => {
    for (const [key, value] of Object.entries(Plans)) {
      expect(value, `Plans.${key} = "${value}"`).toBe(value.toLowerCase());
    }
  });

  it("has at least 3 tiers", () => {
    expect(Object.keys(Plans).length).toBeGreaterThanOrEqual(3);
  });

  it("has no duplicate values", () => {
    const vals = values(Plans);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("BillingIntervals constants", () => {
  it("has no duplicate values", () => {
    const vals = values(BillingIntervals);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("UserProperties constants", () => {
  it("all values are lowercase snake_case", () => {
    for (const [key, value] of Object.entries(UserProperties)) {
      expect(value, `UserProperties.${key} = "${value}"`).toMatch(SNAKE_CASE_RE);
    }
  });

  it("has no duplicate values", () => {
    const vals = values(UserProperties);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("includes plan property (used by TrialEndingSoonCohort)", () => {
    expect(values(UserProperties)).toContain("plan");
  });
});

describe("cross-constant uniqueness", () => {
  it("Events and FeatureFlags have no overlapping values", () => {
    const eventVals = new Set(values(Events));
    for (const val of values(FeatureFlags)) {
      expect(eventVals.has(val), `"${val}" appears in both Events and FeatureFlags`).toBe(false);
    }
  });

  it("Events and Surveys have no overlapping values", () => {
    const eventVals = new Set(values(Events));
    for (const val of values(Surveys)) {
      expect(eventVals.has(val), `"${val}" appears in both Events and Surveys`).toBe(false);
    }
  });
});
