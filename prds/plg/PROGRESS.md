# PLG Stack Progress

## CONST-001 — Add typed event payload schemas to Events
- **Status**: Passed
- **Changed**: `packages/plg/src/events.ts`
- **Summary**: Added `EventPayloads` interface mapping all 14 `EventName` values to their typed property shapes. Uses computed property keys (`[Events.SIGNUP_STARTED]`) so the mapping stays in sync with the `Events` constant. Existing `Events` object and `EventName` type unchanged (backward compatible).
- **Verified**: `bun tsc -b` passes cleanly.
