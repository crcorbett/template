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
      const projectId = yield* Project;

      return {
        stables: ["id", "type"] as const,

        diff: Effect.fn(function* ({ id: _id, news, olds, output: _output }) {
          if (news.type !== olds.type) {
            return { action: "replace" as const };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogSurveys.getSurvey({
              project_id: projectId,
              id: output.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined))
            );

            if (result) {
              return mapResponseToAttrs(result);
            }
          }

          // Fallback: search by name using list API to recover from state loss
          if (olds?.name) {
            const page = yield* PostHogSurveys.listSurveys({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (s) => s.name === olds.name && !s.archived
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
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

        update: Effect.fn(function* ({ news, output, session }) {
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

        delete: Effect.fn(function* ({ output }) {
          yield* PostHogSurveys.deleteSurvey({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
        }),
      };
    })
  );
