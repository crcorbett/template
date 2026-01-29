import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listLists, getList } from "../src/services/lists.js";

describe("Lists", () => {
  test("should list all lists", () =>
    Effect.gen(function* () {
      const result = yield* listLists({});
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));

  test("should get a specific list", () =>
    Effect.gen(function* () {
      const lists = yield* listLists({});
      if (lists.data.length === 0) return; // skip if no lists
      const first = lists.data[0]!;
      const result = yield* getList({ list: first.id.list_id });
      expect(result.data.id.list_id).toBe(first.id.list_id);
    }));
});
