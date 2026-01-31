import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioSelectOptions from "@packages/attio/select-options";
import { SelectOption } from "@/attio/select-option/index";
import { test } from "../test";
import * as Attio from "@/attio/index";

test("create, update, delete select option", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    // Use an existing select-type attribute on the deals object
    class TestOption extends SelectOption("TestOption", {
      target: "objects",
      identifier: "deals",
      attribute: "lead_source",
      title: "Alchemy Test Option A",
    }) {}

    const stack = yield* apply(TestOption);
    expect(stack.TestOption.optionId).toBeDefined();
    expect(stack.TestOption.title).toBe("Alchemy Test Option A");

    // Update title
    class UpdatedOption extends SelectOption("TestOption", {
      target: "objects",
      identifier: "deals",
      attribute: "lead_source",
      title: "Alchemy Updated Option A",
    }) {}

    const updated = yield* apply(UpdatedOption);
    expect(updated.TestOption.title).toBe("Alchemy Updated Option A");

    // Destroy (soft archive)
    yield* destroy();

    // Verify archived — listSelectOptions does NOT return archived options,
    // so the option should no longer appear in the list.
    const list = yield* AttioSelectOptions.listSelectOptions({
      target: "objects",
      identifier: "deals",
      attribute: "lead_source",
    });
    const stillVisible = list.data.find(
      (o) => o.title === "Alchemy Updated Option A",
    );
    expect(stillVisible).toBeUndefined();
  }).pipe(Effect.provide(Attio.providers())),
);
