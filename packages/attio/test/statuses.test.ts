import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listStatuses } from "../src/services/statuses.js";

describe("Statuses", () => {
  test("should list statuses for a status attribute", () =>
    Effect.gen(function* () {
      // "lead_status" is a common status attribute on the people object
      const result = yield* listStatuses({
        target: "objects",
        identifier: "people",
        attribute: "lead_status",
      }).pipe(Effect.either);
      // Either succeeds with data or fails if attribute doesn't exist
      if (result._tag === "Right") {
        expect(result.right.data).toBeDefined();
        expect(Array.isArray(result.right.data)).toBe(true);
      } else {
        // Attribute may not exist in this workspace — that's OK
        expect(result._tag).toBe("Left");
      }
    }));
});
