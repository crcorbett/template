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
      return {
        stables: ["id", "key"] as const,

        diff: ({ news, olds }) =>
          Effect.sync(() => {
            // If key changes, the flag must be replaced
            if (news.key !== olds.key) {
              return { action: "replace" as const };
            }
            // Otherwise, update in place
            return undefined;
          }),

        read: ({ output }) =>
          Effect.gen(function* () {
            if (!output?.id) {
              return undefined;
            }

            const projectId = yield* Project;

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

        create: ({ news, session }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

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

        update: ({ news, output, session }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

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

        delete: ({ output }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

            yield* PostHogFeatureFlags.deleteFeatureFlag({
              project_id: projectId,
              id: output.id,
            }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
          }),
      };
    })
  );
