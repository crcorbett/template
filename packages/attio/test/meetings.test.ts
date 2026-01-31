import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listMeetings, getMeeting } from "../src/services/meetings.js";

describe("Meetings", () => {
  test("should list meetings", () =>
    Effect.gen(function* () {
      const result = yield* listMeetings({ limit: 5 });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getMeeting({
        meeting_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
