import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { searchRecords } from "../src/services/records.js";

describe("RecordsSearch", () => {
  test("should search records with a query", () =>
    Effect.gen(function* () {
      const result = yield* searchRecords({
        query: "test",
        objects: ["people"],
        limit: 5,
        request_as: { type: "workspace" },
      });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));

  test("should search records with empty query", () =>
    Effect.gen(function* () {
      const result = yield* searchRecords({
        query: "",
        objects: ["people"],
        limit: 5,
        request_as: { type: "workspace" },
      });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));
});
