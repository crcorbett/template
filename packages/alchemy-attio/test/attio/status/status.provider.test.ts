import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioStatuses from "@packages/attio/statuses";
import { Status } from "@/attio/status/index";
import { test } from "../test";
import * as Attio from "@/attio/index";

test("create, update, delete status", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    // Use an existing status-type attribute on the deals object
    class TestStatus extends Status("TestStatus", {
      target: "objects",
      identifier: "deals",
      attribute: "stage",
      title: "Alchemy Test Active",
    }) {}

    const stack = yield* apply(TestStatus);
    expect(stack.TestStatus.statusId).toBeDefined();
    expect(stack.TestStatus.title).toBe("Alchemy Test Active");

    // Update title
    class UpdatedStatus extends Status("TestStatus", {
      target: "objects",
      identifier: "deals",
      attribute: "stage",
      title: "Alchemy Updated Active",
      celebrationEnabled: true,
    }) {}

    const updated = yield* apply(UpdatedStatus);
    expect(updated.TestStatus.title).toBe("Alchemy Updated Active");
    expect(updated.TestStatus.celebrationEnabled).toBe(true);

    // Destroy (soft archive)
    yield* destroy();

    // Verify archived — listStatuses does NOT return archived statuses,
    // so the status should no longer appear in the list.
    const list = yield* AttioStatuses.listStatuses({
      target: "objects",
      identifier: "deals",
      attribute: "stage",
    });
    const stillVisible = list.data.find(
      (s) => s.id.status_id === stack.TestStatus.statusId,
    );
    expect(stillVisible).toBeUndefined();
  }).pipe(Effect.provide(Attio.providers())),
);
