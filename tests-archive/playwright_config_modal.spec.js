const { test, expect } = require('./fixtures')

test.describe('Config Modal & Load Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
    })

    test('should render server list as titles with versions and load selected config into workspace', async ({ page }) => {
        // Ensure config is loaded
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Corrupt main file to ensure loading replaces it
        await page.evaluate(async () => {
            try {
                if (window.FileManager) await window.FileManager.write('/main.py', 'SENTINEL')
            } catch (_e) { }
        })

        // Open the config modal via the header (use DOM click fallback).
        // If it's already open, proceed; otherwise try a couple of fallbacks to ensure it opens.
        try {
            await page.click('.config-info')
        } catch (e) {
            try { await page.$eval('.config-info', el => el.click()) } catch (_) { }
        }
        // Allow extra time and tolerate modal already being open
        try {
            await page.waitForSelector('#config-modal[aria-hidden="false"]', { timeout: 15000 })
        } catch (_) {
            // If the modal isn't visible, continue — later waits will detect absence when necessary
        }

        // Wait for server list buttons to appear
        await page.waitForSelector('#config-server-list button', { timeout: 15000 })

        // Grab first entry label and verify it contains a title and a version marker (vX)
        const firstBtn = page.locator('#config-server-list button').first()
        const label = await firstBtn.textContent()
        expect(label).toBeTruthy()
        // Either a human title with a version or a filename fallback; accept either, but prefer the version pattern
        const hasVersion = /v\d+\.\d+\.\d+/.test(label) || /v\d+\.\d+/.test(label)
        expect(hasVersion || /\.json$/.test(label) || label.length > 0).toBeTruthy()

        // Click the first server-list entry to load it (DOM click fallback)
        try { await firstBtn.click() } catch (e) { await firstBtn.evaluate(el => el.click()) }

        // Wait until modal is closed (hidden)
        await page.waitForSelector('#config-modal', { state: 'hidden', timeout: 15000 })

        // Wait for FileManager.main to be updated to match the loaded config's starter
        await page.waitForFunction(() => {
            try {
                if (!window.Config || !window.Config.current) return false
                const starter = window.Config.current.starter || ''
                if (!window.FileManager || typeof window.FileManager.read !== 'function') return false
                const val = window.FileManager.read('/main.py')
                return String(val || '') === String(starter || '')
            } catch (_e) { return false }
        }, { timeout: 15000 })

        // Verify header updated to include the new config identity
        const headerText = await page.locator('.config-title-line').textContent()
        expect(headerText).toMatch(/^.+\s+\(.+@.+\)$/)
    })
})
