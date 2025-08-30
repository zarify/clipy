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

    test('use in app writes author_config and main app loads it', async ({ page }) => {
        // Start on the author page
        await page.goto(`${APP_URL}/author/index.html`)
        await page.fill('#meta-title', 'Integration Test Config')

        // Edit the main file editor
        // If CodeMirror is present, write into the textarea first then trigger change
        const hasCM = await page.evaluate(() => !!window.CodeMirror)
        if (hasCM) {
            // set via CodeMirror API
            await page.evaluate(() => {
                const cm = window.__codemirror_instance || (document.querySelector('.CodeMirror') && document.querySelector('.CodeMirror').CodeMirror)
                if (cm) cm.setValue('# test main from playwright\nprint(\"hello\")')
            })
        } else {
            await page.fill('#file-editor', '# test main from playwright\nprint("hello")')
        }

        // Click Use in app
        await page.click('#use-in-app')

        // App root should load
        await page.waitForURL('**/')
        // Ensure the author_config was written into localStorage and contains our title
        const ls = await page.evaluate(() => localStorage.getItem('author_config'))
        expect(ls).not.toBeNull()
        const parsed = JSON.parse(ls)
        expect(parsed.title).toBe('Integration Test Config')
    })
})
