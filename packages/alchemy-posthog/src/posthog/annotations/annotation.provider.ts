import * as PostHogAnnotations from "@packages/posthog/annotations";
import * as Effect from "effect/Effect";

import type { AnnotationAttrs } from "./annotation";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Annotation as AnnotationResource } from "./annotation";

/**
 * Maps a PostHog API response to AnnotationAttrs.
 */
function mapResponseToAttrs(
  result: PostHogAnnotations.Annotation,
): AnnotationAttrs {
  return {
    id: result.id,
    content: result.content,
    dateMarker: result.date_marker,
    scope: result.scope,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Annotation resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const annotationProvider = () =>
  AnnotationResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (
            news.content !== olds.content ||
            news.dateMarker !== olds.dateMarker ||
            news.creationType !== olds.creationType ||
            news.dashboardItem !== olds.dashboardItem ||
            news.scope !== olds.scope
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogAnnotations.getAnnotation({
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

          // Fallback: search by content + dateMarker using list API to recover from state loss
          if (olds?.content) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogAnnotations.listAnnotations({
                  project_id: projectId,
                  limit,
                  offset,
                  search: olds.content,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.results?.length) break;

              const match = page.results.find(
                (a) =>
                  a.content === olds.content &&
                  a.date_marker === olds.dateMarker &&
                  !a.deleted,
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
          // Idempotency: check if an annotation with this content + dateMarker already exists.
          if (news.content) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogAnnotations.listAnnotations({
                  project_id: projectId,
                  limit,
                  offset,
                  search: news.content,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.results?.length) break;

              const existing = page.results.find(
                (a) =>
                  a.content === news.content &&
                  a.date_marker === news.dateMarker &&
                  !a.deleted,
              );

              if (existing) {
                yield* session.note(
                  `Idempotent Annotation: found existing with id ${existing.id}`,
                );
                return mapResponseToAttrs(existing);
              }

              if (!page.next) break;
              offset += limit;
            }
          }

          const result = yield* retryPolicy(
            PostHogAnnotations.createAnnotation({
              project_id: projectId,
              content: news.content,
              date_marker: news.dateMarker,
              creation_type: news.creationType,
              dashboard_item: news.dashboardItem,
              scope: news.scope,
            }),
          );

          yield* session.note(`Created Annotation: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogAnnotations.updateAnnotation({
              project_id: projectId,
              id: output.id,
              content: news.content,
              date_marker: news.dateMarker,
              scope: news.scope,
            }),
          );

          yield* session.note(`Updated Annotation: ${result.id}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          // PostHog annotations don't reliably support HTTP DELETE.
          // Soft-delete by patching deleted: true instead.
          yield* retryPolicy(
            PostHogAnnotations.updateAnnotation({
              project_id: projectId,
              id: output.id,
              deleted: true,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Annotation: ${output.id}`);
        }),
      };
    }),
  );
