import * as PostHogDashboards from "@packages/posthog/dashboards";
import * as Effect from "effect/Effect";

import type { DashboardAttrs } from "./dashboard";

import { Project } from "../project";
import { Dashboard as DashboardResource } from "./dashboard";

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

        diff: Effect.fn(function* ({ id: _id, news: _news, olds: _olds, output: _output }) {
          // All changes are updates, no replacement triggers for dashboards
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogDashboards.getDashboard({
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
            const page = yield* PostHogDashboards.listDashboards({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (d) => d.name === olds.name && !d.deleted
            );

            if (match) {
              // List returns DashboardBasic; fetch full Dashboard for complete attrs
              const full = yield* PostHogDashboards.getDashboard({
                project_id: projectId,
                id: match.id,
              }).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined)
                )
              );

              if (full) {
                return mapResponseToAttrs(full);
              }
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if a dashboard with this name already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Name is not strictly unique, but serves as best-effort detection.
          const existing = yield* PostHogDashboards.listDashboards({
            project_id: projectId,
          }).pipe(
            Effect.map((page) =>
              page.results?.find((d) => d.name === news.name && !d.deleted)
            ),
            Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
          );

          if (existing) {
            // Fetch full dashboard details since list returns DashboardBasic
            const full = yield* PostHogDashboards.getDashboard({
              project_id: projectId,
              id: existing.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined))
            );

            if (full) {
              yield* session.note(
                `Idempotent Dashboard: ${full.name}`
              );
              return mapResponseToAttrs(full);
            }
          }

          const result = yield* PostHogDashboards.createDashboard({
            project_id: projectId,
            name: news.name,
            description: news.description,
            pinned: news.pinned,
            tags: news.tags,
            restriction_level: news.restrictionLevel,
          });

          yield* session.note(`Created Dashboard: ${result.name}`);

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

          yield* session.note(`Updated Dashboard: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* PostHogDashboards.deleteDashboard({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));

          yield* session.note(`Deleted Dashboard: ${output.name}`);
        }),
      };
    })
  );
