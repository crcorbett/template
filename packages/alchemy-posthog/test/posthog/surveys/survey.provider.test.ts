import { expect } from "@effect/vitest";
import * as SurveysAPI from "@packages/posthog/surveys";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { Survey } from "@/posthog/surveys/index.js";
import { test } from "../test.js";

class SurveyNotDeletedError extends Data.TaggedError("SurveyNotDeletedError")<{
  readonly id: string;
}> {}

const assertSurveyDeleted = Effect.fn(function* (id: string) {
  const projectId = yield* Project;
  yield* SurveysAPI.getSurvey({
    project_id: projectId,
    id,
  }).pipe(
    Effect.flatMap((survey) => {
      if (survey.archived === true) {
        return Effect.void;
      }
      return Effect.fail(new SurveyNotDeletedError({ id }));
    }),
    Effect.catchTag("NotFoundError", () => Effect.void),
    Effect.catchTag("PostHogError", (err) => {
      if (err.code === "404") {
        return Effect.void;
      }
      return Effect.fail(err);
    }),
    Effect.retry(
      Schedule.intersect(Schedule.recurs(5), Schedule.exponential("100 millis"))
    )
  );
});

test(
  "create, update, delete survey",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;

    class TestSurvey extends Survey("TestSurvey", {
      name: "Test Survey",
      type: "api",
    }) {}

    const stack = yield* apply(TestSurvey);

    expect(stack.TestSurvey.id).toBeDefined();
    expect(typeof stack.TestSurvey.id).toBe("string");
    expect(stack.TestSurvey.name).toBe(TestSurvey.props.name);
    expect(stack.TestSurvey.type).toBe("api");

    // Verify via direct API call
    const fetched = yield* SurveysAPI.getSurvey({
      project_id: projectId,
      id: stack.TestSurvey.id,
    });
    expect(fetched.name).toBe(TestSurvey.props.name);
    expect(fetched.type).toBe("api");

    // Update: change name
    class UpdatedSurvey extends Survey("TestSurvey", {
      name: "Updated Survey",
      type: "api",
    }) {}

    const updated = yield* apply(UpdatedSurvey);

    expect(updated.TestSurvey.id).toBe(stack.TestSurvey.id);
    expect(updated.TestSurvey.name).toBe(UpdatedSurvey.props.name);

    const fetchedUpdated = yield* SurveysAPI.getSurvey({
      project_id: projectId,
      id: stack.TestSurvey.id,
    });
    expect(fetchedUpdated.name).toBe(UpdatedSurvey.props.name);

    // Destroy
    yield* destroy();

    yield* assertSurveyDeleted(stack.TestSurvey.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
