import { beforeAll, expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioAttributes from "@packages/attio/attributes";
import { Attribute } from "@/attio/attribute/index";
import { test, resetAttribute } from "../test";
import * as Attio from "@/attio/index";

// Reset attribute title from previous test runs (attributes can't be deleted)
beforeAll(async () => {
  await Effect.runPromise(
    resetAttribute({
      target: "objects",
      identifier: "people",
      attribute: "test_attr_crud",
      title: "Test Attr Field",
    }),
  );
});

test("create and update attribute", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    // Create attribute on the built-in "people" object
    class TestAttr extends Attribute("TestAttr", {
      target: "objects",
      identifier: "people",
      title: "Test Attr Field",
      type: "text",
      apiSlug: "test_attr_crud",
    }) {}

    const stack = yield* apply(TestAttr);
    expect(stack.TestAttr.attributeId).toBeDefined();
    expect(stack.TestAttr.apiSlug).toBe("test_attr_crud");
    expect(stack.TestAttr.type).toBe("text");

    // Verify via API
    const fetched = yield* AttioAttributes.getAttribute({
      target: "objects",
      identifier: "people",
      attribute: "test_attr_crud",
    });
    expect(fetched.data.title).toBe("Test Attr Field");

    // Update title/description
    class UpdatedAttr extends Attribute("TestAttr", {
      target: "objects",
      identifier: "people",
      title: "Updated Test Field",
      type: "text",
      apiSlug: "test_attr_crud",
      description: "Test description",
    }) {}

    const updated = yield* apply(UpdatedAttr);
    expect(updated.TestAttr.apiSlug).toBe("test_attr_crud");
    expect(updated.TestAttr.title).toBe("Updated Test Field");

    // Destroy (no-op for attributes)
    yield* destroy();

    // Attribute should still exist after destroy
    const fetchedFinal = yield* AttioAttributes.getAttribute({
      target: "objects",
      identifier: "people",
      attribute: "test_attr_crud",
    });
    expect(fetchedFinal.data.api_slug).toBe("test_attr_crud");
  }).pipe(Effect.provide(Attio.providers())),
);
