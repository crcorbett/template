/**
 * distilled-posthog
 *
 * A typed PostHog SDK for Effect, generated from OpenAPI specifications.
 */

// Core exports
export { Credentials, type PostHogCredentials } from "./credentials.js";
export { UserBasic } from "./common.js";
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
export * as Dashboards from "./services/dashboards.js";
export * as FeatureFlags from "./services/feature-flags.js";
export * as Insights from "./services/insights.js";
export * as Cohorts from "./services/cohorts.js";
export * as Events from "./services/events.js";
export * as Persons from "./services/persons.js";
export * as Surveys from "./services/surveys.js";
export * as Actions from "./services/actions.js";
export * as Annotations from "./services/annotations.js";
export * as Experiments from "./services/experiments.js";
