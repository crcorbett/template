import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listObjects, getObject } from "../src/services/objects.js";

describe("Objects", () => {
  test("should list all objects", () =>
    Effect.gen(function* () {
      const result = yield* listObjects({});
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      // System objects should always exist
      const slugs = result.data.map((o) => o.api_slug);
      expect(slugs).toContain("people");
      expect(slugs).toContain("companies");
    }));

  test("should get a specific object by slug", () =>
    Effect.gen(function* () {
      const result = yield* getObject({ object: "people" });
      expect(result.data.api_slug).toBe("people");
      expect(result.data.id.object_id).toBeDefined();
    }));
});
