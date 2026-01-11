/**
 * Effect Runtime Configuration
 *
 * Provides the main runtime for executing Effect programs in the admin app.
 * Combines all service layers into a single composable layer.
 */
import { Layer, ManagedRuntime } from "effect";

import { DatabaseLive, SqlLive } from "@packages/database";

import { AuthServiceLive } from "./services/auth";
import { PermissionsServiceLive } from "./services/permissions";

/**
 * Combined application layer providing all services
 *
 * Services included:
 * - Database: Drizzle + Effect SQL client
 * - AuthService: Session validation and user context
 * - PermissionsService: RBAC checks
 */
export const AppLayer = Layer.mergeAll(
  AuthServiceLive,
  PermissionsServiceLive
).pipe(Layer.provideMerge(DatabaseLive), Layer.provideMerge(SqlLive));

/**
 * Application runtime for executing Effect programs
 *
 * Usage:
 * ```ts
 * const result = await AppRuntime.runPromise(myEffect);
 * ```
 */
export const AppRuntime = ManagedRuntime.make(AppLayer);

/**
 * Type for the application's service requirements
 */
export type AppServices = Layer.Layer.Success<typeof AppLayer>;
