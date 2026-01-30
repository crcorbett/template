# PLG Stack Research

## CONST-001 Notes
- Using `interface` with computed property keys (`[Events.X]: {...}`) works well for payload maps — TypeScript shows the resolved event name in error messages.
- The `as const` assertion on `Events` ensures the computed keys are literal string types, not `string`.

## STACK-001 Notes
- The `Insight` resource accepts a `dashboards` prop (`Input<number>[]`) but the provider's `insight.provider.ts` does **not** send it to the PostHog API — the field is filtered out during create/update. This means insights cannot be programmatically linked to dashboards via the alchemy resource model. Workaround: reference the target dashboard in the insight's `description` field and link manually in the PostHog UI, or use a separate dashboard tile API if one becomes available.
- `RetentionQuery` uses `retentionFilter` with `targetEntity`/`returningEntity` (both have `id` = event name string, `type` = "events").
- `FunnelsQuery` supports `funnelsFilter` with `funnelVizType: "time_to_convert"` and `funnelWindowInterval`/`funnelWindowIntervalUnit` for time-to-convert analysis.
- `TrendsQuery` supports `trendsFilter.formula` for computed series (e.g., `"A / B * 100"`).
