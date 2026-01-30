import * as AttioTasks from "@packages/attio/tasks";
import * as Effect from "effect/Effect";

import type { TaskAttrs } from "./task";

import { retryPolicy } from "../retry";
import { Task as TaskResource } from "./task";

function mapResponseToAttrs(
  result: typeof AttioTasks.AttioTask.Type,
): TaskAttrs {
  return {
    taskId: result.id.task_id,
    contentPlaintext: result.content_plaintext ?? null,
    format: result.format ?? null,
    deadlineAt: result.deadline_at ?? null,
    isCompleted: result.is_completed,
    linkedRecords: result.linked_records as unknown[] | undefined,
    assignees: result.assignees as unknown[] | undefined,
    createdAt: result.created_at,
  };
}

export const taskProvider = () =>
  TaskResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["taskId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // All prop changes -> update (no replacement triggers)
          if (
            news.content !== olds.content ||
            news.format !== olds.format ||
            news.deadlineAt !== olds.deadlineAt ||
            news.isCompleted !== olds.isCompleted ||
            JSON.stringify(news.linkedRecords) !==
              JSON.stringify(olds.linkedRecords) ||
            JSON.stringify(news.assignees) !== JSON.stringify(olds.assignees)
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // Primary: lookup by taskId
          if (output?.taskId) {
            const result = yield* retryPolicy(
              AttioTasks.getTask({ task_id: output.taskId }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data);
            }
          }

          // Fallback: paginated scan by content match
          if (olds?.content) {
            let offset = 0;
            const limit = 50;
            while (true) {
              const page = yield* retryPolicy(
                AttioTasks.listTasks({ limit, offset }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.data || page.data.length === 0) break;

              const match = page.data.find(
                (t) => t.content_plaintext === olds.content,
              );
              if (match) return mapResponseToAttrs(match);

              if (page.data.length < limit) break;
              offset += limit;
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: paginated scan by content match
          let offset = 0;
          const limit = 50;
          while (true) {
            const page = yield* retryPolicy(
              AttioTasks.listTasks({ limit, offset }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (!page?.data || page.data.length === 0) break;

            const existing = page.data.find(
              (t) => t.content_plaintext === news.content,
            );

            if (existing) {
              yield* session.note(
                `Idempotent Task: found existing with matching content`,
              );
              return mapResponseToAttrs(existing);
            }

            if (page.data.length < limit) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            AttioTasks.createTask({
              content: news.content,
              format: news.format ?? "plaintext",
              deadline_at: news.deadlineAt ?? null,
              is_completed: news.isCompleted ?? false,
              linked_records: news.linkedRecords ?? [],
              assignees: news.assignees ?? [],
            }),
          );

          yield* session.note(`Created Task: "${news.content}"`);

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          // Note: PATCH /v2/tasks/{task_id} does NOT accept content or format.
          // Only deadline_at, is_completed, linked_records, assignees are updatable.
          const result = yield* retryPolicy(
            AttioTasks.updateTask({
              task_id: output.taskId,
              deadline_at: news.deadlineAt ?? null,
              is_completed: news.isCompleted ?? false,
              linked_records: news.linkedRecords ?? [],
              assignees: news.assignees ?? [],
            }),
          );

          yield* session.note(`Updated Task: "${news.content}"`);

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            AttioTasks.deleteTask({ task_id: output.taskId }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Deleted Task: ${output.taskId}`,
          );
        }),
      };
    }),
  );
