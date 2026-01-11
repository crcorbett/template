/**
 * Auth Package Runtime and Layer Composition
 *
 * Provides composable layers and runtime for auth services.
 * Apps can pick which services they need and compose with their own dependencies.
 */
import { Layer, ManagedRuntime } from "effect";

import {
  AccountRepository,
  type AccountRepositoryImpl,
  AuthService,
  AuthServiceLive,
  BetterAuthClient,
  type BetterAuthClientImpl,
  OAuthProvider,
  type OAuthProviderImpl,
  OAuthService,
  OAuthServiceLive,
  PermissionsService,
  PermissionsServiceLive,
  SessionRepository,
  type SessionRepositoryImpl,
  SessionService,
  SessionServiceLive,
  UserRolesProvider,
  type UserRolesProviderImpl,
} from "./services/index.js";

// =============================================================================
// Layer Dependencies
// =============================================================================

/**
 * All external dependencies required by auth services
 *
 * These must be provided by the consuming application:
 * - BetterAuthClient: Better Auth instance for session validation
 * - UserRolesProvider: Role/permission lookup implementation
 * - SessionRepository: Session database operations
 * - OAuthProvider: OAuth provider-specific operations
 * - AccountRepository: OAuth account database operations
 */
export type AuthDependencies =
  | BetterAuthClient
  | UserRolesProvider
  | SessionRepository
  | OAuthProvider
  | AccountRepository;

/**
 * Minimal dependencies for auth-only operations (no permissions/OAuth)
 */
export type AuthMinimalDependencies = BetterAuthClient;

/**
 * Dependencies for auth + permissions (no OAuth)
 */
export type AuthWithPermissionsDependencies =
  | BetterAuthClient
  | UserRolesProvider;

/**
 * Dependencies for auth + sessions (no OAuth/permissions)
 */
export type AuthWithSessionsDependencies = BetterAuthClient | SessionRepository;

// =============================================================================
// Service Layer Compositions
// =============================================================================

/**
 * Auth service layer only
 *
 * Provides: AuthService
 * Requires: BetterAuthClient
 *
 * @example
 * ```ts
 * const layer = AuthOnlyLayer.pipe(
 *   Layer.provide(MyBetterAuthClientLayer)
 * )
 * ```
 */
export const AuthOnlyLayer: Layer.Layer<AuthService, never, BetterAuthClient> =
  AuthServiceLive;

/**
 * Permissions service layer only
 *
 * Provides: PermissionsService
 * Requires: UserRolesProvider
 *
 * @example
 * ```ts
 * const layer = PermissionsOnlyLayer.pipe(
 *   Layer.provide(MyUserRolesProviderLayer)
 * )
 * ```
 */
export const PermissionsOnlyLayer: Layer.Layer<
  PermissionsService,
  never,
  UserRolesProvider
> = PermissionsServiceLive;

/**
 * Session service layer only
 *
 * Provides: SessionService
 * Requires: SessionRepository
 *
 * @example
 * ```ts
 * const layer = SessionOnlyLayer.pipe(
 *   Layer.provide(MySessionRepositoryLayer)
 * )
 * ```
 */
export const SessionOnlyLayer: Layer.Layer<
  SessionService,
  never,
  SessionRepository
> = SessionServiceLive;

/**
 * OAuth service layer only
 *
 * Provides: OAuthService
 * Requires: OAuthProvider, AccountRepository
 *
 * @example
 * ```ts
 * const layer = OAuthOnlyLayer.pipe(
 *   Layer.provide(Layer.merge(MyOAuthProviderLayer, MyAccountRepositoryLayer))
 * )
 * ```
 */
export const OAuthOnlyLayer: Layer.Layer<
  OAuthService,
  never,
  OAuthProvider | AccountRepository
> = OAuthServiceLive;

// =============================================================================
// Composite Layers
// =============================================================================

/**
 * Auth + Permissions layer (common combination)
 *
 * Provides: AuthService, PermissionsService
 * Requires: BetterAuthClient, UserRolesProvider
 *
 * @example
 * ```ts
 * const layer = AuthWithPermissionsLayer.pipe(
 *   Layer.provide(Layer.merge(
 *     MyBetterAuthClientLayer,
 *     MyUserRolesProviderLayer
 *   ))
 * )
 * ```
 */
export const AuthWithPermissionsLayer: Layer.Layer<
  AuthService | PermissionsService,
  never,
  BetterAuthClient | UserRolesProvider
> = Layer.mergeAll(AuthServiceLive, PermissionsServiceLive);

/**
 * Auth + Sessions layer
 *
 * Provides: AuthService, SessionService
 * Requires: BetterAuthClient, SessionRepository
 *
 * @example
 * ```ts
 * const layer = AuthWithSessionsLayer.pipe(
 *   Layer.provide(Layer.merge(
 *     MyBetterAuthClientLayer,
 *     MySessionRepositoryLayer
 *   ))
 * )
 * ```
 */
export const AuthWithSessionsLayer: Layer.Layer<
  AuthService | SessionService,
  never,
  BetterAuthClient | SessionRepository
> = Layer.mergeAll(AuthServiceLive, SessionServiceLive);

/**
 * Full auth layer with all services
 *
 * Provides: AuthService, PermissionsService, SessionService, OAuthService
 * Requires: BetterAuthClient, UserRolesProvider, SessionRepository, OAuthProvider, AccountRepository
 *
 * @example
 * ```ts
 * const layer = FullAuthLayer.pipe(
 *   Layer.provide(Layer.mergeAll(
 *     MyBetterAuthClientLayer,
 *     MyUserRolesProviderLayer,
 *     MySessionRepositoryLayer,
 *     MyOAuthProviderLayer,
 *     MyAccountRepositoryLayer
 *   ))
 * )
 * ```
 */
export const FullAuthLayer: Layer.Layer<
  AuthService | PermissionsService | SessionService | OAuthService,
  never,
  AuthDependencies
> = Layer.mergeAll(
  AuthServiceLive,
  PermissionsServiceLive,
  SessionServiceLive,
  OAuthServiceLive
);

// =============================================================================
// Layer Builder Functions
// =============================================================================

/**
 * Create a BetterAuthClient layer from an implementation
 *
 * @example
 * ```ts
 * import { auth } from "./auth-server"
 *
 * const BetterAuthClientLayer = makeBetterAuthClientLayer({
 *   getSession: (headers) => auth.api.getSession({ headers })
 * })
 * ```
 */
export const makeBetterAuthClientLayer = (
  impl: BetterAuthClientImpl
): Layer.Layer<BetterAuthClient, never, never> =>
  Layer.succeed(BetterAuthClient, impl);

/**
 * Create a UserRolesProvider layer from an implementation
 *
 * @example
 * ```ts
 * const UserRolesProviderLayer = makeUserRolesProviderLayer({
 *   getUserRoles: (userId) => Effect.gen(function* () {
 *     const db = yield* Database
 *     const user = yield* db.query(...)
 *     return Option.fromNullable(user)
 *   })
 * })
 * ```
 */
export const makeUserRolesProviderLayer = (
  impl: UserRolesProviderImpl
): Layer.Layer<UserRolesProvider, never, never> =>
  Layer.succeed(UserRolesProvider, impl);

/**
 * Create a SessionRepository layer from an implementation
 *
 * @example
 * ```ts
 * const SessionRepositoryLayer = makeSessionRepositoryLayer({
 *   create: (data) => Effect.tryPromise(() => db.insert(sessions).values(data)),
 *   getById: (id) => Effect.tryPromise(() => db.query(sessions).where(...)),
 *   // ... other methods
 * })
 * ```
 */
export const makeSessionRepositoryLayer = (
  impl: SessionRepositoryImpl
): Layer.Layer<SessionRepository, never, never> =>
  Layer.succeed(SessionRepository, impl);

/**
 * Create an OAuthProvider layer from an implementation
 *
 * @example
 * ```ts
 * const OAuthProviderLayer = makeOAuthProviderLayer({
 *   getAuthorizationUrl: (provider, config, state) => Effect.succeed({ url: ... }),
 *   handleCallback: (provider, config, code, state) => Effect.gen(function* () { ... }),
 *   refreshAccessToken: (provider, config, refreshToken) => Effect.gen(function* () { ... }),
 * })
 * ```
 */
export const makeOAuthProviderLayer = (
  impl: OAuthProviderImpl
): Layer.Layer<OAuthProvider, never, never> =>
  Layer.succeed(OAuthProvider, impl);

/**
 * Create an AccountRepository layer from an implementation
 *
 * @example
 * ```ts
 * const AccountRepositoryLayer = makeAccountRepositoryLayer({
 *   create: (data) => Effect.tryPromise(() => db.insert(accounts).values(data)),
 *   getByUserAndProvider: (userId, provider) => Effect.gen(function* () { ... }),
 *   // ... other methods
 * })
 * ```
 */
export const makeAccountRepositoryLayer = (
  impl: AccountRepositoryImpl
): Layer.Layer<AccountRepository, never, never> =>
  Layer.succeed(AccountRepository, impl);

// =============================================================================
// ManagedRuntime Factory
// =============================================================================

/**
 * Create an auth ManagedRuntime with provided dependency layers
 *
 * Creates a runtime that can be used to run auth Effects.
 * The runtime manages the lifecycle of all auth services.
 *
 * @example
 * ```ts
 * // Create runtime with full auth layer
 * const AuthRuntime = makeAuthRuntime(
 *   FullAuthLayer.pipe(
 *     Layer.provide(Layer.mergeAll(
 *       MyBetterAuthClientLayer,
 *       MyUserRolesProviderLayer,
 *       MySessionRepositoryLayer,
 *       MyOAuthProviderLayer,
 *       MyAccountRepositoryLayer
 *     ))
 *   )
 * )
 *
 * // Use the runtime
 * const session = await AuthRuntime.runPromise(getSession(headers))
 * ```
 */
export const makeAuthRuntime = <S, E>(
  layer: Layer.Layer<S, E, never>
): ManagedRuntime.ManagedRuntime<S, E> => ManagedRuntime.make(layer);

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Type for all auth services provided by FullAuthLayer
 */
export type FullAuthServices =
  | AuthService
  | PermissionsService
  | SessionService
  | OAuthService;

/**
 * Type for auth + permissions services
 */
export type AuthWithPermissionsServices = AuthService | PermissionsService;

/**
 * Type for auth + sessions services
 */
export type AuthWithSessionsServices = AuthService | SessionService;
