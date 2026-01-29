import * as PostHogCohorts from "@packages/posthog/cohorts";
import * as Effect from "effect/Effect";

import type { CohortAttrs } from "./cohort";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Cohort as CohortResource } from "./cohort";

/**
 * Maps a PostHog API response to CohortAttrs.
 */
function mapResponseToAttrs(
  result: PostHogCohorts.Cohort,
): CohortAttrs {
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    isCalculating: result.is_calculating,
    count: result.count,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Cohort resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const cohortProvider = () =>
  CohortResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.isStatic !== olds.isStatic) {
            return { action: "replace" };
          }
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            JSON.stringify(news.groups) !== JSON.stringify(olds.groups) ||
            JSON.stringify(news.filters) !== JSON.stringify(olds.filters)
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogCohorts.getCohort({
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
          // NOTE: Cohort list API does not support search params; full scan required.
          // Large projects may see degraded performance during fallback lookup.
          if (olds?.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogCohorts.listCohorts({
                  project_id: projectId,
                  limit,
                  offset,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.results?.length) break;

              const match = page.results.find(
                (c) => c.name === olds.name && !c.deleted,
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
          // Idempotency: check if a cohort with this name already exists.
          // NOTE: Cohort list API does not support search params; full scan required.
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              PostHogCohorts.listCohorts({
                project_id: projectId,
                limit,
                offset,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (!page?.results?.length) break;

            const existing = page.results.find(
              (c) => c.name === news.name && !c.deleted,
            );

            if (existing) {
              yield* session.note(
                `Idempotent Cohort: found existing with name ${existing.name}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            PostHogCohorts.createCohort({
              project_id: projectId,
              name: news.name,
              description: news.description,
              groups: news.groups,
              filters: news.filters,
              is_static: news.isStatic,
            }),
          );

          yield* session.note(`Created Cohort: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogCohorts.updateCohort({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
              groups: news.groups,
              filters: news.filters,
            }),
          );

          yield* session.note(`Updated Cohort: ${result.name}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            PostHogCohorts.deleteCohort({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Cohort: ${output.name}`);
        }),
      };
    }),
  );
