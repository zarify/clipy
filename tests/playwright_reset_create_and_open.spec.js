const { test, expect, safeConfirm } = require('./fixtures')

// Requires a static server at http://localhost:8000

test('reset creates files from config and opens them', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Ensure a file that should be in config is absent from FileManager
    const configFiles = await page.evaluate(() => (window.Config && window.Config.current && window.Config.current.files) ? Object.keys(window.Config.current.files) : [])
    if (!configFiles || !configFiles.length) {
        test.skip()
        return
    }

    const target = configFiles[0]

    // Delete it if present
    await page.evaluate((t) => {
        try {
            if (window.FileManager && typeof window.FileManager.delete === 'function') window.FileManager.delete(t)
            if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.delete === 'function') window.__ssg_vfs_backend.delete('/' + t.replace(/^\//, ''))
        } catch (e) { }
    }, target)

    // Click reset and confirm
    await page.click('#reset-config-btn')
    await safeConfirm(page)

    // Wait for the target file's tab to appear or for FileManager to contain it
    await page.waitForFunction((t) => {
        try {
            const labels = Array.from(document.querySelectorAll('.tab .tab-label')).map(e => e.textContent)
            if (labels.some(l => l && l.includes(t.replace(/^\//, '')))) return true
            if (window.FileManager && typeof window.FileManager.read === 'function') {
                const content = window.FileManager.read(t)
                if (content != null) return true
            }
        } catch (e) { }
        return false
    }, target, { timeout: 2000 })

    // If the tab exists, ensure editor shows its content when selected
    await page.evaluate((t) => { try { if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(t) } catch (e) { } }, target)

    const content = await page.evaluate(() => {
        try { if (window.cm) return window.cm.getValue() } catch (e) { }
        const el = document.getElementById('code')
        return el ? el.value : ''
    })

    // The content should match the config's file content
    const expected = await page.evaluate((t) => {
        try { return (window.Config && window.Config.current && window.Config.current.files) ? window.Config.current.files[t] : '' } catch (e) { return '' }
    }, target)

    expect(content).toBe(String(expected || ''))
})
