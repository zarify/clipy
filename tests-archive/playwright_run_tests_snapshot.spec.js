const { test, expect } = require('./fixtures')

test('run-tests should not persist test-created files into snapshots/storage', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Clear snapshots and files
    await page.evaluate(() => {
        const keys = Object.keys(localStorage)
        keys.forEach(k => { if (k.startsWith('snapshots_')) localStorage.removeItem(k) })
        localStorage.removeItem('ssg_files_v1')
        try { window.__ssg_last_snapshot_restore = 0 } catch (_e) { }
    })

    // Ensure no /test-artifact exists
    const preExists = await page.evaluate(() => {
        try { if (window.FileManager) return window.FileManager.read('/test-artifact.txt') } catch (_e) { }
        try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return m['/test-artifact.txt'] || null } catch (_e) { }
        return null
    })
    expect(preExists).toBeNull()

    // Inject tests into current config that create /test-artifact.txt
    await page.evaluate(() => {
        if (!window.Config) return
        window.Config.current = window.Config.current || {}
        window.Config.current.tests = [
            {
                id: 'tt1', description: 'create artifact', setup: {}, main: "open('/test-artifact.txt','w').write('from-test')\nprint('done')",
                expected_stdout: 'done'
            }
        ]
    })

    // Click Run tests (button in feedback UI)
    // Click Run tests button (robust to hidden/overlayed states)
    // Try a force click first (robust to overlays), then fallback to DOM click.
    try {
        await page.locator('#run-tests-btn').click({ timeout: 5000, force: true })
    } catch (e) {
        try {
            await page.waitForSelector('#run-tests-btn', { timeout: 5000 })
            await page.evaluate(() => { const b = document.querySelector('#run-tests-btn'); if (b) b.click() })
        } catch (_e) {
            // As a last resort, dispatch a synthetic click event
            await page.evaluate(() => {
                const b = document.querySelector('#run-tests-btn')
                if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            })
        }
    }

    // Wait for test results to appear
    // Wait for test results to appear (give the sandboxed runner a bit more time).
    // Some builds render results inside a modal instead of the inline feedback section;
    // wait for either the inline '.test-entry' or the modal '.test-result-row'.
    await page.waitForFunction(() => {
        const inline = document.querySelector('.feedback-tests-section')
        if (inline && inline.querySelector('.test-entry')) return true
        const modal = document.querySelector('#test-results-modal')
        if (modal && modal.querySelector('.test-result-row')) return true
        return false
    }, { timeout: 30000 })

    // After run, ensure /test-artifact.txt is not persisted in localStorage mirror
    const postExists = await page.evaluate(() => {
        try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return m['/test-artifact.txt'] || null } catch (_e) { }
        try { if (window.FileManager) return window.FileManager.read('/test-artifact.txt') } catch (_e) { }
        return null
    })

    expect(postExists).toBeNull()
})
