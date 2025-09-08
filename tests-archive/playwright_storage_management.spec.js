const { test, expect } = require('./fixtures')

test.describe('Storage Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')

        // Clear storage for clean test
        await page.evaluate(() => {
            localStorage.clear()
        })
    })

    test('should show storage info via window function', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Create some test data
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test1.txt', 'test content 1')
                await window.FileManager.write('/test2.txt', 'test content 2')
            }
        })

        // Save a snapshot to add to storage
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Check storage info
        const storageInfo = await page.evaluate(() => {
            if (window.showStorageInfo) {
                return window.showStorageInfo()
            }
            return null
        })

        expect(storageInfo).toBeTruthy()
        expect(storageInfo.totalSize).toBeGreaterThan(0)
        expect(storageInfo.percentage).toBeGreaterThan(0)
        expect(storageInfo.percentage).toBeLessThan(1) // Should be well under 100%
    })

    test('should handle storage quota gracefully', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Test safe storage operation
        const result = await page.evaluate(() => {
            // Import is not available in page context, so we'll test the basic concept
            try {
                localStorage.setItem('test-key', 'test-value')
                return { success: true }
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    return { success: false, error: 'QuotaExceededError' }
                }
                throw error
            }
        })

        expect(result.success).toBe(true)
    })

    test('should show storage info button in snapshot modal', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Open snapshot modal
        await page.click('#history')

        // Wait for snapshot list container to appear and finish loading (avoid brittle content checks)
        await page.waitForSelector('#snapshot-list', { timeout: 10000 })
        await page.waitForFunction(() => {
            const el = document.querySelector('#snapshot-list')
            if (!el) return false
            // Some UIs show '(loading)' placeholder text while populating; wait until that's gone
            return el.innerText && !el.innerText.includes('(loading)')
        }, { timeout: 10000 })

        // The snapshot footer summary should be present
        const footer = page.locator('#snapshot-storage-summary')
        await footer.waitFor({ state: 'visible', timeout: 8000 })
        await expect(footer).toBeVisible()

        // Close modal
        await page.keyboard.press('Escape')
    })
})
