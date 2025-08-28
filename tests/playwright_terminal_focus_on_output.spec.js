const { test, expect } = require('./fixtures')

test.describe('Terminal focus on output-producing actions', () => {
    test.setTimeout(45000)

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })
        await page.waitForFunction(() => typeof window.__ssg_suppress_terminal_autoswitch !== 'undefined' && window.__ssg_suppress_terminal_autoswitch === false, { timeout: 5000 })
    })

    async function safeClick(page, selector) {
        try { await page.click(selector) } catch (e) { await page.locator(selector).click({ force: true }) }
    }

    async function assertTerminalFocused(page) {
        const selected = await page.locator('#tab-btn-terminal').getAttribute('aria-selected')
        expect(selected).toBe('true')
        const visible = await page.evaluate(() => {
            const panel = document.getElementById('terminal')
            if (!panel) return false
            const style = window.getComputedStyle(panel)
            return style && style.display !== 'none' && style.visibility !== 'hidden'
        })
        expect(visible).toBe(true)
    }

    test('Run button focuses terminal on output', async ({ page }) => {
        await page.evaluate(() => { if (window.cm) window.cm.setValue('print("cli-run-output")'); else { const el = document.getElementById('code'); if (el) el.value = 'print("cli-run-output")' } })
        await safeClick(page, '#run')
        await page.waitForFunction(() => { const out = document.getElementById('terminal-output'); return out && out.textContent && out.textContent.indexOf('cli-run-output') !== -1 }, { timeout: 5000 })
        await assertTerminalFocused(page)
    })

    test('Save snapshot focuses terminal on completion', async ({ page }) => {
        await safeClick(page, '#save-snapshot')
        await page.waitForFunction(() => !!window.__ssg_snapshot_saved, { timeout: 5000 })
        await assertTerminalFocused(page)
    })

    test('Restoring a snapshot focuses terminal', async ({ page }) => {
        await safeClick(page, '#save-snapshot')
        await page.waitForFunction(() => !!window.__ssg_snapshot_saved, { timeout: 5000 })
        await safeClick(page, '#history')
        await page.waitForFunction(() => { const el = document.querySelector('#snapshot-list'); return el && el.querySelectorAll('.snapshot-item').length > 0 }, { timeout: 8000 })
        const restoreBtn = await page.locator('#snapshot-list .snapshot-item button').first()
        await restoreBtn.click()
        await page.waitForFunction(() => !!window.__ssg_last_snapshot_restore, { timeout: 8000 })
        await assertTerminalFocused(page)
    })

    test('Clearing storage focuses terminal when it produces output', async ({ page }) => {
        await safeClick(page, '#save-snapshot')
        await page.waitForFunction(() => !!window.__ssg_snapshot_saved, { timeout: 5000 })
        await safeClick(page, '#history')
        await page.waitForSelector('#clear-storage', { timeout: 3000 })
        // Use an in-page DOM click to avoid Playwright locator edge-cases that
        // have been observed to close the page in some environments.
        await page.evaluate(() => { const el = document.querySelector('#clear-storage'); if (el) el.click() })
        // small delay to let modal animation settle
        await page.waitForTimeout(120)
        try {
            await page.waitForSelector('#confirm-modal[aria-hidden="false"]', { timeout: 3000 })
            try {
                // prefer a normal click, fall back to forced click
                await page.locator('#confirm-yes').click({ timeout: 2000 })
            } catch (e) {
                try { await page.locator('#confirm-yes').click({ force: true }) } catch (e2) {
                    // Last-resort: invoke click from page context to avoid Playwright locator edge cases
                    await page.evaluate(() => { document.querySelector('#confirm-yes') && document.querySelector('#confirm-yes').click() })
                }
            }
        } catch (_) { }
        await page.waitForFunction(() => { const out = document.getElementById('terminal-output'); return out && out.textContent && (out.textContent.indexOf('Cleared all snapshots') !== -1 || out.textContent.indexOf('Clear snapshots cancelled') !== -1) }, { timeout: 8000 })

        await assertTerminalFocused(page)
    })
})
