# Reference: Note Resource (No Update — Replace Only)

## Resource Definition (`src/attio/note/note.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating an Attio Note.
 * Notes cannot be updated — any change triggers replacement (delete + recreate).
 */
export interface NoteProps {
  /**
   * Parent object slug. Changing this will replace the resource.
   * @example "people"
   */
  parentObject: Input<string>;

  /**
   * Parent record ID. Changing this will replace the resource.
   */
  parentRecordId: Input<string>;

  /**
   * Note title.
   * @example "Meeting Notes"
   */
  title: string;

  /**
   * Content format (e.g., "plaintext", "html").
   */
  format?: string;

  /**
   * Note body content.
   */
  content?: string;
}

/**
 * Output attributes for an Attio Note.
 */
export interface NoteAttrs<
  _Props extends Input.Resolve<NoteProps> = Input.Resolve<NoteProps>
> {
  /** Note ID extracted from composite NoteId. */
  noteId: string;

  /** Parent object slug. */
  parentObject: string | null;

  /** Parent record ID. */
  parentRecordId: string | null;

  /** Note title. */
  title: string | null;

  /** Plain text content. */
  contentPlaintext: string | null;

  /** Content format. */
  format: string | null;

  /** ISO creation timestamp. */
  createdAt: string;
}

/**
 * An Attio Note attached to a Record.
 *
 * Notes **cannot be updated** via the API. Any property change triggers
 * a replacement (delete old + create new).
 *
 * @section Creating Notes
 * @example Meeting Note on a Record
 * ```typescript
 * class MeetingNote extends Note("MeetingNote", {
 *   parentObject: "people",
 *   parentRecordId: JaneDoe.recordId,
 *   title: "Q1 Planning Meeting",
 *   content: "Discussed quarterly goals...",
 * }) {}
 * ```
 */
export interface Note<
  ID extends string = string,
  Props extends NoteProps = NoteProps,
> extends Resource<
  "Attio.Note",
  ID,
  Props,
  NoteAttrs<Input.Resolve<Props>>,
  Note
> {}

export const Note = Resource<{
  <const ID extends string, const Props extends NoteProps>(
    id: ID,
    props: Props,
  ): Note<ID, Props>;
}>("Attio.Note");
```

## Provider Notes

- `stables: ["noteId"]`
- `diff`: **ALL changes → replace** (Notes have no update API)
- `read`: getNote by noteId; fallback scan listNotes(parent_object, parent_record_id) by title
- `create`: scan listNotes for title match (idempotency)
- `update`: **not implemented** — the diff always returns "replace", so update is never called. Include a stub that throws.
- `delete`: hard delete via deleteNote + catch NotFoundError

### Critical: No Update Path

Since the Attio Notes API has no PATCH/PUT endpoint, the diff handler must return
`{ action: "replace" }` for ANY property change. This causes alchemy-effect to delete
the old note and create a new one.

```typescript
diff: Effect.fnUntraced(function* ({ news, olds }) {
  // Notes cannot be updated — any change requires replacement
  if (
    news.parentObject !== olds.parentObject ||
    news.parentRecordId !== olds.parentRecordId ||
    news.title !== olds.title ||
    news.format !== olds.format ||
    news.content !== olds.content
  ) {
    return { action: "replace" };
  }
  return undefined;
}),
```
