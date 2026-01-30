import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioObjects from "@packages/attio/objects";
import { Object as AttioObject } from "@/attio/object/index";
import { test } from "../test";
import * as Attio from "@/attio/index";

test("create and update object", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    class TestObject extends AttioObject("TestObject", {
      apiSlug: "test_obj_crud",
      singularNoun: "Test Obj",
      pluralNoun: "Test Objs",
    }) {}

    const stack = yield* apply(TestObject);
    expect(stack.TestObject.objectId).toBeDefined();
    expect(stack.TestObject.apiSlug).toBe("test_obj_crud");

    // Verify object exists via direct API call (noun may differ from prior runs since objects can't be deleted)
    const fetched = yield* AttioObjects.getObject({ object: "test_obj_crud" });
    expect(fetched.data.api_slug).toBe("test_obj_crud");

    // Update nouns
    class UpdatedObject extends AttioObject("TestObject", {
      apiSlug: "test_obj_crud",
      singularNoun: "Updated Obj",
      pluralNoun: "Updated Objs",
    }) {}

    const updated = yield* apply(UpdatedObject);
    // objectId should remain stable
    expect(updated.TestObject.objectId).toBe(stack.TestObject.objectId);
    expect(updated.TestObject.singularNoun).toBe("Updated Obj");

    // Verify update via API
    const fetchedAfter = yield* AttioObjects.getObject({ object: "test_obj_crud" });
    expect(fetchedAfter.data.singular_noun).toBe("Updated Obj");

    // Destroy (no-op for objects)
    yield* destroy();

    // Object should still exist after destroy
    const fetchedFinal = yield* AttioObjects.getObject({ object: "test_obj_crud" });
    expect(fetchedFinal.data.api_slug).toBe("test_obj_crud");
  }).pipe(Effect.provide(Attio.providers())),
);
