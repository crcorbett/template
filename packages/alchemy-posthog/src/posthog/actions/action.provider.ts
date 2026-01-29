import * as PostHogActions from "@packages/posthog/actions";
import * as Effect from "effect/Effect";

import type { ActionAttrs, ActionStepDef } from "./action";

import { Project } from "../project";
import { retryPolicy } from "../retry";
import { Action as ActionResource } from "./action";

/**
 * Maps ActionStepDef props (camelCase) to API format (snake_case).
 */
function mapSteps(
  steps: ActionStepDef[] | undefined,
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
function mapResponseToAttrs(
  result: PostHogActions.Action,
): ActionAttrs {
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

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (
            news.name !== olds.name ||
            news.description !== olds.description ||
            JSON.stringify(news.tags) !== JSON.stringify(olds.tags) ||
            news.postToSlack !== olds.postToSlack ||
            news.slackMessageFormat !== olds.slackMessageFormat ||
            JSON.stringify(news.steps) !== JSON.stringify(olds.steps)
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        // olds may be undefined when read is called before the resource exists (initial sync)
        read: Effect.fn(function* ({ olds, output }) {
          if (output?.id) {
            const result = yield* retryPolicy(
              PostHogActions.getAction({
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
          // NOTE: Action list API does not support search params; full scan required.
          // Large projects may see degraded performance during fallback lookup.
          if (olds?.name) {
            let offset = 0;
            const limit = 100;
            while (true) {
              const page = yield* retryPolicy(
                PostHogActions.listActions({
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
                (a) => a.name === olds.name && !a.deleted,
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
          // Idempotency: check if an action with this name already exists.
          // NOTE: Action list API does not support search params; full scan required.
          let offset = 0;
          const limit = 100;
          while (true) {
            const page = yield* retryPolicy(
              PostHogActions.listActions({
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
              (a) => a.name === news.name && !a.deleted,
            );

            if (existing) {
              yield* session.note(
                `Idempotent Action: found existing with name ${existing.name}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (!page.next) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            PostHogActions.createAction({
              project_id: projectId,
              name: news.name,
              description: news.description,
              tags: news.tags,
              post_to_slack: news.postToSlack,
              slack_message_format: news.slackMessageFormat,
              steps: mapSteps(news.steps),
            }),
          );

          yield* session.note(`Created Action: ${result.name}`);

          return mapResponseToAttrs(result);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            PostHogActions.updateAction({
              project_id: projectId,
              id: output.id,
              name: news.name,
              description: news.description,
              tags: news.tags,
              post_to_slack: news.postToSlack,
              slack_message_format: news.slackMessageFormat,
              steps: mapSteps(news.steps),
            }),
          );

          yield* session.note(`Updated Action: ${result.name}`);

          return { ...output, ...mapResponseToAttrs(result) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            PostHogActions.deleteAction({
              project_id: projectId,
              id: output.id,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted Action: ${output.name}`);
        }),
      };
    }),
  );
