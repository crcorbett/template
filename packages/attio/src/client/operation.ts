/**
 * Operation type for Attio API
 *
 * Represents an API operation with input/output schemas and error types.
 */

import type * as S from "effect/Schema";

/**
 * An API operation definition
 */
export interface Operation {
  /** Input request schema */
  input: S.Schema.AnyNoContext;
  /** Output response schema */
  output: S.Schema.AnyNoContext;
  /** Possible error schemas */
  errors?: readonly S.Schema.AnyNoContext[];
  /** Pagination configuration (if paginated) */
  pagination?: {
    inputToken: string;
    outputToken?: string;
    items?: string;
    pageSize?: string;
    mode?: "url" | "offset" | "cursor";
  };
}

/**
 * An operation with required pagination configuration.
 * Used as a constraint for makePaginated to ensure type safety.
 */
export interface PaginatedOperation extends Operation {
  pagination: NonNullable<Operation["pagination"]>;
}

/**
 * Type-level helpers for extracting types from operations
 */
export namespace Operation {
  /** Extract input type from operation */
  export type Input<Op extends Operation> = S.Schema.Type<Op["input"]>;

  /** Extract output type from operation */
  export type Output<Op extends Operation> = S.Schema.Type<Op["output"]>;

  /** Extract error union type from operation */
  export type Errors<Op extends Operation> =
    Op["errors"] extends readonly (infer E)[]
      ? E extends S.Schema.AnyNoContext
        ? S.Schema.Type<E>
        : never
      : never;
}
