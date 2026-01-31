import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { queryRecords } from "../src/services/records.js";
import { createComment, getComment, deleteComment } from "../src/services/comments.js";
import { listWorkspaceMembers } from "../src/services/workspace-members.js";

describe("Comments", () => {
  test("should create and delete a comment on a record", { timeout: 60_000 }, () =>
    Effect.gen(function* () {
      // Find a person to attach a comment to
      const people = yield* queryRecords({ object: "people", limit: 1 });
      if (people.data.length === 0) return;
      const person = people.data[0]!;

      // Get a workspace member to use as comment author
      const members = yield* listWorkspaceMembers({});
      if (members.data.length === 0) return;
      const member = members.data[0]!;

      // Create a comment on the record
      const comment = yield* createComment({
        data: {
          record: {
            object: "people",
            record_id: person.id.record_id,
          },
          format: "plaintext",
          content: "Test comment",
          author: {
            type: "workspace-member",
            id: member.id.workspace_member_id,
          },
        },
      });

      expect(comment.data).toBeDefined();
      expect(comment.data.id).toBeDefined();

      // Delete the comment
      const commentId = (comment.data.id as { comment_id: string }).comment_id;
      yield* deleteComment({
        comment_id: commentId,
      }).pipe(Effect.catchAll(() => Effect.void));
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getComment({
        comment_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
