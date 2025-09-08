// Global Playwright test setup to forward page console and page errors into the test runner.
const { test } = require('@playwright/test')
const { attachPageConsole } = require('./helpers/forward_page_console')

// Keep detach handles per page
const detachMap = new WeakMap()

// Attach before each test
test.beforeEach(async ({ page }) => {
  try{
    const fwd = attachPageConsole(page, { prefix: '[PAGE]' })
    detachMap.set(page, fwd)
  }catch(e){
    console.error('[PAGE] failed to attach console forwarder:', e)
  }
})

// Detach after each test
test.afterEach(async ({ page }) => {
  try{
    const f = detachMap.get(page)
    if(f && typeof f.detach === 'function') f.detach()
    detachMap.delete(page)
  }catch(e){
    console.error('[PAGE] failed to detach console forwarder:', e)
  }
})
