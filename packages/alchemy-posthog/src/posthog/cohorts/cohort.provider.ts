import * as PostHogCohorts from "@packages/posthog/cohorts";
import * as Effect from "effect/Effect";

import type { CohortAttrs } from "./cohort.js";

import { Project } from "../project.js";
import { Cohort as CohortResource } from "./cohort.js";

/**
 * Maps a PostHog API response to CohortAttrs.
 */
function mapResponseToAttrs(result: PostHogCohorts.Cohort): CohortAttrs {
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

        diff: Effect.fn(function* ({ id: _id, news, olds, output: _output }) {
          if (news.isStatic !== olds.isStatic) {
            return { action: "replace" as const };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogCohorts.getCohort({
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
            const page = yield* PostHogCohorts.listCohorts({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (c) => c.name === olds.name && !c.deleted
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if a cohort with this name already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Name is not strictly unique, but serves as best-effort detection.
          const existing = yield* PostHogCohorts.listCohorts({
            project_id: projectId,
          }).pipe(
            Effect.map((page) =>
              page.results?.find((c) => c.name === news.name && !c.deleted)
            ),
            Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
          );

          if (existing) {
            yield* session.note(
              `Idempotent Cohort: ${existing.name}`
            );
            return mapResponseToAttrs(existing);
          }

          const result = yield* PostHogCohorts.createCohort({
            project_id: projectId,
            name: news.name,
            description: news.description,
            groups: news.groups,
            filters: news.filters,
            is_static: news.isStatic,
          });

          yield* session.note(`Created Cohort: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogCohorts.updateCohort({
            project_id: projectId,
            id: output.id,
            name: news.name,
            description: news.description,
            groups: news.groups,
            filters: news.filters,
          });

          yield* session.note(`Updated Cohort: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* PostHogCohorts.deleteCohort({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));

          yield* session.note(`Deleted Cohort: ${output.name}`);
        }),
      };
    })
  );
