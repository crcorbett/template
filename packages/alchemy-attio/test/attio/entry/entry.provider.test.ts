import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioLists from "@packages/attio/lists";
import { Entry } from "@/attio/entry/index";
import { List } from "@/attio/list/index";
import { test, makeAssertDeleted } from "../test";
import * as Attio from "@/attio/index";

const assertListDeleted = makeAssertDeleted(
  "List",
  (listId: string) =>
    AttioLists.getList({ list: listId }),
);

// Skipped: Depends on List creation which requires Attio Plus plan
test.skip("create, update, delete entry", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    // First create a list to put entries in
    class EntryTestList extends List("EntryTestList", {
      name: "Alchemy Entry Test List",
    }) {}

    const listStack = yield* apply(EntryTestList);
    const listSlug = listStack.EntryTestList.apiSlug ?? listStack.EntryTestList.listId;

    class TestEntry extends Entry("TestEntry", {
      list: listSlug,
      matchingAttribute: "name",
      data: {
        name: [{ value: "Alchemy Entry Test" }],
      },
    }) {}

    const stack = yield* apply(TestEntry);
    expect(stack.TestEntry.entryId).toBeDefined();
    expect(stack.TestEntry.listId).toBeDefined();

    // Update data
    class UpdatedEntry extends Entry("TestEntry", {
      list: listSlug,
      matchingAttribute: "name",
      data: {
        name: [{ value: "Updated Alchemy Entry" }],
      },
    }) {}

    const updated = yield* apply(UpdatedEntry);
    expect(updated.TestEntry.entryId).toBe(stack.TestEntry.entryId);

    // Destroy
    yield* destroy();
    yield* assertListDeleted(listStack.EntryTestList.listId);
  }).pipe(Effect.provide(Attio.providers())),
);
