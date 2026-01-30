# PLG Stack Progress

## STACK-003: Fix DeploymentAnnotation date and webhook placeholder URLs

**Status**: Passed

### Changes

1. **Removed `DeploymentAnnotation` entirely** (Option C)
   - `new Date().toISOString()` was evaluated at module import time, causing every `alchemy plan` to show drift
   - Annotations are per-deploy artifacts — they belong in CI pipelines, not static IaC
   - Removed the `Annotation` import and the resource from the `resources` array

2. **Documented webhook placeholder URLs with JSDoc**
   - `Config.string()` cannot be used in static resource class props (they're evaluated at class definition time, outside any Effect generator)
   - Added JSDoc to `DealChangesWebhook` and `CompanyChangesWebhook` explaining the placeholder URLs and referencing `ATTIO_DEAL_WEBHOOK_URL` / `ATTIO_COMPANY_WEBHOOK_URL` env vars
   - Future improvement: create a wrapper function that reads Config and constructs webhook resources dynamically

### Verification

- `bun tsc -b` passes clean
- `alchemy plan` runs without errors
- No annotation drift on repeated plan runs
