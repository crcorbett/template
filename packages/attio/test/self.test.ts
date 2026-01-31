import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { getSelf } from "../src/services/self.js";

describe("Self", () => {
  test("should identify current token", () =>
    Effect.gen(function* () {
      const result = yield* getSelf({});
      expect(result).toBeDefined();
    }));
});
