/**
 * OAuth Service Layer
 *
 * Provides Effect-based OAuth operations for authentication.
 * Framework-agnostic - depends on OAuthProvider for provider-specific operations.
 */
import type {
  Account as AccountType,
  AccountInsert as AccountInsertType,
  AuthProvider as AuthProviderType,
  UserId,
} from "@packages/types";

import {
  Account as AccountSchema,
  AuthProvider,
  UserId as UserIdSchema,
} from "@packages/types";
import { Context, Effect, Layer, Option, ParseResult, Schema } from "effect";

import {
  OAuthAccountLinkError,
  OAuthAuthorizationError,
  OAuthCallbackError,
  OAuthTokenError,
} from "../errors.js";

// =============================================================================
// OAuth Provider Dependency
// =============================================================================

/**
 * Raw account data from database (before validation)
 */
export interface RawAccountData {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly providerId: string;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly accessTokenExpiresAt: Date | null;
  readonly refreshTokenExpiresAt: Date | null;
  readonly scope: string | null;
  readonly idToken: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * OAuth authorization URL result
 */
export interface OAuthAuthorizationUrl {
  readonly url: string;
  readonly state: string;
  readonly codeVerifier?: string;
}

/**
 * OAuth callback result with tokens
 */
export interface OAuthCallbackResult {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly accessTokenExpiresAt?: Date;
  readonly refreshTokenExpiresAt?: Date;
  readonly scope?: string;
  readonly idToken?: string;
  readonly providerAccountId: string;
  readonly email?: string;
  readonly name?: string;
  readonly image?: string;
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes?: readonly string[];
}

/**
 * Interface for OAuth provider operations
 * Apps provide their own implementation for each provider
 */
export interface OAuthProviderImpl {
  /**
   * Generate authorization URL for a provider
   */
  readonly getAuthorizationUrl: (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    state: string
  ) => Effect.Effect<OAuthAuthorizationUrl, OAuthAuthorizationError>;

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  readonly handleCallback: (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    code: string,
    state: string,
    codeVerifier?: string
  ) => Effect.Effect<OAuthCallbackResult, OAuthCallbackError | OAuthTokenError>;

  /**
   * Refresh an access token using refresh token
   */
  readonly refreshAccessToken: (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    refreshToken: string
  ) => Effect.Effect<
    {
      readonly accessToken: string;
      readonly accessTokenExpiresAt?: Date;
      readonly refreshToken?: string;
      readonly refreshTokenExpiresAt?: Date;
    },
    OAuthTokenError
  >;
}

/**
 * OAuth provider service tag
 */
export class OAuthProvider extends Context.Tag("OAuthProvider")<
  OAuthProvider,
  OAuthProviderImpl
>() {}

// =============================================================================
// Account Repository Dependency
// =============================================================================

/**
 * Interface for OAuth account database operations
 * Apps provide their own implementation (Drizzle, Prisma, etc.)
 */
export interface AccountRepositoryImpl {
  /**
   * Create a new OAuth account in the database
   */
  readonly create: (
    data: AccountInsertType
  ) => Effect.Effect<RawAccountData, OAuthAccountLinkError>;

  /**
   * Get an account by user ID and provider
   */
  readonly getByUserAndProvider: (
    userId: UserId,
    provider: AuthProviderType
  ) => Effect.Effect<Option.Option<RawAccountData>, OAuthAccountLinkError>;

  /**
   * Get an account by provider account ID
   */
  readonly getByProviderAccountId: (
    provider: AuthProviderType,
    providerAccountId: string
  ) => Effect.Effect<Option.Option<RawAccountData>, OAuthAccountLinkError>;

  /**
   * Get all accounts for a user
   */
  readonly getByUserId: (
    userId: UserId
  ) => Effect.Effect<readonly RawAccountData[], OAuthAccountLinkError>;

  /**
   * Update account tokens
   */
  readonly updateTokens: (
    accountId: string,
    tokens: {
      readonly accessToken?: string;
      readonly refreshToken?: string;
      readonly accessTokenExpiresAt?: Date;
      readonly refreshTokenExpiresAt?: Date;
      readonly scope?: string;
      readonly idToken?: string;
    }
  ) => Effect.Effect<Option.Option<RawAccountData>, OAuthAccountLinkError>;

  /**
   * Delete an account
   */
  readonly delete: (
    accountId: string
  ) => Effect.Effect<boolean, OAuthAccountLinkError>;

  /**
   * Delete all accounts for a user
   */
  readonly deleteByUserId: (
    userId: UserId
  ) => Effect.Effect<number, OAuthAccountLinkError>;
}

/**
 * Account repository service tag
 */
export class AccountRepository extends Context.Tag("AccountRepository")<
  AccountRepository,
  AccountRepositoryImpl
>() {}

// =============================================================================
// OAuth Service Definition
// =============================================================================

/**
 * OAuth service interface
 */
export interface OAuthServiceImpl {
  /**
   * Get the authorization URL for a provider
   * Returns URL to redirect user to for OAuth flow
   */
  readonly getAuthUrl: (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    state: string
  ) => Effect.Effect<OAuthAuthorizationUrl, OAuthAuthorizationError>;

  /**
   * Handle OAuth callback after user authorization
   * Exchanges code for tokens and returns callback result
   */
  readonly handleCallback: (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    code: string,
    state: string,
    codeVerifier?: string
  ) => Effect.Effect<OAuthCallbackResult, OAuthCallbackError | OAuthTokenError>;

  /**
   * Link an OAuth account to an existing user
   */
  readonly linkAccount: (
    userId: UserId,
    provider: AuthProviderType,
    callbackResult: OAuthCallbackResult
  ) => Effect.Effect<AccountType, OAuthAccountLinkError>;

  /**
   * Get linked OAuth account for a user and provider
   * Returns None if no account linked
   */
  readonly getLinkedAccount: (
    userId: UserId,
    provider: AuthProviderType
  ) => Effect.Effect<Option.Option<AccountType>, OAuthAccountLinkError>;

  /**
   * Get all linked OAuth accounts for a user
   */
  readonly getLinkedAccounts: (
    userId: UserId
  ) => Effect.Effect<readonly AccountType[], OAuthAccountLinkError>;

  /**
   * Find user by OAuth provider account
   * Returns the account if found (which includes userId)
   */
  readonly findAccountByProvider: (
    provider: AuthProviderType,
    providerAccountId: string
  ) => Effect.Effect<Option.Option<AccountType>, OAuthAccountLinkError>;

  /**
   * Unlink an OAuth account from a user
   * Returns true if unlinked, false if not found
   */
  readonly unlinkAccount: (
    userId: UserId,
    provider: AuthProviderType
  ) => Effect.Effect<boolean, OAuthAccountLinkError>;

  /**
   * Refresh OAuth tokens for an account
   */
  readonly refreshTokens: (
    accountId: string,
    provider: AuthProviderType,
    config: OAuthProviderConfig
  ) => Effect.Effect<AccountType, OAuthTokenError | OAuthAccountLinkError>;

  /**
   * Check if a provider is configured/supported
   */
  readonly isProviderSupported: (
    provider: string
  ) => Effect.Effect<boolean, never>;
}

/**
 * OAuth service tag for dependency injection
 */
export class OAuthService extends Context.Tag("OAuthService")<
  OAuthService,
  OAuthServiceImpl
>() {}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Supported providers set for validation
 */
const SUPPORTED_PROVIDERS = new Set<string>(["google", "microsoft"]);

/**
 * Fallback UserId for error context when validation fails
 * Decoded through Schema to get proper branded type
 */
const FALLBACK_USER_ID: UserId = Schema.decodeUnknownSync(UserIdSchema)(
  "00000000-0000-0000-0000-000000000000"
);

/**
 * Create an OAuthAccountLinkError for validation failures
 * Uses the raw data to construct error context
 */
const createValidationError = (
  raw: RawAccountData,
  parseError: ParseResult.ParseError
): OAuthAccountLinkError => {
  // For validation errors, we decode the provider and userId separately
  // to provide better error context, falling back to defaults
  const providerResult = Schema.decodeUnknownOption(AuthProvider)(
    raw.providerId
  );
  const userIdResult = Schema.decodeUnknownOption(UserIdSchema)(raw.userId);

  return new OAuthAccountLinkError({
    provider: Option.getOrElse(providerResult, () => "google"),
    userId: Option.getOrElse(userIdResult, () => FALLBACK_USER_ID),
    message: `Failed to validate account data: ${parseError.message}`,
    cause: parseError,
  });
};

/**
 * Validate raw account data using Effect Schema
 * Uses Schema.decodeUnknown for proper Effect-based validation
 */
const validateAccountData = (
  raw: RawAccountData
): Effect.Effect<AccountType, OAuthAccountLinkError> =>
  Schema.decodeUnknown(AccountSchema)(raw).pipe(
    Effect.mapError((parseError) => createValidationError(raw, parseError))
  );

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the OAuth service implementation
 */
const makeOAuthService = Effect.gen(function* () {
  const oauthProvider = yield* OAuthProvider;
  const accountRepository = yield* AccountRepository;

  const getAuthUrl = (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    state: string
  ): Effect.Effect<OAuthAuthorizationUrl, OAuthAuthorizationError> =>
    oauthProvider.getAuthorizationUrl(provider, config, state);

  const handleCallback = (
    provider: AuthProviderType,
    config: OAuthProviderConfig,
    code: string,
    state: string,
    codeVerifier?: string
  ): Effect.Effect<OAuthCallbackResult, OAuthCallbackError | OAuthTokenError> =>
    oauthProvider.handleCallback(provider, config, code, state, codeVerifier);

  const linkAccount = (
    userId: UserId,
    provider: AuthProviderType,
    callbackResult: OAuthCallbackResult
  ): Effect.Effect<AccountType, OAuthAccountLinkError> =>
    Effect.gen(function* () {
      // Check if account already exists
      const existing = yield* accountRepository.getByUserAndProvider(
        userId,
        provider
      );

      if (Option.isSome(existing)) {
        // Update existing account with new tokens
        // Build token update object, only including defined values
        const tokenUpdate: {
          accessToken?: string;
          refreshToken?: string;
          accessTokenExpiresAt?: Date;
          refreshTokenExpiresAt?: Date;
          scope?: string;
          idToken?: string;
        } = {
          accessToken: callbackResult.accessToken,
        };
        if (callbackResult.refreshToken !== undefined) {
          tokenUpdate.refreshToken = callbackResult.refreshToken;
        }
        if (callbackResult.accessTokenExpiresAt !== undefined) {
          tokenUpdate.accessTokenExpiresAt =
            callbackResult.accessTokenExpiresAt;
        }
        if (callbackResult.refreshTokenExpiresAt !== undefined) {
          tokenUpdate.refreshTokenExpiresAt =
            callbackResult.refreshTokenExpiresAt;
        }
        if (callbackResult.scope !== undefined) {
          tokenUpdate.scope = callbackResult.scope;
        }
        if (callbackResult.idToken !== undefined) {
          tokenUpdate.idToken = callbackResult.idToken;
        }

        const updated = yield* accountRepository.updateTokens(
          existing.value.id,
          tokenUpdate
        );

        return yield* Option.match(updated, {
          onNone: () =>
            Effect.fail(
              new OAuthAccountLinkError({
                provider,
                userId,
                message: "Account not found after update",
              })
            ),
          onSome: validateAccountData,
        });
      }

      // Create new account
      const accountData: AccountInsertType = {
        userId,
        accountId: callbackResult.providerAccountId,
        providerId: provider,
        accessToken: callbackResult.accessToken,
        refreshToken: callbackResult.refreshToken ?? null,
        accessTokenExpiresAt: callbackResult.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: callbackResult.refreshTokenExpiresAt ?? null,
        scope: callbackResult.scope ?? null,
        idToken: callbackResult.idToken ?? null,
      };

      const rawAccount = yield* accountRepository.create(accountData);
      return yield* validateAccountData(rawAccount);
    });

  const getLinkedAccount = (
    userId: UserId,
    provider: AuthProviderType
  ): Effect.Effect<Option.Option<AccountType>, OAuthAccountLinkError> =>
    Effect.gen(function* () {
      const maybeRaw = yield* accountRepository.getByUserAndProvider(
        userId,
        provider
      );
      return yield* Option.match(maybeRaw, {
        onNone: () => Effect.succeed(Option.none<AccountType>()),
        onSome: (raw) => Effect.map(validateAccountData(raw), Option.some),
      });
    });

  const getLinkedAccounts = (
    userId: UserId
  ): Effect.Effect<readonly AccountType[], OAuthAccountLinkError> =>
    Effect.gen(function* () {
      const rawAccounts = yield* accountRepository.getByUserId(userId);
      return yield* Effect.all(rawAccounts.map(validateAccountData), {
        concurrency: "unbounded",
      });
    });

  const findAccountByProvider = (
    provider: AuthProviderType,
    providerAccountId: string
  ): Effect.Effect<Option.Option<AccountType>, OAuthAccountLinkError> =>
    Effect.gen(function* () {
      const maybeRaw = yield* accountRepository.getByProviderAccountId(
        provider,
        providerAccountId
      );
      return yield* Option.match(maybeRaw, {
        onNone: () => Effect.succeed(Option.none<AccountType>()),
        onSome: (raw) => Effect.map(validateAccountData(raw), Option.some),
      });
    });

  const unlinkAccount = (
    userId: UserId,
    provider: AuthProviderType
  ): Effect.Effect<boolean, OAuthAccountLinkError> =>
    Effect.gen(function* () {
      const maybeAccount = yield* accountRepository.getByUserAndProvider(
        userId,
        provider
      );
      return yield* Option.match(maybeAccount, {
        onNone: () => Effect.succeed(false),
        onSome: (account) => accountRepository.delete(account.id),
      });
    });

  const refreshTokens = (
    accountId: string,
    provider: AuthProviderType,
    config: OAuthProviderConfig
  ): Effect.Effect<AccountType, OAuthTokenError | OAuthAccountLinkError> =>
    Effect.gen(function* () {
      // Get current account to retrieve refresh token
      const maybeRaw = yield* accountRepository
        .getByProviderAccountId(provider, accountId)
        .pipe(
          Effect.mapError(
            (e) =>
              new OAuthTokenError({
                provider,
                message: "Failed to get account for token refresh",
                cause: e,
              })
          )
        );

      const rawAccount = yield* Option.match(maybeRaw, {
        onNone: () =>
          Effect.fail(
            new OAuthTokenError({
              provider,
              message: `Account not found: ${accountId}`,
            })
          ),
        onSome: Effect.succeed,
      });

      if (rawAccount.refreshToken === null) {
        return yield* Effect.fail(
          new OAuthTokenError({
            provider,
            message: "No refresh token available for account",
          })
        );
      }

      // Refresh tokens with provider
      const newTokens = yield* oauthProvider.refreshAccessToken(
        provider,
        config,
        rawAccount.refreshToken
      );

      // Update account with new tokens
      // Build token update object, only including defined values
      const refreshTokenUpdate: {
        accessToken?: string;
        accessTokenExpiresAt?: Date;
        refreshToken?: string;
        refreshTokenExpiresAt?: Date;
      } = {
        accessToken: newTokens.accessToken,
      };
      if (newTokens.accessTokenExpiresAt !== undefined) {
        refreshTokenUpdate.accessTokenExpiresAt =
          newTokens.accessTokenExpiresAt;
      }
      if (newTokens.refreshToken !== undefined) {
        refreshTokenUpdate.refreshToken = newTokens.refreshToken;
      }
      if (newTokens.refreshTokenExpiresAt !== undefined) {
        refreshTokenUpdate.refreshTokenExpiresAt =
          newTokens.refreshTokenExpiresAt;
      }

      const updated = yield* accountRepository
        .updateTokens(rawAccount.id, refreshTokenUpdate)
        .pipe(
          Effect.mapError(
            (e) =>
              new OAuthTokenError({
                provider,
                message: "Failed to update tokens after refresh",
                cause: e,
              })
          )
        );

      return yield* Option.match(updated, {
        onNone: () =>
          Effect.fail(
            new OAuthTokenError({
              provider,
              message: "Account not found after token update",
            })
          ),
        onSome: (raw) =>
          validateAccountData(raw).pipe(
            Effect.mapError(
              (e) =>
                new OAuthTokenError({
                  provider,
                  message: "Failed to validate account after token refresh",
                  cause: e,
                })
            )
          ),
      });
    });

  const isProviderSupported = (
    provider: string
  ): Effect.Effect<boolean, never> =>
    Effect.succeed(SUPPORTED_PROVIDERS.has(provider));

  return {
    getAuthUrl,
    handleCallback,
    linkAccount,
    getLinkedAccount,
    getLinkedAccounts,
    findAccountByProvider,
    unlinkAccount,
    refreshTokens,
    isProviderSupported,
  } satisfies OAuthServiceImpl;
});

/**
 * Live layer for the OAuth service
 * Requires OAuthProvider and AccountRepository to be provided
 */
export const OAuthServiceLive: Layer.Layer<
  OAuthService,
  never,
  OAuthProvider | AccountRepository
> = Layer.effect(OAuthService, makeOAuthService);

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get authorization URL for OAuth flow (convenience function)
 */
export const getAuthUrl = (
  provider: AuthProviderType,
  config: OAuthProviderConfig,
  state: string
) =>
  Effect.flatMap(OAuthService, (service) =>
    service.getAuthUrl(provider, config, state)
  );

/**
 * Handle OAuth callback (convenience function)
 */
export const handleOAuthCallback = (
  provider: AuthProviderType,
  config: OAuthProviderConfig,
  code: string,
  state: string,
  codeVerifier?: string
) =>
  Effect.flatMap(OAuthService, (service) =>
    service.handleCallback(provider, config, code, state, codeVerifier)
  );

/**
 * Link OAuth account to user (convenience function)
 */
export const linkAccount = (
  userId: UserId,
  provider: AuthProviderType,
  callbackResult: OAuthCallbackResult
) =>
  Effect.flatMap(OAuthService, (service) =>
    service.linkAccount(userId, provider, callbackResult)
  );

/**
 * Get linked OAuth account (convenience function)
 */
export const getLinkedAccount = (userId: UserId, provider: AuthProviderType) =>
  Effect.flatMap(OAuthService, (service) =>
    service.getLinkedAccount(userId, provider)
  );

/**
 * Get all linked OAuth accounts for user (convenience function)
 */
export const getLinkedAccounts = (userId: UserId) =>
  Effect.flatMap(OAuthService, (service) => service.getLinkedAccounts(userId));

/**
 * Find account by provider (convenience function)
 */
export const findAccountByProvider = (
  provider: AuthProviderType,
  providerAccountId: string
) =>
  Effect.flatMap(OAuthService, (service) =>
    service.findAccountByProvider(provider, providerAccountId)
  );

/**
 * Unlink OAuth account (convenience function)
 */
export const unlinkAccount = (userId: UserId, provider: AuthProviderType) =>
  Effect.flatMap(OAuthService, (service) =>
    service.unlinkAccount(userId, provider)
  );

/**
 * Refresh OAuth tokens (convenience function)
 */
export const refreshOAuthTokens = (
  accountId: string,
  provider: AuthProviderType,
  config: OAuthProviderConfig
) =>
  Effect.flatMap(OAuthService, (service) =>
    service.refreshTokens(accountId, provider, config)
  );

/**
 * Check if provider is supported (convenience function)
 */
export const isProviderSupported = (provider: string) =>
  Effect.flatMap(OAuthService, (service) =>
    service.isProviderSupported(provider)
  );
