# Reference: Soft-Delete Provider (Archive Pattern)

Source: `packages/alchemy-posthog/src/posthog/experiments/experiment.provider.ts`

This provider demonstrates two patterns NOT shown in the FeatureFlag reference:
1. **Soft-delete via archive** — The API returns 405 on DELETE, so we PATCH `archived: true` instead
2. **`!e.archived` filtering** — List scans filter by `archived` instead of `deleted`
3. **`search` param usage** — Survey provider uses `search` param; Experiment does full scan (API limitation)

```typescript
import * as PostHogExperiments from "@packages/posthog/experiments";
import * as Effect from "effect/Effect";

import type { ExperimentAttrs } from "./experiment";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Experiment as ExperimentResource } from "./experiment";

/**
 * Maps a PostHog API response to ExperimentAttrs.
 */
function mapResponseToAttrs(
  result: PostHogExperiments.Experiment,
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

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // If featureFlagKey changes, the experiment must be replaced
          if (news.featureFlagKey !== olds.featureFlagKey) {
            return { action: "replace" };
          }
          // Check if any updateable properties differ
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            news.startDate !== olds.startDate ||
            news.endDate !== olds.endDate ||
            JSON.stringify(news.parameters) !== JSON.stringify(olds.parameters) ||
            JSON.stringify(news.filters) !== JSON.stringify(olds.filters) ||
            news.holdoutId !== olds.holdoutId ||
            news.type !== olds.type ||
            JSON.stringify(news.metrics) !== JSON.stringify(olds.metrics) ||
            JSON.stringify(news.metricsSecondary) !== JSON.stringify(olds.metricsSecondary)
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogExperiments.getExperiment({
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

          // Fallback: search by featureFlagKey — full scan required (no search param)
          if (olds?.featureFlagKey) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogExperiments.listExperiments({
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

              // NOTE: filters by !archived (not !deleted) — API-specific
              const match = page.results.find(
                (e) => e.feature_flag_key === olds.featureFlagKey && !e.archived,
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
          // Idempotency check — full scan (no search param)
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              PostHogExperiments.listExperiments({
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
              (e) =>
                e.feature_flag_key === news.featureFlagKey && !e.archived,
            );

            if (existing) {
              yield* session.note(
                `Idempotent Experiment: found existing with feature flag key ${existing.feature_flag_key}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            PostHogExperiments.createExperiment({
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
            }),
          );

          yield* session.note(`Created Experiment: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogExperiments.updateExperiment({
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
            }),
          );

          yield* session.note(`Updated Experiment: ${result.name}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        // SOFT-DELETE: PostHog experiments return 405 on HTTP DELETE.
        // Archive the experiment instead via PATCH { archived: true }.
        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            PostHogExperiments.updateExperiment({
              project_id: projectId,
              id: output.id,
              archived: true,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Experiment: ${output.name}`);
        }),
      };
    }),
  );
```
