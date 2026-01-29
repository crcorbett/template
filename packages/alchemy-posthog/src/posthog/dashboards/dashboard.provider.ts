import * as PostHogDashboards from "@packages/posthog/dashboards";
import * as Effect from "effect/Effect";

import type { DashboardAttrs } from "./dashboard";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Dashboard as DashboardResource } from "./dashboard";

/**
 * Maps a PostHog API response to DashboardAttrs.
 */
function mapResponseToAttrs(
  result: PostHogDashboards.Dashboard,
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

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // All changes are updates, no replacement triggers for dashboards
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            news.pinned !== olds.pinned ||
            JSON.stringify(news.tags) !== JSON.stringify(olds.tags) ||
            news.restrictionLevel !== olds.restrictionLevel
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogDashboards.getDashboard({
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
          // NOTE: Dashboard list API does not support search params; full scan required.
          // Large projects may see degraded performance during fallback lookup.
          if (olds?.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogDashboards.listDashboards({
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
                (d) => d.name === olds.name && !d.deleted,
              );

              if (match) {
                // List returns DashboardBasic; fetch full Dashboard for complete attrs
                const full = yield* retryPolicy(
                  PostHogDashboards.getDashboard({
                    project_id: projectId,
                    id: match.id,
                  }),
                ).pipe(
                  Effect.catchTag("NotFoundError", () =>
                    Effect.succeed(undefined),
                  ),
                );

                if (full) {
                  return mapResponseToAttrs(full);
                }
              }

              if (!page.next) break;
              offset += limit;
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if a dashboard with this name already exists.
          // NOTE: Dashboard list API does not support search params; full scan required.
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              PostHogDashboards.listDashboards({
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
              (d) => d.name === news.name && !d.deleted,
            );

            if (existing) {
              // Fetch full dashboard details since list returns DashboardBasic
              const full = yield* retryPolicy(
                PostHogDashboards.getDashboard({
                  project_id: projectId,
                  id: existing.id,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (full) {
                yield* session.note(
                  `Idempotent Dashboard: found existing with name ${existing.name}`,
                );
                return mapResponseToAttrs(full);
              }
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            PostHogDashboards.createDashboard({
              project_id: projectId,
              name: news.name,
              description: news.description,
              pinned: news.pinned,
              tags: news.tags,
              restriction_level: news.restrictionLevel,
            }),
          );

          yield* session.note(`Created Dashboard: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogDashboards.updateDashboard({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
              pinned: news.pinned,
              tags: news.tags,
              restriction_level: news.restrictionLevel,
            }),
          );

          yield* session.note(`Updated Dashboard: ${result.name}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            PostHogDashboards.deleteDashboard({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Dashboard: ${output.name}`);
        }),
      };
    }),
  );
