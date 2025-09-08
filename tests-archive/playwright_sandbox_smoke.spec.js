const { test, expect } = require('@playwright/test')

test('sandbox smoke', async ({ page }) => {
    await page.goto('http://localhost:8000/tests/smoke-host.html')
    await page.waitForFunction(() => window.__smoke_result !== undefined, { timeout: 60000 })
    const res = await page.evaluate(() => window.__smoke_result)
    console.log('smoke result:', res)
    expect(res).toBeTruthy()
    expect(res.passed).toBeTruthy()
    // Allow either raw stdout or concatenated output to include SMOKE
    const stdout = res.stdout || ''
    expect(stdout.includes('SMOKE') || stdout.includes('SMOKE\n')).toBeTruthy()
})
