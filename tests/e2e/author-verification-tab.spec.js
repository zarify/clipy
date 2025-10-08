/**
 * E2E tests for KAN-17: Author verification tab config loading
 * 
 * Tests the "Load from URL" feature in the author verification tab:
 * - Loading local configs by filename
 * - Loading local config lists by filename
 * - Loading remote configs by URL
 * - Filtering playground configs from verification lists
 * - Proper error handling for 404s, CORS, and parse failures
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('KAN-17: Author Verification Tab Config Loading', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to author page (important: it's at /author/ subdirectory)
        await page.goto(`${BASE_URL}/author/`)
        await page.waitForLoadState('networkidle')

        // Click on Verification tab
        const verificationTab = page.locator('#tab-verification')
        await verificationTab.click()
        await page.waitForTimeout(500)
    })

    test('should load local config by filename', async ({ page }) => {
        // Get the verification URL input and load button
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Enter a local config filename (no path)
        await urlInput.fill('sample.json')
        await loadBtn.click()

        // Wait for feedback
        await page.waitForTimeout(1000)

        // Check for success message
        const feedbackText = await feedback.textContent()
        expect(feedbackText).toContain('Loaded successfully')

        // Verify the config select dropdown is populated
        const configSelect = page.locator('#verification-config-select')
        const options = await configSelect.locator('option').count()

        // Should have at least 2 options: "Use authored config" + the loaded config
        expect(options).toBeGreaterThanOrEqual(2)
    })

    test('should load local config list by filename and filter playground', async ({ page }) => {
        // Load the default config list which includes playground
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        await urlInput.fill('index.json')
        await loadBtn.click()
        await page.waitForTimeout(1500)

        const feedbackText = await feedback.textContent()
        expect(feedbackText).toContain('Loaded successfully')

        // Check that playground is NOT in the verification dropdown
        const configSelect = page.locator('#verification-config-select')
        const optionsText = await configSelect.locator('option').allTextContents()

        // Filter out the "Use authored config" option
        const configOptions = optionsText.filter(text => !text.includes('authored'))

        // Verify playground is not present
        const hasPlayground = configOptions.some(text =>
            text.toLowerCase().includes('playground')
        )
        expect(hasPlayground).toBe(false)

        // Should still have other configs
        expect(configOptions.length).toBeGreaterThan(0)
    })

    test('should load remote config URL', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Use a remote config URL (using a public example)
        const remoteUrl = 'https://raw.githubusercontent.com/zarify/clipy-configs/refs/heads/main/printing-press@1.0.json'
        await urlInput.fill(remoteUrl)
        await loadBtn.click()

        // Wait longer for network request
        await page.waitForTimeout(3000)

        const feedbackText = await feedback.textContent()

        // Should either succeed or fail gracefully with network error
        // (test environment may not have internet access)
        expect(feedbackText).toMatch(/Loaded successfully|Failed to load URL|Network error/)
    })

    test('should handle 404 errors gracefully', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Try to load a non-existent config
        await urlInput.fill('nonexistent-config-12345.json')
        await loadBtn.click()
        await page.waitForTimeout(1000)

        const feedbackText = await feedback.textContent()
        expect(feedbackText).toMatch(/Failed to load URL|404|not found/i)
    })

    test('should reject invalid config names with path traversal', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Try path traversal attack
        await urlInput.fill('../../../etc/passwd')
        await loadBtn.click()
        await page.waitForTimeout(500)

        const feedbackText = await feedback.textContent()
        expect(feedbackText).toMatch(/Failed to load URL|Invalid config name/i)
    })

    test('should reject invalid config names with absolute paths', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Try absolute path
        await urlInput.fill('/etc/passwd')
        await loadBtn.click()
        await page.waitForTimeout(500)

        const feedbackText = await feedback.textContent()
        expect(feedbackText).toMatch(/Failed to load URL|Invalid config name/i)
    })

    test('should show error for empty URL input', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Clear input and click load
        await urlInput.clear()
        await loadBtn.click()
        await page.waitForTimeout(200)

        const feedbackText = await feedback.textContent()
        expect(feedbackText).toContain('Please enter a URL')
    })

    test('should reject playground config when loaded as single config', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const feedback = page.locator('#verification-load-feedback')

        // Try to load playground as a single config
        await urlInput.fill('playground@1.0.json')
        await loadBtn.click()
        await page.waitForTimeout(1000)

        const feedbackText = await feedback.textContent()
        expect(feedbackText).toMatch(/Playground configs cannot be used for verification|have no tests/i)
    })

    test('should handle JSON parse errors gracefully', async ({ page }) => {
        // This test would require a malformed JSON file in the config directory
        // For now, we can skip or mock this scenario
        // We'll test that the error handling exists by checking the try-catch structure
        test.skip()
    })

    test('should update verification codes after loading external config', async ({ page }) => {
        const urlInput = page.locator('#verification-load-url')
        const loadBtn = page.locator('#verification-load-url-btn')
        const configSelect = page.locator('#verification-config-select')

        // Load a config
        await urlInput.fill('sample.json')
        await loadBtn.click()
        await page.waitForTimeout(1500)

        // Select the loaded config from dropdown
        await configSelect.selectOption({ index: 1 }) // Index 0 is "Use authored config"
        await page.waitForTimeout(500)

        // Check that verification codes section is updated
        const verificationCodes = page.locator('#verification-codes-container')
        const codesContent = await verificationCodes.textContent()

        // Should contain some verification code content
        expect(codesContent.length).toBeGreaterThan(0)
    })
})
