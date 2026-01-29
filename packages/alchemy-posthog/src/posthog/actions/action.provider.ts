import * as PostHogActions from "@packages/posthog/actions";
import * as Effect from "effect/Effect";

import type { ActionAttrs, ActionStepDef } from "./action.js";

import { Project } from "../project.js";
import { Action as ActionResource } from "./action.js";

/**
 * Maps ActionStepDef props (camelCase) to API format (snake_case).
 */
function mapSteps(
  steps: ActionStepDef[] | undefined
): PostHogActions.ActionStep[] | undefined {
  if (!steps) return undefined;
  return steps.map((step) => ({
    event: step.event,
    properties: step.properties as any,
    selector: step.selector,
    tag_name: step.tagName,
    text: step.text,
    text_matching: step.textMatching as any,
    href: step.href,
    href_matching: step.hrefMatching as any,
    url: step.url,
    url_matching: step.urlMatching as any,
  }));
}

/**
 * Maps a PostHog API response to ActionAttrs.
 */
function mapResponseToAttrs(result: PostHogActions.Action): ActionAttrs {
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    tags: result.tags as unknown[] | undefined,
    createdAt: result.created_at,
  };
}

/**
 * Provider for PostHog Action resources.
 * Implements full CRUD lifecycle: create, read, update, delete.
 */
export const actionProvider = () =>
  ActionResource.provider.effect(
    Effect.gen(function* () {
      const projectId = yield* Project;

      return {
        stables: ["id"] as const,

        diff: Effect.fn(function* ({ id: _id, news: _news, olds: _olds, output: _output }) {
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* PostHogActions.getAction({
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
            const page = yield* PostHogActions.listActions({
              project_id: projectId,
            }).pipe(
              Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
            );

            const match = page?.results?.find(
              (a) => a.name === olds.name && !a.deleted
            );

            if (match) {
              return mapResponseToAttrs(match);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if an action with this name already exists.
          // State persistence can fail after create, so a retry would call create
          // again. Name is not strictly unique, but serves as best-effort detection.
          const existing = yield* PostHogActions.listActions({
            project_id: projectId,
          }).pipe(
            Effect.map((page) =>
              page.results?.find((a) => a.name === news.name && !a.deleted)
            ),
            Effect.catchTag("PostHogError", () => Effect.succeed(undefined))
          );

          if (existing) {
            yield* session.note(
              `Idempotent Action: ${existing.name}`
            );
            return mapResponseToAttrs(existing);
          }

          const result = yield* PostHogActions.createAction({
            project_id: projectId,
            name: news.name,
            description: news.description,
            tags: news.tags,
            post_to_slack: news.postToSlack,
            slack_message_format: news.slackMessageFormat,
            steps: mapSteps(news.steps),
          });

          yield* session.note(`Created Action: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* PostHogActions.updateAction({
            project_id: projectId,
            id: output.id,
            name: news.name,
            description: news.description,
            tags: news.tags,
            post_to_slack: news.postToSlack,
            slack_message_format: news.slackMessageFormat,
            steps: mapSteps(news.steps),
          });

          yield* session.note(`Updated Action: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* PostHogActions.deleteAction({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));

          yield* session.note(`Deleted Action: ${output.name}`);
        }),
      };
    })
  );
