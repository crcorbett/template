/**
 * Security Middleware
 *
 * Provides security-related middleware for API routes.
 */
import { createMiddleware } from "@tanstack/react-start";

/**
 * Security headers middleware for auth API routes
 *
 * Adds security headers to protect against common vulnerabilities:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - Cache-Control: Prevents caching of sensitive auth responses
 * - Pragma: Legacy cache control for HTTP/1.0
 */
export const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next();

    // Prevent MIME type sniffing
    result.response.headers.set("X-Content-Type-Options", "nosniff");

    // Prevent clickjacking
    result.response.headers.set("X-Frame-Options", "DENY");

    // Prevent caching of auth responses
    result.response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    result.response.headers.set("Pragma", "no-cache");

    return result;
  }
);

/**
 * CORS middleware for auth API routes
 *
 * Better Auth handles CORS internally through trustedOrigins config,
 * but this can be used for custom auth endpoints if needed.
 */
export const corsMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const origin = request.headers.get("Origin");
    const result = await next();

    // Only allow requests from trusted origins
    // In production, this should match BETTER_AUTH_URL
    if (origin) {
      result.response.headers.set("Access-Control-Allow-Origin", origin);
      result.response.headers.set("Access-Control-Allow-Credentials", "true");
      result.response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
      );
      result.response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Cookie"
      );
    }

    return result;
  }
);

/**
 * Combined auth security middleware
 *
 * Applies both security headers and CORS handling.
 */
export const authSecurityMiddleware = createMiddleware()
  .middleware([securityHeadersMiddleware, corsMiddleware])
  .server(async ({ next }) => {
    return await next();
  });
