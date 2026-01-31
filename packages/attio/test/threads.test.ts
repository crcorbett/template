import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listThreads, getThread } from "../src/services/threads.js";
import { queryRecords } from "../src/services/records.js";

describe("Threads", () => {
  test("should list threads for a record", () =>
    Effect.gen(function* () {
      const people = yield* queryRecords({ object: "people", limit: 1 });
      if (people.data.length === 0) return;
      const person = people.data[0]!;
      const result = yield* listThreads({
        object: "people",
        record_id: person.id.record_id,
        limit: 5,
      });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getThread({
        thread_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
