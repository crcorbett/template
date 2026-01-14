import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import { listEvents } from "../src/services/events.js";
import { test } from "./test.js";

const TEST_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "289739";

describe("PostHog Events Service", () => {
  describe("integration tests", () => {
    test("should list events", () =>
      Effect.gen(function* () {
        const result = yield* listEvents({
          project_id: TEST_PROJECT_ID,
          limit: 10,
        });

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }));
  });
});
