/**
 * distilled-posthog
 *
 * A typed PostHog SDK for Effect, generated from OpenAPI specifications.
 */

// Core exports
export { Credentials, type PostHogCredentials } from "./credentials.js";
export { Endpoint } from "./endpoint.js";

// Error types
export {
  AuthenticationError,
  AuthorizationError,
  COMMON_ERRORS,
  NotFoundError,
  RateLimitError,
  ServerError,
  UnknownPostHogError,
  ValidationError,
} from "./errors.js";

// Retry policies
export * as Retry from "./retry.js";

// Trait annotations (for generated services)
export * as Traits from "./traits.js";

// Services
export * as Me from "./services/me.js";
