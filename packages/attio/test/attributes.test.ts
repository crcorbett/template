import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listAttributes, getAttribute } from "../src/services/attributes.js";

describe("Attributes", () => {
  test("should list attributes for people object", () =>
    Effect.gen(function* () {
      const result = yield* listAttributes({ target: "objects", identifier: "people" });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    }));

  test("should get a specific attribute", () =>
    Effect.gen(function* () {
      const list = yield* listAttributes({ target: "objects", identifier: "people" });
      const first = list.data[0]!;
      const result = yield* getAttribute({
        target: "objects",
        identifier: "people",
        attribute: first.api_slug!,
      });
      expect(result.data.api_slug).toBe(first.api_slug);
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getAttribute({
        target: "objects",
        identifier: "people",
        attribute: "nonexistent_attribute_slug_that_does_not_exist",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
