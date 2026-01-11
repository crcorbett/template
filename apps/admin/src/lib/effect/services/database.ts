/**
 * Database Service Layer
 *
 * Re-exports database functionality from @packages/database and provides
 * error types for consistent error handling in the admin app.
 */
import { Data } from "effect";

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when a database query fails
 */
export class DatabaseQueryError extends Data.TaggedError("DatabaseQueryError")<{
  readonly message: string;
  readonly query?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when a record is not found
 */
export class RecordNotFoundError extends Data.TaggedError("RecordNotFoundError")<{
  readonly table: string;
  readonly id: string;
  readonly message: string;
}> {}

/**
 * Error thrown when a database constraint is violated
 */
export class ConstraintViolationError extends Data.TaggedError(
  "ConstraintViolationError"
)<{
  readonly constraint: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Re-exports from @packages/database
// =============================================================================

export { DatabaseLive, SqlLive } from "@packages/database";
export { schema } from "@packages/types";
