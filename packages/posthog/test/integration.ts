import { FetchHttpClient, FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as PlatformConfigProvider from "@effect/platform/PlatformConfigProvider";
import {
  ConfigProvider,
  Console,
  Effect,
  Layer,
  Logger,
  LogLevel,
} from "effect";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import * as Retry from "../src/retry.js";
import { getMe } from "../src/services/me.js";

const program = Effect.gen(function* () {
  yield* Console.log("Running PostHog integration tests...\n");

  yield* Console.log("Test 1: Fetch current user");
  const me = yield* getMe({});
  yield* Console.log(`  ✓ Got user: ${me.email} (${me.first_name})`);
  yield* Console.log(`  ✓ UUID: ${me.uuid}`);
  yield* Console.log(`  ✓ Distinct ID: ${me.distinct_id}`);

  if (me.organization) {
    yield* Console.log(`  ✓ Organisation: ${me.organization.name}`);
  }

  if (me.notification_settings) {
    yield* Console.log(`  ✓ Has notification settings`);
  }

  yield* Console.log("\n✅ All integration tests passed!");
});

const platform = Layer.mergeAll(
  NodeContext.layer,
  FetchHttpClient.layer,
  Logger.pretty
);

const runTests = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const envPath = "../../.env";

  const configProvider = (yield* fs.exists(envPath))
    ? ConfigProvider.orElse(
        yield* PlatformConfigProvider.fromDotEnv(envPath),
        ConfigProvider.fromEnv
      )
    : ConfigProvider.fromEnv();

  yield* program.pipe(
    Effect.provide(Credentials.fromEnv()),
    Effect.provideService(Endpoint, "https://us.posthog.com"),
    Effect.withConfigProvider(configProvider)
  );
}).pipe(
  Effect.provide(platform),
  Logger.withMinimumLogLevel(LogLevel.Info),
  Effect.provide(NodeContext.layer),
  Retry.transient
);

Effect.runPromise(runTests).catch((error) => {
  console.error("\n❌ Integration test failed:", error);
  process.exit(1);
});
