/**
 * Better Auth client for React
 *
 * This module provides React hooks for authentication:
 * - useSession: Get current session state
 * - signIn: Trigger OAuth sign-in
 * - signOut: Sign out current user
 */
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client configured with the auth API endpoint
 *
 * All auth API requests will be made to /api/auth/*
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

/**
 * Export commonly used hooks and functions
 */
export const { useSession, signIn, signOut } = authClient;
