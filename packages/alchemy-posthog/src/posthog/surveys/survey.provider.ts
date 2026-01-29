import * as PostHogSurveys from "@packages/posthog/surveys";
import * as Effect from "effect/Effect";

import type { SurveyAttrs } from "./survey.js";

import { Project } from "../project.js";
import { Survey as SurveyResource } from "./survey.js";

/**
 * Maps a PostHog API response to SurveyAttrs.
 */
function mapResponseToAttrs(result: PostHogSurveys.Survey): SurveyAttrs {
  return {
    id: result.id,
    name: result.name,
    type: result.type,
    startDate: result.start_date,
    endDate: result.end_date,
    archived: result.archived,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Survey resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const surveyProvider = () =>
  SurveyResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["id", "type"] as const,

        diff: ({ news, olds }) =>
          Effect.sync(() => {
            if (news.type !== olds.type) {
              return { action: "replace" as const };
            }
            return undefined;
          }),

        read: ({ output }) =>
          Effect.gen(function* () {
            if (!output?.id) {
              return undefined;
            }

            const projectId = yield* Project;

            const result = yield* PostHogSurveys.getSurvey({
              project_id: projectId,
              id: output.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined))
            );

            if (!result) {
              return undefined;
            }

            return mapResponseToAttrs(result);
          }),

        create: ({ news, session }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

            const result = yield* PostHogSurveys.createSurvey({
              project_id: projectId,
              name: news.name,
              description: news.description,
              type: news.type,
              questions: news.questions,
              appearance: news.appearance,
              start_date: news.startDate,
              end_date: news.endDate,
              responses_limit: news.responsesLimit,
              linked_flag_id: news.linkedFlagId,
            });

            yield* session.note(`Created survey: ${result.name}`);

            return mapResponseToAttrs(result);
          }),

        update: ({ news, output, session }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

            const result = yield* PostHogSurveys.updateSurvey({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
              type: news.type,
              questions: news.questions,
              appearance: news.appearance,
              start_date: news.startDate,
              end_date: news.endDate,
              responses_limit: news.responsesLimit,
            });

            yield* session.note(`Updated survey: ${result.name}`);

            return mapResponseToAttrs(result);
          }),

        delete: ({ output }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

            yield* PostHogSurveys.deleteSurvey({
              project_id: projectId,
              id: output.id,
            }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
          }),
      };
    })
  );
