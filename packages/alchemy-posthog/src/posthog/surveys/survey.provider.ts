import * as PostHogSurveys from "@packages/posthog/surveys";
import * as Effect from "effect/Effect";

import type { SurveyAttrs } from "./survey";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Survey as SurveyResource } from "./survey";

/**
 * Maps a PostHog API response to SurveyAttrs.
 */
function mapResponseToAttrs(
  result: PostHogSurveys.Survey,
): SurveyAttrs {
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

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.type !== olds.type) {
            return { action: "replace" };
          }
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            JSON.stringify(news.questions) !== JSON.stringify(olds.questions) ||
            JSON.stringify(news.appearance) !== JSON.stringify(olds.appearance) ||
            news.startDate !== olds.startDate ||
            news.endDate !== olds.endDate ||
            news.responsesLimit !== olds.responsesLimit ||
            news.linkedFlagId !== olds.linkedFlagId
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogSurveys.getSurvey({
                project_id: projectId,
                id: output.id,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined)),
            );

            if (result) {
              return mapResponseToAttrs(result);
            }
          }

          // Fallback: search by name using list API to recover from state loss
          if (olds?.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogSurveys.listSurveys({
                  project_id: projectId,
                  limit,
                  offset,
                  search: olds.name,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.results?.length) break;

              const match = page.results.find(
                (s) => s.name === olds.name && !s.archived,
              );

              if (match) {
                return mapResponseToAttrs(match);
              }

              if (!page.next) break;
              offset += limit;
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if a survey with this name already exists.
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              PostHogSurveys.listSurveys({
                project_id: projectId,
                limit,
                offset,
                search: news.name,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (!page?.results?.length) break;

            const existing = page.results.find(
              (s) => s.name === news.name && !s.archived,
            );

            if (existing) {
              yield* session.note(
                `Idempotent Survey: found existing with name ${existing.name}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            PostHogSurveys.createSurvey({
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
            }),
          );

          yield* session.note(`Created Survey: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogSurveys.updateSurvey({
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
            }),
          );

          yield* session.note(`Updated Survey: ${result.name}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            PostHogSurveys.deleteSurvey({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Survey: ${output.name}`);
        }),
      };
    }),
  );
