import * as PostHogInsights from "@packages/posthog/insights";
import * as Effect from "effect/Effect";

import type { InsightAttrs } from "./insight.js";

import { Project } from "../project.js";
import { Insight as InsightResource } from "./insight.js";

/**
 * Maps a PostHog API response to InsightAttrs.
 */
function mapResponseToAttrs(result: PostHogInsights.Insight): InsightAttrs {
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

        diff: Effect.fn(function* ({ id: _id, news: _news, olds: _olds, output: _output }) {
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogInsights.getInsight({
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
            const page = yield* PostHogInsights.listInsights({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (i) => i.name === olds.name && !i.deleted
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if an insight with this name already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Name is not strictly unique, but serves as best-effort detection.
          if (news.name) {
            const existing = yield* PostHogInsights.listInsights({
              project_id: projectId,
            }).pipe(
              Effect.map((page) =>
                page.results?.find((i) => i.name === news.name && !i.deleted)
              ),
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            if (existing) {
              yield* session.note(
                `Idempotent Insight: ${existing.id}`
              );
              return mapResponseToAttrs(existing);
            }
          }

          const result = yield* PostHogInsights.createInsight({
            project_id: projectId,
            name: news.name,
            description: news.description,
            query: news.query,
            saved: news.saved,
          });

          yield* session.note(`Created Insight: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogInsights.updateInsight({
            project_id: projectId,
            id: output.id,
            name: news.name,
            description: news.description,
            query: news.query,
            saved: news.saved,
          });

          yield* session.note(`Updated Insight: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output, session }) {
          // Insight uses soft delete (PATCH deleted: true)
          yield* PostHogInsights.deleteInsight({
            project_id: projectId,
            id: output.id,
          }).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
            Effect.catchTag("PostHogError", () => Effect.void)
          );

          yield* session.note(`Deleted Insight: ${output.id}`);
        }),
      };
    })
  );
