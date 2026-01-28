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
    saved: result.saved,
  };
}

/**
 * Provider for PostHog Insight resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const insightProvider = () =>
  InsightResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["id", "shortId"] as const,

        diff: () => Effect.sync(() => undefined),

        read: ({ output }) =>
          Effect.gen(function* () {
            if (!output?.id) {
              return undefined;
            }

            const projectId = yield* Project;

            const result = yield* PostHogInsights.getInsight({
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

            const result = yield* PostHogInsights.createInsight({
              project_id: projectId,
              name: news.name,
              description: news.description,
              query: news.query,
              filters: news.filters,
              dashboards: news.dashboards,
              saved: news.saved,
            });

            yield* session.note(`Created insight: ${result.id}`);

            return mapResponseToAttrs(result);
          }),

        update: ({ news, output, session }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

            const result = yield* PostHogInsights.updateInsight({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
              query: news.query,
              filters: news.filters,
              dashboards: news.dashboards,
              saved: news.saved,
            });

            yield* session.note(`Updated insight: ${result.id}`);

            return mapResponseToAttrs(result);
          }),

        delete: ({ output }) =>
          Effect.gen(function* () {
            const projectId = yield* Project;

            // Insight uses soft delete (PATCH deleted: true)
            yield* PostHogInsights.deleteInsight({
              project_id: projectId,
              id: output.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.void),
              Effect.catchTag("PostHogError", () => Effect.void)
            );
          }),
      };
    })
  );
