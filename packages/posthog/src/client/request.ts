/**
 * HTTP Request type for PostHog API
 */

export interface Request {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  path: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string>;
  body?: string | Uint8Array | ReadableStream<Uint8Array> | undefined;
}
