import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { listWorkspaceMembers, getWorkspaceMember } from "../src/services/workspace-members.js";

describe("WorkspaceMembers", () => {
  test("should list workspace members", () =>
    Effect.gen(function* () {
      const result = yield* listWorkspaceMembers({});
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
    }));

  test("should get a specific member", () =>
    Effect.gen(function* () {
      const members = yield* listWorkspaceMembers({});
      const first = members.data[0]!;
      const result = yield* getWorkspaceMember({
        workspace_member_id: first.id.workspace_member_id,
      });
      expect(result.data.id.workspace_member_id).toBe(first.id.workspace_member_id);
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getWorkspaceMember({
        workspace_member_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
