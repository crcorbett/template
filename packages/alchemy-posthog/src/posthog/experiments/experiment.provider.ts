import * as PostHogExperiments from "@packages/posthog/experiments";
import * as Effect from "effect/Effect";

import type { ExperimentAttrs } from "./experiment.js";

import { Project } from "../project.js";
import { Experiment as ExperimentResource } from "./experiment.js";

/**
 * Maps a PostHog API response to ExperimentAttrs.
 */
function mapResponseToAttrs(
  result: PostHogExperiments.Experiment
): ExperimentAttrs {
  return {
    id: result.id,
    name: result.name,
    featureFlagKey: result.feature_flag_key,
    startDate: result.start_date,
    endDate: result.end_date,
    archived: result.archived,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Experiment resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const experimentProvider = () =>
  ExperimentResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id", "featureFlagKey"] as const,

        diff: Effect.fn(function* ({ id: _id, news, olds, output: _output }) {
          // If featureFlagKey changes, the experiment must be replaced
          if (news.featureFlagKey !== olds.featureFlagKey) {
            return { action: "replace" as const };
          }
          // Otherwise, update in place
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogExperiments.getExperiment({
              project_id: projectId,
              id: output.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined))
            );

            if (result) {
              return mapResponseToAttrs(result);
            }
          }

          // Fallback: search by featureFlagKey using list API to recover from state loss
          if (olds?.featureFlagKey) {
            const page = yield* PostHogExperiments.listExperiments({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (e) => e.feature_flag_key === olds.featureFlagKey && !e.archived
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          const result = yield* PostHogExperiments.createExperiment({
            project_id: projectId,
            name: news.name,
            description: news.description,
            feature_flag_key: news.featureFlagKey,
            start_date: news.startDate,
            end_date: news.endDate,
            parameters: news.parameters,
            filters: news.filters,
            holdout_id: news.holdoutId,
            type: news.type,
            metrics: news.metrics,
            metrics_secondary: news.metricsSecondary,
          });

          yield* session.note(`Created experiment: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogExperiments.updateExperiment({
            project_id: projectId,
            id: output.id,
            name: news.name,
            description: news.description,
            start_date: news.startDate,
            end_date: news.endDate,
            parameters: news.parameters,
            filters: news.filters,
            holdout_id: news.holdoutId,
            metrics: news.metrics,
            metrics_secondary: news.metricsSecondary,
          });

          yield* session.note(`Updated experiment: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output }) {
          // PostHog experiments don't support HTTP DELETE (returns 405).
          // Soft-delete by archiving the experiment instead.
          yield* PostHogExperiments.updateExperiment({
            project_id: projectId,
            id: output.id,
            archived: true,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
        }),
      };
    })
  );
