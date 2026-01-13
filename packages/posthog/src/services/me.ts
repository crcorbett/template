/**
 * PostHog Me Service
 *
 * Operations for the current user/organization.
 * This is a hand-written example service for testing.
 */

import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import * as T from "../traits.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Organization info in the response
 */
export class Organization extends S.Class<Organization>("Organization")({
  id: S.String,
  name: S.String,
  slug: S.optional(S.String),
}) {}

/**
 * User response from /api/users/@me/
 */
export class MeResponse extends S.Class<MeResponse>("MeResponse")({
  id: S.Number,
  uuid: S.String,
  distinct_id: S.String,
  first_name: S.String,
  email: S.String,
  pending_email: S.optional(S.NullOr(S.String)),
  email_opt_in: S.optional(S.Boolean),
  is_email_verified: S.optional(S.Boolean),
  notification_settings: S.optional(
    S.Record({ key: S.String, value: S.Unknown })
  ),
  organization: S.optional(Organization),
  has_password: S.optional(S.Boolean),
  is_staff: S.optional(S.Boolean),
  is_impersonated: S.optional(S.Boolean),
}) {}

/**
 * Request for GET /api/users/@me/
 */
export class GetMeRequest extends S.Class<GetMeRequest>("GetMeRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/api/users/@me/" }), T.RestJsonProtocol())
) {}

// =============================================================================
// Operations
// =============================================================================

/**
 * Get current user information
 */
export const getMeOperation: Operation = {
  input: GetMeRequest,
  output: MeResponse,
  errors: [],
};

/**
 * Get the current authenticated user
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { FetchHttpClient } from "@effect/platform";
 * import { getMe } from "@packages/posthog/services/me";
 * import { Credentials, Endpoint } from "@packages/posthog";
 *
 * const program = getMe({});
 *
 * program.pipe(
 *   Effect.provide(FetchHttpClient.layer),
 *   Effect.provide(Credentials.fromApiKey("phx_...")),
 *   Effect.provideService(Endpoint, Endpoint.DEFAULT),
 *   Effect.runPromise
 * );
 * ```
 */
export const getMe = makeClient(getMeOperation);
