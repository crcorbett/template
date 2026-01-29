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

        diff: Effect.fn(function* () {
          return undefined;
        }),

        read: Effect.fn(function* ({ output }) {
          if (!output?.id) {
            return undefined;
          }

          const result = yield* PostHogActions.getAction({
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
          const result = yield* PostHogActions.createAction({
            project_id: projectId,
            name: news.name,
            description: news.description,
            tags: news.tags,
            post_to_slack: news.postToSlack,
            slack_message_format: news.slackMessageFormat,
            steps: mapSteps(news.steps),
          });

          yield* session.note(`Created action: ${result.name}`);

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

          yield* session.note(`Updated action: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* PostHogActions.deleteAction({
            project_id: projectId,
            id: output.id,
          }).pipe(Effect.catchTag("NotFoundError", () => Effect.void));
        }),
      };
    })
  );
