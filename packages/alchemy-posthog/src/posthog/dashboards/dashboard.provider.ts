import * as PostHogDashboards from "@packages/posthog/dashboards";
import * as Effect from "effect/Effect";

import type { DashboardAttrs } from "./dashboard.js";

import { Project } from "../project.js";
import { Dashboard as DashboardResource } from "./dashboard.js";

/**
 * Maps a PostHog API response to DashboardAttrs.
 */
function mapResponseToAttrs(
  result: PostHogDashboards.Dashboard
): DashboardAttrs {
  return {
    id: result.id,
    name: result.name ?? "",
    description: result.description,
    pinned: result.pinned,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Dashboard resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const dashboardProvider = () =>
  DashboardResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id"] as const,

        diff: Effect.fn(function* () {
          // All changes are updates, no replacement triggers for dashboards
          return undefined;
        }),

        read: Effect.fn(function* ({ output }) {
          if (!output?.id) {
            return undefined;
          }

          const result = yield* PostHogDashboards.getDashboard({
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
          const result = yield* PostHogDashboards.createDashboard({
            project_id: projectId,
            name: news.name,
            description: news.description,
            pinned: news.pinned,
            tags: news.tags,
            restriction_level: news.restrictionLevel,
          });

          yield* session.note(`Created dashboard: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogDashboards.updateDashboard({
            project_id: projectId,
            id: output.id,
            name: news.name,
            description: news.description,
            pinned: news.pinned,
            tags: news.tags,
            restriction_level: news.restrictionLevel,
          });

          yield* session.note(`Updated dashboard: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* PostHogDashboards.deleteDashboard({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
        }),
      };
    })
  );
