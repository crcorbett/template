import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import "./config";
import * as Credentials from "./credentials";
import * as Endpoint from "./endpoint";

// Import all resource modules
import * as Object from "./object/index";
import * as Attribute from "./attribute/index";
import * as SelectOption from "./select-option/index";
import * as Status from "./status/index";
import * as List from "./list/index";
import * as Record from "./record/index";
import * as Entry from "./entry/index";
import * as Webhook from "./webhook/index";
import * as Note from "./note/index";
import * as Task from "./task/index";

// Re-export all resource modules
export {
  Object,
  Attribute,
  SelectOption,
  Status,
  List,
  Record,
  Entry,
  Webhook,
  Note,
  Task,
};

/**
 * Read the stage config from the App context.
 */
export const stageConfig = () =>
  Effect.gen(function* () {
    const app = yield* App;
    return app.config.attio;
  });

/**
 * Compose a Layer with stage config layers (Credentials, Endpoint).
 * No Project layer needed — Attio API key is workspace-scoped.
 */
export const config = <L extends Layer.Layer<any, any, any>>(layer: L) =>
  layer.pipe(
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
  );

/**
 * All resource providers merged into a single Layer.
 */
export const resources = () =>
  Layer.mergeAll(
    Object.objectProvider(),
    Attribute.attributeProvider(),
    SelectOption.selectOptionProvider(),
    Status.statusProvider(),
    List.listProvider(),
    Record.recordProvider(),
    Entry.entryProvider(),
    Webhook.webhookProvider(),
    Note.noteProvider(),
    Task.taskProvider(),
  );

/**
 * Providers with stage config but WITHOUT HttpClient.
 */
export const bareProviders = () => config(resources());

/**
 * Providers with stage config AND FetchHttpClient.
 * Use this in tests and alchemy.run.ts.
 */
export const providers = () =>
  bareProviders().pipe(Layer.provideMerge(FetchHttpClient.layer));
