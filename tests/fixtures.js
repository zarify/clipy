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

// Utility to safely click the confirm modal's Yes button. Uses locator fallbacks
// to be robust across timing/visibility differences in the modal implementation.
async function safeConfirm(page, timeout = 2000) {
  try {
    const sel = '#confirm-yes'
    // Prefer locator click which waits; fall back to evaluate click if needed
    try {
      await page.locator(sel).click({ timeout })
      return true
    } catch (e) {
      try { await page.waitForSelector(sel, { timeout }); await page.click(sel); return true } catch (e2) { }
      try { await page.evaluate(() => { const b = document.querySelector('#confirm-yes'); if (b) b.click() }); return true } catch (_e) { }
    }
  } catch (_e) { }
  return false
}

module.exports = { test, expect, base, safeConfirm }
