import { expect } from "@effect/vitest";
import * as SurveysAPI from "@packages/posthog/surveys";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { Survey } from "@/posthog/surveys/index.js";
import { makeAssertDeleted, test } from "../test.js";

const assertSurveyDeleted = makeAssertDeleted(
  "Survey",
  SurveysAPI.getSurvey,
  (survey) => survey.archived === true,
);

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
