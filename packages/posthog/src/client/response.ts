/**
 * HTTP Response type for PostHog API
 */

export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array>;
}
