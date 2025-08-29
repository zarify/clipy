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
    await page.waitForSelector('#run-tests-btn')
    await page.click('#run-tests-btn')

    // Wait for test results to appear
    await page.waitForFunction(() => {
        const el = document.querySelector('.feedback-tests-section')
        if (!el) return false
        return !!el.querySelector('.test-entry')
    }, { timeout: 5000 })

    // After run, ensure /test-artifact.txt is not persisted in localStorage mirror
    const postExists = await page.evaluate(() => {
        try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return m['/test-artifact.txt'] || null } catch (_e) { }
        try { if (window.FileManager) return window.FileManager.read('/test-artifact.txt') } catch (_e) { }
        return null
    })

    expect(postExists).toBeNull()
})
