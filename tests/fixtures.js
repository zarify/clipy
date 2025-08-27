// Local test fixtures that wrap Playwright's test to attach a global page console forwarder.
const base = require('@playwright/test')
const { test, expect } = base
const { attachPageConsole } = require('./helpers/forward_page_console')

const detachMap = new WeakMap()

// Attach forwarder before each test
test.beforeEach(async ({ page }) => {
  try {
    const fwd = attachPageConsole(page, { prefix: '[PAGE]' })
    detachMap.set(page, fwd)
  } catch (e) {
    console.error('[PAGE] failed to attach console forwarder:', e)
  }
})

// Detach after each test
test.afterEach(async ({ page }) => {
  try {
    const f = detachMap.get(page)
    if (f && typeof f.detach === 'function') f.detach()
    detachMap.delete(page)
  } catch (e) {
    console.error('[PAGE] failed to detach console forwarder:', e)
  }
})

module.exports = { test, expect, base }
