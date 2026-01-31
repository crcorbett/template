import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listLists } from "../src/services/lists.js";
import { queryEntries, getEntry } from "../src/services/entries.js";

describe("Entries", () => {
  test("should query entries with limit", () =>
    Effect.gen(function* () {
      const lists = yield* listLists({});
      if (lists.data.length === 0) return; // skip if no lists
      const first = lists.data[0]!;
      const result = yield* queryEntries({ list: first.id.list_id, limit: 5 });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const lists = yield* listLists({});
      if (lists.data.length === 0) return;
      const first = lists.data[0]!;
      const result = yield* getEntry({
        list: first.id.list_id,
        entry_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
