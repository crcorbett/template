/**
 * Auth Effect Schemas and types for Better Auth integration
 *
 * All types are derived from Effect Schemas. Never use raw TypeScript interfaces.
 */
import { Schema } from "effect";

// =============================================================================
// Branded Types for Auth IDs
// =============================================================================

/**
 * Branded type for User IDs (UUID format)
 */
export const UserId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("UserId")
);
export type UserId = typeof UserId.Type;

/**
 * Branded type for Session IDs (UUID format)
 */
export const SessionId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("SessionId")
);
export type SessionId = typeof SessionId.Type;

/**
 * Branded type for Account IDs (UUID format)
 */
export const AccountId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("AccountId")
);
export type AccountId = typeof AccountId.Type;

/**
 * Branded type for session tokens
 */
export const SessionToken = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("SessionToken")
);
export type SessionToken = typeof SessionToken.Type;

/**
 * Branded type for email addresses
 */
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email")
);
export type Email = typeof Email.Type;

// =============================================================================
// Auth Provider Schema
// =============================================================================

/**
 * Supported OAuth providers
 */
export const AuthProvider = Schema.Literal("google", "microsoft");
export type AuthProvider = typeof AuthProvider.Type;

// =============================================================================
// Entity Schemas
// =============================================================================

/**
 * User schema - matches Better Auth user table
 */
export const User = Schema.Struct({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  name: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type User = typeof User.Type;

/**
 * Session schema - matches Better Auth session table
 */
export const Session = Schema.Struct({
  id: SessionId,
  userId: UserId,
  token: SessionToken,
  expiresAt: Schema.Date,
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type Session = typeof Session.Type;

/**
 * Account schema - OAuth account linked to a user
 */
export const Account = Schema.Struct({
  id: AccountId,
  userId: UserId,
  accountId: Schema.String, // Provider's account ID (not our UUID)
  providerId: AuthProvider,
  accessToken: Schema.NullOr(Schema.String),
  refreshToken: Schema.NullOr(Schema.String),
  accessTokenExpiresAt: Schema.NullOr(Schema.Date),
  refreshTokenExpiresAt: Schema.NullOr(Schema.Date),
  scope: Schema.NullOr(Schema.String),
  idToken: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type Account = typeof Account.Type;

/**
 * Authenticated user context with session
 */
export const AuthContext = Schema.Struct({
  user: User,
  session: Session,
});
export type AuthContext = typeof AuthContext.Type;

// =============================================================================
// Insert Schemas (for creating new records)
// =============================================================================

/**
 * Schema for creating a new user (id and timestamps are auto-generated)
 */
export const UserInsert = Schema.Struct({
  email: Email,
  emailVerified: Schema.optional(Schema.Boolean),
  name: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
});
export type UserInsert = typeof UserInsert.Type;

/**
 * Schema for creating a new session
 */
export const SessionInsert = Schema.Struct({
  userId: UserId,
  token: SessionToken,
  expiresAt: Schema.Date,
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
});
export type SessionInsert = typeof SessionInsert.Type;

/**
 * Schema for creating a new account
 */
export const AccountInsert = Schema.Struct({
  userId: UserId,
  accountId: Schema.String,
  providerId: AuthProvider,
  accessToken: Schema.NullOr(Schema.String),
  refreshToken: Schema.NullOr(Schema.String),
  accessTokenExpiresAt: Schema.NullOr(Schema.Date),
  refreshTokenExpiresAt: Schema.NullOr(Schema.Date),
  scope: Schema.NullOr(Schema.String),
  idToken: Schema.NullOr(Schema.String),
});
export type AccountInsert = typeof AccountInsert.Type;
