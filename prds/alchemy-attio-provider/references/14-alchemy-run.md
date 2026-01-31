# Reference: Stack Definition (`alchemy.run.ts`)

```typescript
import {
  defineStack,
  defineStages,
  type StageConfig,
  USER,
} from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Config from "effect/Config";

import * as Attio from "./src/attio/index.js";
import { Object as AttioObject } from "./src/attio/object/index.js";
import { Attribute } from "./src/attio/attribute/index.js";
import { SelectOption } from "./src/attio/select-option/index.js";
import { Status } from "./src/attio/status/index.js";
import { List } from "./src/attio/list/index.js";
import { Record } from "./src/attio/record/index.js";
import { Entry } from "./src/attio/entry/index.js";
import { Webhook } from "./src/attio/webhook/index.js";

// ─────────────────────────────────────────────────
// 1. Define stages
// ─────────────────────────────────────────────────

const stages = defineStages(
  Effect.fn(function* () {
    return {
      attio: {
        // API key from env var (ATTIO_API_KEY)
        // No projectId needed — API key is workspace-scoped
      },
    } satisfies StageConfig;
  }),
);

// ─────────────────────────────────────────────────
// 2. Schema Resources (Tier 1)
// ─────────────────────────────────────────────────

// Custom CRM object for tracking deals
export class DealsObject extends AttioObject("DealsObject", {
  apiSlug: "deals",
  singularNoun: "Deal",
  pluralNoun: "Deals",
}) {}

// Deal stage attribute (select type for pipeline stages)
export class DealStageAttr extends Attribute("DealStageAttr", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  title: "Deal Stage",
  type: "select",
}) {}

// Pipeline stage options
export class StageProspect extends SelectOption("StageProspect", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  attribute: DealStageAttr.apiSlug,
  title: "Prospect",
}) {}

export class StageQualified extends SelectOption("StageQualified", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  attribute: DealStageAttr.apiSlug,
  title: "Qualified",
}) {}

export class StageNegotiation extends SelectOption("StageNegotiation", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  attribute: DealStageAttr.apiSlug,
  title: "Negotiation",
}) {}

export class StageClosedWon extends SelectOption("StageClosedWon", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  attribute: DealStageAttr.apiSlug,
  title: "Closed Won",
}) {}

// Deal value attribute
export class DealValueAttr extends Attribute("DealValueAttr", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  title: "Deal Value",
  type: "number",
}) {}

// Sales pipeline list
export class SalesPipeline extends List("SalesPipeline", {
  name: "Sales Pipeline",
  parentObject: [DealsObject.apiSlug],
}) {}

// ─────────────────────────────────────────────────
// 3. Data Resources (Tier 2)
// ─────────────────────────────────────────────────

// Seed deal record
export class AcmeDeal extends Record("AcmeDeal", {
  object: DealsObject.apiSlug,
  matchingAttribute: "name",
  data: {
    name: [{ value: "Acme Corp Enterprise Deal" }],
  },
}) {}

// ─────────────────────────────────────────────────
// 4. Supporting Resources (Tier 3)
// ─────────────────────────────────────────────────

// Webhook for deal changes
export class DealChanges extends Webhook("DealChanges", {
  targetUrl: "https://example.com/webhooks/deal-changes",
  subscriptions: [
    { event_type: "record.created" },
    { event_type: "record.updated" },
    { event_type: "record.deleted" },
  ],
}) {}

// ─────────────────────────────────────────────────
// 5. Stack Definition
// ─────────────────────────────────────────────────

const stack = defineStack({
  name: "attio-crm",
  stages,
  resources: [
    // Schema
    DealsObject,
    DealStageAttr,
    StageProspect,
    StageQualified,
    StageNegotiation,
    StageClosedWon,
    DealValueAttr,
    SalesPipeline,
    // Data
    AcmeDeal,
    // Supporting
    DealChanges,
  ],
  providers: Attio.providers(),
  tap: (outputs) =>
    Effect.log(
      `Attio CRM deployed: ${Object.keys(outputs).join(", ")}`,
    ),
});

// ─────────────────────────────────────────────────
// 6. Stage References
// ─────────────────────────────────────────────────

export const AttioCRM = stages
  .ref<typeof stack>("attio-crm")
  .as({
    prod: "prod",
    staging: "staging",
    dev: (user: USER = USER) => `dev_${user}`,
  });

export default stack;
```

## Key Features Demonstrated

1. **Hierarchical resource dependencies** — Object → Attribute → SelectOption chain uses
   `Input<T>` bindings to reference parent outputs.

2. **No workspace/project config** — The stages config only needs `attio: {}` since
   the API key (from env) implicitly scopes to a workspace.

3. **Multi-tier composition** — Schema resources (Object, Attribute, SelectOption, List)
   are defined before data resources (Record) and supporting resources (Webhook).

4. **Idempotent deployment** — Running `alchemy apply` multiple times produces the same
   result: Objects are found by slug, Records are asserted by matching attribute,
   SelectOptions are found by title.
