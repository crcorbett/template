# Reference: Task Resource

## Resource Definition (`src/attio/task/task.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Task.
 */
export interface TaskProps {
  /**
   * Task content text.
   * @example "Follow up with Acme Corp"
   */
  content: string;

  /**
   * Content format (e.g., "plaintext").
   */
  format?: string;

  /**
   * ISO deadline timestamp, or null for no deadline.
   */
  deadlineAt?: string | null;

  /**
   * Whether the task is completed.
   */
  isCompleted?: boolean;

  /**
   * Linked records. May reference Record outputs.
   * @example [{ target_object_id: "...", target_record_id: "..." }]
   */
  linkedRecords?: Input<unknown[]>;

  /**
   * Task assignees.
   * @example [{ referenced_actor_type: "workspace-member", referenced_actor_id: "..." }]
   */
  assignees?: unknown[];
}

/**
 * Output attributes for an Attio Task.
 */
export interface TaskAttrs<
  _Props extends Input.Resolve<TaskProps> = Input.Resolve<TaskProps>
> {
  /** Task ID extracted from composite TaskId. */
  taskId: string;

  /** Plain text content. */
  contentPlaintext: string | null;

  /** Content format. */
  format: string | null;

  /** ISO deadline. */
  deadlineAt: string | null;

  /** Completion status. */
  isCompleted: boolean | undefined;

  /** Linked records. */
  linkedRecords: unknown[] | undefined;

  /** Assignees. */
  assignees: unknown[] | undefined;

  /** ISO creation timestamp. */
  createdAt: string;
}

/**
 * An Attio Task linked to CRM records.
 *
 * @section Creating Tasks
 * @example Follow-up Task
 * ```typescript
 * class FollowUp extends Task("FollowUp", {
 *   content: "Follow up with Acme Corp about Q2 deal",
 *   deadlineAt: "2026-03-01T00:00:00Z",
 *   linkedRecords: [
 *     { target_object_id: "people", target_record_id: JaneDoe.recordId },
 *   ],
 * }) {}
 * ```
 */
export interface Task<
  ID extends string = string,
  Props extends TaskProps = TaskProps,
> extends Resource<
  "Attio.Task",
  ID,
  Props,
  TaskAttrs<Input.Resolve<Props>>,
  Task
> {}

export const Task = Resource<{
  <const ID extends string, const Props extends TaskProps>(
    id: ID,
    props: Props,
  ): Task<ID, Props>;
}>("Attio.Task");
```

## Provider Notes

- `stables: ["taskId"]`
- `diff`: all prop changes → update (no replacement triggers)
- `read`: getTask by taskId; fallback paginated scan by content match
- `create`: paginated scan listTasks for content match (idempotency)
- `update`: updateTask with content, format, deadline_at, is_completed, linked_records, assignees
- `delete`: hard delete via deleteTask + catch NotFoundError
