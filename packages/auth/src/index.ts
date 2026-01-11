/**
 * @packages/auth
 *
 * Reusable authentication package with Effect best practices.
 * Provides framework-agnostic auth services for the monorepo.
 *
 * This package contains:
 * - Effect services for auth, permissions, sessions, and OAuth
 * - Typed errors using Data.TaggedError
 * - Match-based error handling utilities
 * - Option-based nullable handling
 * - Framework-agnostic middleware factories
 */

// Re-export auth-related types from @packages/types
export type {
  AuthContext,
  PermissionString,
  RoleName,
  Session,
  User,
  UserId,
  UserWithRoles,
} from "@packages/types";
