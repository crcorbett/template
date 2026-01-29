import * as PostHogInsights from "@packages/posthog/insights";
import * as Effect from "effect/Effect";

import type { InsightAttrs } from "./insight";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Insight as InsightResource } from "./insight";

/**
 * Maps a PostHog API response to InsightAttrs.
 */
function mapResponseToAttrs(
  result: PostHogInsights.Insight,
): InsightAttrs {
  return {
    id: result.id,
    shortId: result.short_id,
    name: result.name,
    description: result.description,
    createdAt: result.created_at,
    favorited: result.favorited,
  };
}

/**
 * Provider for PostHog Insight resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const insightProvider = () =>
  InsightResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id", "shortId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            JSON.stringify(news.query) !== JSON.stringify(olds.query) ||
            JSON.stringify(news.filters) !== JSON.stringify(olds.filters) ||
            JSON.stringify(news.dashboards) !== JSON.stringify(olds.dashboards) ||
            news.saved !== olds.saved
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogInsights.getInsight({
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
          // NOTE: Insight list API does not support search params; full scan required.
          // Large projects may see degraded performance during fallback lookup.
          if (olds?.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogInsights.listInsights({
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
                (i) => i.name === olds.name && !i.deleted,
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
          // Idempotency: check if an insight with this name already exists.
          // Name is optional for insights; when absent, skip idempotency check
          // since there is no reliable unique identifier to match on.
          // NOTE: Insight list API does not support search params; full scan required.
          if (news.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogInsights.listInsights({
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
                (i) => i.name === news.name && !i.deleted,
              );

              if (existing) {
                yield* session.note(
                  `Idempotent Insight: found existing with name ${existing.name}`,
                );
                return mapResponseToAttrs(existing);
              }

              if (!page.next) break;
              offset += limit;
            }
          }

          const result = yield* retryPolicy(
            PostHogInsights.createInsight({
              project_id: projectId,
              name: news.name,
              description: news.description,
              query: news.query,
              saved: news.saved,
            }),
          );

          yield* session.note(`Created Insight: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogInsights.updateInsight({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
              query: news.query,
              saved: news.saved,
            }),
          );

          yield* session.note(`Updated Insight: ${result.id}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          // Insight uses soft delete (PATCH deleted: true)
          yield* retryPolicy(
            PostHogInsights.deleteInsight({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Insight: ${output.id}`);
        }),
      };
    }),
  );
