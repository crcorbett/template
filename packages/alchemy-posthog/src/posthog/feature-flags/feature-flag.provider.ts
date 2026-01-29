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

        diff: Effect.fn(function* ({ id: _id, news, olds, output: _output }) {
          // If key changes, the flag must be replaced
          if (news.key !== olds.key) {
            return { action: "replace" as const };
          }
          // Otherwise, update in place
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogFeatureFlags.getFeatureFlag({
              project_id: projectId,
              id: output.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined))
            );

            if (result) {
              return mapResponseToAttrs(result);
            }
          }

          // Fallback: search by key using list API to recover from state loss
          if (olds?.key) {
            const page = yield* PostHogFeatureFlags.listFeatureFlags({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (f) => f.key === olds.key && !f.deleted
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if a feature flag with this key already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Since FeatureFlag.key is unique, we look it up to avoid duplicates.
          const existing = yield* PostHogFeatureFlags.listFeatureFlags({
            project_id: projectId,
          }).pipe(
            Effect.map((page) =>
              page.results?.find((f) => f.key === news.key && !f.deleted)
            ),
            Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
          );

          if (existing) {
            yield* session.note(
              `Idempotent FeatureFlag: ${existing.key}`
            );
            return mapResponseToAttrs(existing);
          }

          const result = yield* PostHogFeatureFlags.createFeatureFlag({
            project_id: projectId,
            key: news.key,
            name: news.name,
            active: news.active,
            filters: news.filters as Record<string, unknown> | undefined,
            rollout_percentage: news.rolloutPercentage,
            ensure_experience_continuity: news.ensureExperienceContinuity,
          });

          yield* session.note(`Created FeatureFlag: ${result.key}`);

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

          yield* session.note(`Updated FeatureFlag: ${result.key}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* PostHogFeatureFlags.deleteFeatureFlag({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));

          yield* session.note(`Deleted FeatureFlag: ${output.key}`);
        }),
      };
    })
  );
