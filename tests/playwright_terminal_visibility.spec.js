const { test, expect } = require('@playwright/test')

test('terminal is not focused or visible on initial load, and focuses when opened', async ({ page }) => {
    await page.goto('http://localhost:8000')

    // Wait for app to initialize (use a stable element from index.html)
    await page.waitForSelector('#code')

    // Terminal tab button should not be selected by default
    const termBtn = page.locator('#tab-btn-terminal')
    await expect(termBtn).toHaveCount(1)
    await expect(termBtn).toHaveAttribute('aria-selected', 'false')

    // Terminal panel should be hidden
    const termPanel = page.locator('#terminal')
    await expect(termPanel).toHaveCount(1)
    const display = await termPanel.evaluate(el => window.getComputedStyle(el).display)
    expect(display === 'none' || display === '').toBeTruthy()

    // Now click the terminal tab button and assert it becomes selected and focused
    await termBtn.click()
    await expect(termBtn).toHaveAttribute('aria-selected', 'true')
    await expect(termPanel).toBeVisible()

    // Terminal output should receive focus (stdin box may be present too)
    const out = page.locator('#terminal-output')
    await expect(out).toHaveCount(1)
    const active = await page.evaluate(() => document.activeElement && document.activeElement.id)
    // Either the terminal-output or the stdin-box may be focused; accept either
    expect(active === 'terminal-output' || active === 'stdin-box').toBeTruthy()
})
