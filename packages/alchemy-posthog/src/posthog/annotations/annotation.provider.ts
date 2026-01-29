import * as PostHogAnnotations from "@packages/posthog/annotations";
import * as Effect from "effect/Effect";

import type { AnnotationAttrs } from "./annotation.js";

import { Project } from "../project.js";
import { Annotation as AnnotationResource } from "./annotation.js";

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

        read: Effect.fn(function* ({ output }) {
          if (!output?.id) {
            return undefined;
          }

          const result = yield* PostHogAnnotations.getAnnotation({
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
          const result = yield* PostHogAnnotations.createAnnotation({
            project_id: projectId,
            content: news.content,
            date_marker: news.dateMarker,
            creation_type: news.creationType,
            dashboard_item: news.dashboardItem,
            scope: news.scope,
          });

          yield* session.note(`Created annotation: ${result.id}`);

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

          yield* session.note(`Updated annotation: ${result.id}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output }) {
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
        }),
      };
    })
  );
