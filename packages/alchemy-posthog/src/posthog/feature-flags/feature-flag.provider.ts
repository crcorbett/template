import * as PostHogFeatureFlags from "@packages/posthog/feature-flags";
import * as Effect from "effect/Effect";

import type { FeatureFlagAttrs } from "./feature-flag.js";

import { Project } from "../project.js";
import { FeatureFlag as FeatureFlagResource } from "./feature-flag.js";

/**
 * Maps a PostHog API response to FeatureFlagAttrs.
 */
function mapResponseToAttrs(
  result: PostHogFeatureFlags.FeatureFlag
): FeatureFlagAttrs {
  return {
    id: result.id,
    key: result.key,
    name: result.name,
    active: result.active,
    filters: result.filters,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Feature Flag resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const featureFlagProvider = () =>
  FeatureFlagResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id", "key"] as const,

        diff: Effect.fn(function* ({ news, olds }) {
          // If key changes, the flag must be replaced
          if (news.key !== olds.key) {
            return { action: "replace" as const };
          }
          // Otherwise, update in place
          return undefined;
        }),

        read: Effect.fn(function* ({ output }) {
          if (!output?.id) {
            return undefined;
          }

          const result = yield* PostHogFeatureFlags.getFeatureFlag({
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

        create: Effect.fn(function* ({ news, session }) {
          const result = yield* PostHogFeatureFlags.createFeatureFlag({
            project_id: projectId,
            key: news.key,
            name: news.name,
            active: news.active,
            filters: news.filters as Record<string, unknown> | undefined,
            rollout_percentage: news.rolloutPercentage,
            ensure_experience_continuity: news.ensureExperienceContinuity,
          });

          yield* session.note(`Created feature flag: ${result.key}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogFeatureFlags.updateFeatureFlag({
            project_id: projectId,
            id: output.id,
            key: news.key,
            name: news.name,
            active: news.active,
            filters: news.filters as Record<string, unknown> | undefined,
            rollout_percentage: news.rolloutPercentage,
            ensure_experience_continuity: news.ensureExperienceContinuity,
          });

          yield* session.note(`Updated feature flag: ${result.key}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* PostHogFeatureFlags.deleteFeatureFlag({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
        }),
      };
    })
  );
