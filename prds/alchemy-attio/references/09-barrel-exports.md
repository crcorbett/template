# 09 — Barrel Exports

## Canonical Reference

- `packages/posthog/src/index.ts`

## index.ts — Full Implementation

```typescript
// Core
export { Credentials, type AttioCredentials } from "./credentials.js";
export { Endpoint } from "./endpoint.js";

// Client utilities
export { makePaginated } from "./client/api.js";

// Shared schemas
export {
  ActorReference,
  Assignee,
  EntryId,
  LinkedRecord,
  ListId,
  NoteId,
  NoteTag,
  ObjectId,
  RecordId,
  TaskId,
  WebhookId,
  WebhookSubscription,
  WorkspaceMemberId,
} from "./common.js";

// Error types
export {
  AttioError,
  type AttioErrorType,
  AuthenticationError,
  AuthorizationError,
  COMMON_ERRORS,
  COMMON_ERRORS_WITH_CONFLICT,
  COMMON_ERRORS_WITH_NOT_FOUND,
  ConflictError,
  MissingCredentialsError,
  MissingHttpTraitError,
  NotFoundError,
  RateLimitError,
  ServerError,
  UnknownAttioError,
  ValidationError,
} from "./errors.js";

// Error categories
export * as Category from "./category.js";

// Retry policies
export * as Retry from "./retry.js";

// Trait annotations
export * as Traits from "./traits.js";

// Services (each as a namespace)
export * as Objects from "./services/objects.js";
export * as Records from "./services/records.js";
export * as Lists from "./services/lists.js";
export * as Entries from "./services/entries.js";
export * as Attributes from "./services/attributes.js";
export * as SelectOptions from "./services/select-options.js";
export * as Notes from "./services/notes.js";
export * as Tasks from "./services/tasks.js";
export * as Comments from "./services/comments.js";
export * as Webhooks from "./services/webhooks.js";
export * as WorkspaceMembers from "./services/workspace-members.js";
export * as Self from "./services/self.js";
```

## Consumer Import Styles

### Barrel import (everything)

```typescript
import { Credentials, Endpoint, Records, Objects, Category } from "@packages/attio";

const result = Records.queryRecords({ object: "people", limit: 10 });
```

### Direct service import (tree-shakeable)

```typescript
import { queryRecords, type AttioRecord } from "@packages/attio/records";
import { listObjects } from "@packages/attio/objects";
```

### Infrastructure imports

```typescript
import { Credentials } from "@packages/attio/Credentials";
import { AuthenticationError, NotFoundError } from "@packages/attio/Errors";
import * as Retry from "@packages/attio/Retry";
```

## Export Conventions

| Export | Module | Notes |
|---|---|---|
| Core types | Named exports | `Credentials`, `Endpoint`, `AttioCredentials` |
| Shared schemas | Named exports | `ActorReference`, `ObjectId`, etc. |
| Error classes | Named exports | Individual classes + `AttioError` + `AttioErrorType` |
| Error constants | Named exports | `COMMON_ERRORS`, `COMMON_ERRORS_WITH_NOT_FOUND`, `COMMON_ERRORS_WITH_CONFLICT` |
| Error categories | Namespace | `Category.*` |
| Retry policies | Namespace | `Retry.*` |
| Traits | Namespace | `Traits.*` |
| Services | Namespace | `Objects.*`, `Records.*`, etc. |
