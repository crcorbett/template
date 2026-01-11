---
name: Playwriter
description: Browser automation and testing using Playwriter MCP with Playwright. Use for debugging browser issues, interacting with web pages, validating UI/UX, capturing screenshots, reading console logs, or automating user flows. Triggers on requests involving browser testing, UI validation, visual debugging, or web page interaction.
---

# Playwriter Browser Automation

## Core Tools

- `mcp__playwriter__execute` - Run Playwright code snippets
- `mcp__playwriter__reset` - Reset connection if unresponsive

## Quick Patterns

### Get Page State

```js
console.log('url:', page.url());
console.log(await accessibilitySnapshot({ page }).then(x => x.split('\n').slice(0, 30).join('\n')));
```

### Visual Layout (complex pages)

```js
await screenshotWithAccessibilityLabels({ page });
```

Use for grids, galleries, dashboards. Labels are colour-coded: yellow=links, orange=buttons, coral=inputs.

### Interact with Elements

```js
// Use aria-ref from snapshot (no quotes around ref value)
await page.locator('aria-ref=e13').click();
await page.locator('aria-ref=e5').fill('text');
```

### Console Logs

```js
const errors = await getLatestLogs({ search: /error/i, count: 50 });
console.log(errors);
```

### Wait for Load

```js
await waitForPageLoad({ page });
// or
await page.waitForLoadState('networkidle', { timeout: 3000 });
```

## Debugging Workflow

1. **Get accessibility snapshot** to understand page structure
2. **Use screenshot** for complex visual layouts
3. **Check console logs** for errors
4. **Interact** using aria-ref selectors
5. **Verify state** after each action

## Advanced Tools

### CSS Debugging

```js
const cdp = await getCDPSession({ page });
const styles = await getStylesForLocator({
  locator: page.locator('.btn'),
  cdp
});
console.log(formatStylesAsText(styles));
```

### JavaScript Debugging

```js
const cdp = await getCDPSession({ page });
const dbg = createDebugger({ cdp });
await dbg.enable();
const scripts = await dbg.listScripts({ search: 'app' });
await dbg.setBreakpoint({ file: scripts[0].url, line: 42 });
```

### Network Interception

```js
state.responses = [];
page.on('response', async res => {
  if (res.url().includes('/api/')) {
    try {
      state.responses.push({ url: res.url(), body: await res.json() });
    } catch {}
  }
});
// Trigger actions, then analyse:
console.log(state.responses);
page.removeAllListeners('response');
```

## Important Rules

- **Multiple calls**: Use multiple execute calls for complex logic
- **Never close**: Never call `browser.close()` or `context.close()`
- **No bringToFront**: Avoid unless user asks
- **Clean up listeners**: Call `page.removeAllListeners()` at end
- **Timeout**: Use 20 seconds for `screenshotWithAccessibilityLabels` on complex pages
- **Avoid dialogs**: Don't trigger alerts/confirms - they block the extension

## If Stuck

After 2-3 failed attempts, stop and ask the user for guidance. If extension unresponsive, use `mcp__playwriter__reset`.
