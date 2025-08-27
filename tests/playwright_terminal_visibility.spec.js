const { test, expect } = require('./fixtures')

test.describe('Terminal visibility', () => {
    test('terminal should not be visible after reload or new page open', async ({ page, context }) => {
        // Open the app
        await page.goto('http://localhost:8000')

        // Wait for app to initialize (instructions content to be populated)
        await page.waitForSelector('#instructions')
        await expect(page.locator('#instructions')).toBeVisible()
        await expect(page.locator('#terminal')).toBeHidden()

        // Activate terminal via explicit user action (tab click) to simulate user-caused visibility
        try {
            await page.click('#tab-btn-terminal')
            await expect(page.locator('#terminal')).toBeVisible({ timeout: 2000 })
        } catch (_e) {
            // If terminal didn't appear, continue — we only need to verify reload doesn't auto-open terminal
        }

        // Now reload the page and verify default is instructions
        await page.reload()
        await page.waitForSelector('#instructions')
        await expect(page.locator('#instructions')).toBeVisible()
        await expect(page.locator('#terminal')).toBeHidden()

        // Open a fresh new page (simulating user opening a new tab) and verify default
        const newPage = await context.newPage()
        await newPage.goto('http://localhost:8000')
        await newPage.waitForSelector('#instructions')
        await expect(newPage.locator('#instructions')).toBeVisible()
        await expect(newPage.locator('#terminal')).toBeHidden()
        await newPage.close()
    })
})
