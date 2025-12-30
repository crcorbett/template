---
name: browser-automation
description: Automate browsers using Playwright scripts. Use for web scraping, screenshots, form filling, testing, and any task requiring browser interaction. Invoke when user mentions browser, screenshot, scrape, web automation, or testing websites.
license: MIT
compatibility: Requires Node.js and Playwright. Run `npx playwright install chromium` first.
allowed-tools: Bash Write Read
metadata:
  author: cooper
  version: "1.0"
---

# Browser Automation with Playwright

Automate browsers by writing and executing Playwright scripts directly - no MCP needed.

## Quick CLI Commands

```bash
# Screenshot a URL
npx playwright screenshot https://example.com screenshot.png

# Generate PDF
npx playwright pdf https://example.com page.pdf

# Open browser interactively
npx playwright open https://example.com

# Generate code by recording actions
npx playwright codegen https://example.com
```

## Script Pattern

Write a TypeScript script and execute with `npx tsx`:

```typescript
// browser-task.ts
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto('https://example.com')
// ... your automation code
await browser.close()
```

```bash
npx tsx browser-task.ts
```

## Common Patterns

### Screenshots

```typescript
await page.setViewportSize({ width: 1280, height: 720 })
await page.screenshot({ path: 'screenshot.png', fullPage: true })
```

### Form Filling

```typescript
await page.fill('input[name="email"]', 'user@example.com')
await page.selectOption('select#country', 'AU')
await page.check('input[type="checkbox"]')
await page.click('button[type="submit"]')
```

### Data Extraction

```typescript
const items = await page.locator('.item').evaluateAll(els =>
  els.map(el => ({
    title: el.querySelector('h2')?.textContent,
    link: el.querySelector('a')?.href,
  }))
)
console.log(JSON.stringify(items, null, 2))
```

### Wait Strategies

```typescript
// Wait for element
await page.waitForSelector('.loaded')

// Wait for navigation
await page.waitForURL('**/success')

// Wait for network idle
await page.goto(url, { waitUntil: 'networkidle' })

// Wait for API response
await page.waitForResponse(resp => resp.url().includes('/api/'))
```

### Authentication

```typescript
await page.fill('#username', process.env.USER!)
await page.fill('#password', process.env.PASS!)
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard')
```

### Multiple Tabs

```typescript
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target="_blank"]'),
])
await newPage.waitForLoadState()
```

## Execution

```bash
# Install browser (first time only)
npx playwright install chromium

# Run script
npx tsx browser-task.ts

# Run with visible browser (debugging)
PWDEBUG=1 npx tsx browser-task.ts
```

## One-Off Script Pattern

For quick tasks, create and run a temporary script:

```bash
cat > /tmp/browser-task.ts << 'EOF'
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto('https://example.com')
await page.screenshot({ path: 'result.png' })

await browser.close()
EOF

npx tsx /tmp/browser-task.ts
```

## Tips

- Always call `browser.close()` to clean up
- Use `page.waitFor*` methods to avoid race conditions
- Set viewport size for consistent screenshots
- Use `PWDEBUG=1` to see the browser and debug visually
- For CI, browsers run headless by default
