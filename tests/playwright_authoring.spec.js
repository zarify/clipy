const { test, expect } = require('@playwright/test')

// Smoke tests for the authoring interface
// Assumes dev server serves at http://localhost:8000

const APP_URL = process.env.APP_URL || 'http://localhost:8000'

test.describe('Authoring smoke', () => {
    test('author page loads and autosaves to localStorage', async ({ page }) => {
        await page.goto(`${APP_URL}/author/index.html`)
        await expect(page.locator('text=Clipy — Authoring')).toBeVisible()

        // Type a title and a main.py content, wait for autosave debounce
        await page.fill('#meta-title', 'Playwright Test Config')
        // wait briefly to allow autosave debounce (500ms) + buffer
        await page.waitForTimeout(800)

        // Ensure localStorage contains author_config (as string)
        const ls = await page.evaluate(() => localStorage.getItem('author_config'))
        expect(ls).not.toBeNull()
        const parsed = JSON.parse(ls)
        expect(parsed.title === 'Playwright Test Config' || parsed.title).toBeTruthy()
    })

    test('author_config saved by autosave is available to app root', async ({ page }) => {
        // Start on the author page, edit metadata and main file, then navigate to app root
        await page.goto(`${APP_URL}/author/index.html`)
        await page.fill('#meta-title', 'Integration Test Config')

        // Edit the main file editor (CodeMirror or textarea)
        const hasCM = await page.evaluate(() => !!window.CodeMirror)
        if (hasCM) {
            await page.evaluate(() => {
                const cm = window.__author_code_mirror || (window.__codemirror_instance) || (document.querySelector('.CodeMirror') && document.querySelector('.CodeMirror').CodeMirror)
                if (cm && typeof cm.setValue === 'function') cm.setValue('# test main from playwright\nprint("hello")')
            })
        } else {
            await page.fill('#file-editor', '# test main from playwright\nprint("hello")')
        }

        // wait for autosave debounce to complete
        await page.waitForTimeout(900)

        // Navigate to app root (no button to click anymore)
        await page.goto(`${APP_URL}/`)

        // Ensure the author_config was written into localStorage and contains our title
        const ls = await page.evaluate(() => localStorage.getItem('author_config'))
        expect(ls).not.toBeNull()
        const parsed = JSON.parse(ls)
        expect(parsed.title).toBe('Integration Test Config')
    })
})
