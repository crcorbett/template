import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioRecords from "@packages/attio/records";
import { Record } from "@/attio/record/index";
import { test, makeAssertDeleted } from "../test";
import * as Attio from "@/attio/index";

const assertRecordDeleted = makeAssertDeleted(
  "Record",
  (recordId: string) =>
    AttioRecords.getRecord({ object: "people", record_id: recordId }),
);

test("create, update, delete record", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    class TestRecord extends Record("TestRecord", {
      object: "people",
      matchingAttribute: "email_addresses",
      data: {
        email_addresses: [{ email_address: "alchemy-test-crud@example.com" }],
      },
    }) {}

    const stack = yield* apply(TestRecord);
    expect(stack.TestRecord.recordId).toBeDefined();
    expect(stack.TestRecord.objectId).toBeDefined();
    expect(stack.TestRecord.object).toBe("people");

    // Verify via API
    const fetched = yield* AttioRecords.getRecord({
      object: "people",
      record_id: stack.TestRecord.recordId,
    });
    expect(fetched.data.created_at).toBeDefined();

    // Update data (add description)
    class UpdatedRecord extends Record("TestRecord", {
      object: "people",
      matchingAttribute: "email_addresses",
      data: {
        email_addresses: [{ email_address: "alchemy-test-crud@example.com" }],
        description: [{ value: "Updated by alchemy test" }],
      },
    }) {}

    const updated = yield* apply(UpdatedRecord);
    expect(updated.TestRecord.recordId).toBe(stack.TestRecord.recordId);

    // Destroy
    yield* destroy();
    yield* assertRecordDeleted(stack.TestRecord.recordId);
  }).pipe(Effect.provide(Attio.providers())),
);
