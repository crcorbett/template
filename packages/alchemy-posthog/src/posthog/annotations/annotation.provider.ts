import * as PostHogAnnotations from "@packages/posthog/annotations";
import * as Effect from "effect/Effect";

import type { AnnotationAttrs } from "./annotation";

import { Project } from "../project";
import { Annotation as AnnotationResource } from "./annotation";

/**
 * Maps a PostHog API response to AnnotationAttrs.
 */
function mapResponseToAttrs(
  result: PostHogAnnotations.Annotation
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

        diff: Effect.fn(function* ({ id: _id, news: _news, olds: _olds, output: _output }) {
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogAnnotations.getAnnotation({
              project_id: projectId,
              id: output.id,
            }).pipe(
              Effect.catchTag("NotFoundError", () => Effect.succeed(undefined))
            );

            if (result) {
              return mapResponseToAttrs(result);
            }
          }

          // Fallback: search by content + dateMarker using list API to recover from state loss
          if (olds?.content) {
            const page = yield* PostHogAnnotations.listAnnotations({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (a) =>
                a.content === olds.content &&
                a.date_marker === olds.dateMarker &&
                !a.deleted
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if an annotation with this content + dateMarker already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Content + dateMarker combination serves as best-effort detection.
          const existing = yield* PostHogAnnotations.listAnnotations({
            project_id: projectId,
          }).pipe(
            Effect.map((page) =>
              page.results?.find(
                (a) =>
                  a.content === news.content &&
                  a.date_marker === news.dateMarker &&
                  !a.deleted
              )
            ),
            Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
          );

          if (existing) {
            yield* session.note(
              `Idempotent Annotation: ${existing.id}`
            );
            return mapResponseToAttrs(existing);
          }

          const result = yield* PostHogAnnotations.createAnnotation({
            project_id: projectId,
            content: news.content,
            date_marker: news.dateMarker,
            creation_type: news.creationType,
            dashboard_item: news.dashboardItem,
            scope: news.scope,
          });

          yield* session.note(`Created Annotation: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogAnnotations.updateAnnotation({
            project_id: projectId,
            id: output.id,
            content: news.content,
            date_marker: news.dateMarker,
            scope: news.scope,
          });

          yield* session.note(`Updated Annotation: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ id: _id, output, session, olds: _olds }) {
          // PostHog annotations don't reliably support HTTP DELETE.
          // Soft-delete by patching deleted: true instead.
          yield* PostHogAnnotations.updateAnnotation({
            project_id: projectId,
            id: output.id,
            deleted: true,
          }).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
            Effect.catchTag("PostHogError", () => Effect.void)
          );

          yield* session.note(`Deleted Annotation: ${output.id}`);
        }),
      };
    })
  );
