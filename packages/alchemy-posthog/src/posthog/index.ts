import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as Layer from "effect/Layer";

import "./config.js";
import * as Credentials from "./credentials.js";
import * as Endpoint from "./endpoint.js";
export { Project } from "./project.js";
import * as Project from "./project.js";

export const resources = () => Layer.empty;

export const providers = () =>
  resources().pipe(
    Layer.provideMerge(Project.fromStageConfig()),
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
    Layer.provideMerge(FetchHttpClient.layer)
  );
