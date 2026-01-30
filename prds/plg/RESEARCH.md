# PLG Stack Research

## CONST-001 Notes
- Using `interface` with computed property keys (`[Events.X]: {...}`) works well for payload maps — TypeScript shows the resolved event name in error messages.
- The `as const` assertion on `Events` ensures the computed keys are literal string types, not `string`.
