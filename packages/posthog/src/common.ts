import * as S from "effect/Schema";

/**
 * Basic user information returned in many PostHog API responses.
 * Shared across all service schemas to avoid duplication.
 */
export class UserBasic extends S.Class<UserBasic>("UserBasic")({
  id: S.Number,
  uuid: S.String,
  distinct_id: S.optional(S.String),
  first_name: S.optional(S.String),
  last_name: S.optional(S.String),
  email: S.String,
}) {}
