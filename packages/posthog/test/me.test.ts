/**
 * Test for the PostHog Me service
 *
 * Run with: bun test test/me.test.ts
 */

import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "bun:test";
import { Effect, Layer } from "effect";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import { getMe, GetMeRequest, MeResponse } from "../src/services/me.js";

describe("PostHog Me Service", () => {
  it("should have correct schema structure", () => {
    // Test that the request class exists and can be instantiated
    const request = new GetMeRequest({});
    expect(request).toBeDefined();
  });

  it("should have correct response schema fields", () => {
    // Test that MeResponse has the expected structure
    const mockResponse = new MeResponse({
      id: 1,
      uuid: "test-uuid",
      distinct_id: "test-distinct-id",
      first_name: "Test",
      email: "test@example.com",
    });

    expect(mockResponse.id).toBe(1);
    expect(mockResponse.uuid).toBe("test-uuid");
    expect(mockResponse.email).toBe("test@example.com");
  });

  it("should create a typed client function", () => {
    // Test that getMe is a function
    expect(typeof getMe).toBe("function");
  });

  // Integration test - only runs if POSTHOG_API_KEY is set
  it.skipIf(!process.env.POSTHOG_API_KEY)(
    "should fetch current user (integration)",
    async () => {
      const apiKey = process.env.POSTHOG_API_KEY!;
      const endpoint = process.env.POSTHOG_ENDPOINT ?? "https://us.posthog.com";

      // Build the layer with all dependencies
      const TestLayer = Layer.mergeAll(
        FetchHttpClient.layer,
        Credentials.fromApiKey(apiKey),
        Layer.succeed(Endpoint, endpoint)
      );

      const program = getMe({}).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBeDefined();
      console.log("Fetched user:", result.email);
    }
  );
});
