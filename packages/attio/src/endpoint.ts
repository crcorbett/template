import * as Context from "effect/Context";

export class Endpoint extends Context.Tag("@attio/Endpoint")<
  Endpoint,
  string
>() {
  static readonly DEFAULT = "https://api.attio.com";
}
