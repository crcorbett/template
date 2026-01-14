import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import { getMe, GetMeRequest, MeResponse } from "../src/services/me.js";
import { test } from "./test.js";

const getTestLayer = () =>
  Layer.mergeAll(
    FetchHttpClient.layer,
    Credentials.fromApiKey(process.env.POSTHOG_API_KEY ?? ""),
    Layer.succeed(
      Endpoint,
      process.env.POSTHOG_ENDPOINT ?? "https://us.posthog.com"
    )
  );

describe("PostHog Me Service", () => {
  describe("schema structure", () => {
    it("should have correct request class structure", () => {
      const request = new GetMeRequest({});
      expect(request).toBeDefined();
    });

    it("should have correct response schema fields", () => {
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

    it("should handle optional fields in response", () => {
      const mockResponse = new MeResponse({
        id: 1,
        uuid: "test-uuid",
        distinct_id: "test-distinct-id",
        first_name: "Test",
        email: "test@example.com",
        pending_email: null,
        email_opt_in: true,
        is_email_verified: true,
        has_password: true,
        is_staff: false,
        is_impersonated: false,
      });

      expect(mockResponse.pending_email).toBe(null);
      expect(mockResponse.email_opt_in).toBe(true);
      expect(mockResponse.is_staff).toBe(false);
    });

    it("should create a typed client function", () => {
      expect(typeof getMe).toBe("function");
    });
  });

  describe("integration tests", () => {
    test("should fetch current user", () =>
      Effect.gen(function* () {
        const result = yield* getMe({});

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(typeof result.id).toBe("number");
        expect(result.uuid).toBeDefined();
        expect(typeof result.uuid).toBe("string");
        expect(result.email).toBeDefined();
        expect(typeof result.email).toBe("string");
        expect(result.first_name).toBeDefined();
        expect(result.distinct_id).toBeDefined();
      }));

    test("should return organization info if available", () =>
      Effect.gen(function* () {
        const result = yield* getMe({});

        if (result.organization) {
          expect(result.organization.id).toBeDefined();
          expect(result.organization.name).toBeDefined();
        }
      }));

    test("should return notification settings if available", () =>
      Effect.gen(function* () {
        const result = yield* getMe({});

        if (result.notification_settings) {
          expect(typeof result.notification_settings).toBe("object");
        }
      }));

    it.live("should fail with invalid API key", () =>
      Effect.gen(function* () {
        const InvalidLayer = Layer.mergeAll(
          FetchHttpClient.layer,
          Credentials.fromApiKey("phx_invalid_key_12345"),
          Layer.succeed(Endpoint, "https://us.posthog.com")
        );

        const error = yield* Effect.flip(
          getMe({}).pipe(Effect.provide(InvalidLayer))
        );

        expect(error).toBeDefined();
        expect(error._tag).toBe("PostHogError");
      })
    );
  });
});
