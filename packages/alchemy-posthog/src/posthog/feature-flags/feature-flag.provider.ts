import * as PostHogFeatureFlags from "@packages/posthog/feature-flags";
import * as Effect from "effect/Effect";

import type { FeatureFlagAttrs } from "./feature-flag";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { FeatureFlag as FeatureFlagResource } from "./feature-flag";

/**
 * Maps a PostHog API response to FeatureFlagAttrs.
 */
function mapResponseToAttrs(
  result: PostHogFeatureFlags.FeatureFlag,
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

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // If key changes, the flag must be replaced
          if (news.key !== olds.key) {
            return { action: "replace" };
          }
          // Check if any updateable properties differ
          if (
            news.name !== olds.name ||
            news.active !== olds.active ||
            JSON.stringify(news.filters) !== JSON.stringify(olds.filters) ||
            news.rolloutPercentage !== olds.rolloutPercentage ||
            news.ensureExperienceContinuity !== olds.ensureExperienceContinuity
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogFeatureFlags.getFeatureFlag({
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

          // Fallback: search by key using list API to recover from state loss
          // NOTE: FeatureFlag list API does not support search params; full scan required.
          // Large projects may see degraded performance during fallback lookup.
          if (olds?.key) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogFeatureFlags.listFeatureFlags({
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
                (f) => f.key === olds.key && !f.deleted,
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
          // Idempotency: check if a feature flag with this key already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Since FeatureFlag.key is unique, we look it up to avoid duplicates.
          // NOTE: FeatureFlag list API does not support search params; full scan required.
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              PostHogFeatureFlags.listFeatureFlags({
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
              (f) => f.key === news.key && !f.deleted,
            );

            if (existing) {
              yield* session.note(
                `Idempotent FeatureFlag: found existing with key ${existing.key}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            PostHogFeatureFlags.createFeatureFlag({
              project_id: projectId,
              key: news.key,
              name: news.name,
              active: news.active,
              filters: news.filters as Record<string, unknown> | undefined,
              rollout_percentage: news.rolloutPercentage,
              ensure_experience_continuity: news.ensureExperienceContinuity,
            }),
          );

          yield* session.note(`Created FeatureFlag: ${result.key}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogFeatureFlags.updateFeatureFlag({
              project_id: projectId,
              id: output.id,
              key: news.key,
              name: news.name,
              active: news.active,
              filters: news.filters as Record<string, unknown> | undefined,
              rollout_percentage: news.rolloutPercentage,
              ensure_experience_continuity: news.ensureExperienceContinuity,
            }),
          );

          yield* session.note(`Updated FeatureFlag: ${result.key}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            PostHogFeatureFlags.deleteFeatureFlag({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted FeatureFlag: ${output.key}`);
        }),
      };
    }),
  );
