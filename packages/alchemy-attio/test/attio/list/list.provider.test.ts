import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioLists from "@packages/attio/lists";
import { List } from "@/attio/list/index";
import { test, makeAssertDeleted } from "../test";
import * as Attio from "@/attio/index";

const assertListDeleted = makeAssertDeleted(
  "List",
  (listId: string) =>
    AttioLists.getList({ list: listId }),
);

// Skipped: List creation requires Attio Plus plan (free plan returns 500 instead of 403)
test.skip("create, update, delete list", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    class TestList extends List("TestList", {
      name: "Test List CRUD",
    }) {}

    const stack = yield* apply(TestList);
    expect(stack.TestList.listId).toBeDefined();
    expect(stack.TestList.name).toBe("Test List CRUD");

    // Verify via API
    const fetched = yield* AttioLists.getList({ list: stack.TestList.listId });
    expect(fetched.data.name).toBe("Test List CRUD");

    // Update name
    class UpdatedList extends List("TestList", {
      name: "Updated Test List",
    }) {}

    const updated = yield* apply(UpdatedList);
    expect(updated.TestList.listId).toBe(stack.TestList.listId);
    expect(updated.TestList.name).toBe("Updated Test List");

    // Destroy (hard delete)
    yield* destroy();
    yield* assertListDeleted(stack.TestList.listId);
  }).pipe(Effect.provide(Attio.providers())),
);
