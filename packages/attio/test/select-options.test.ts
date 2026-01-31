import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listAttributes } from "../src/services/attributes.js";
import { listSelectOptions } from "../src/services/select-options.js";

describe("SelectOptions", () => {
  test("should list select options", () =>
    Effect.gen(function* () {
      // Find a select/status attribute on people
      const attrs = yield* listAttributes({ target: "objects", identifier: "people" });
      const selectAttr = attrs.data.find(
        (a) => a.type === "select" || a.type === "status"
      );
      if (!selectAttr) return; // skip if no select attributes

      const result = yield* listSelectOptions({
        target: "objects",
        identifier: "people",
        attribute: selectAttr.api_slug!,
      });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));
});
