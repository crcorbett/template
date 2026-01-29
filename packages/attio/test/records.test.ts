import { describe, expect } from "@effect/vitest";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { test } from "./test.js";
import { queryRecords, getRecord } from "../src/services/records.js";

describe("Records", () => {
  test("should query records with limit", () =>
    Effect.gen(function* () {
      const result = yield* queryRecords({ object: "people", limit: 5 });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);
    }));

  test("should stream pages of records", () =>
    Effect.gen(function* () {
      const pages = yield* queryRecords
        .pages({ object: "people", limit: 2 })
        .pipe(Stream.take(2), Stream.runCollect);
      expect(Chunk.toReadonlyArray(pages).length).toBeGreaterThanOrEqual(1);
    }));

  test("should stream individual record items", () =>
    Effect.gen(function* () {
      const items = yield* queryRecords
        .items({ object: "people", limit: 3 })
        .pipe(Stream.take(3), Stream.runCollect);
      expect(Chunk.toReadonlyArray(items).length).toBeLessThanOrEqual(3);
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getRecord({
        object: "people",
        record_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
