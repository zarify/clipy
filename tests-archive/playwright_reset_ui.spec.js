const { test, expect } = require('./fixtures')

// Requires a static server at http://localhost:8000

test('reset button synchronizes filesystem, tabs and editor content', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Create an extra file programmatically and open it in a tab
    await page.evaluate(() => {
        const p = '/extra_for_reset.py'
        try {
            if (window.FileManager && typeof window.FileManager.write === 'function') {
                window.FileManager.write(p, '# old content')
            } else if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.write === 'function') {
                window.__ssg_vfs_backend.write(p, '# old content')
            }
        } catch (e) { console.error('create extra file failed', e) }
    })

    // Open the file via TabManager
    await page.evaluate(() => {
        try { if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/extra_for_reset.py') } catch (e) { }
    })

    // Ensure the new tab appears
    await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('.tab .tab-label')).some(e => e.textContent && e.textContent.includes('extra_for_reset.py'))
    }, { timeout: 4000 })

    // Select the extra file so its editor is visible
    await page.evaluate(() => { try { if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab('/extra_for_reset.py') } catch (e) { } })

    // Click reset button and confirm
    await page.click('#reset-config-btn')
    // Wait for modal confirm button and click it (use DOM click to avoid
    // potential pointer interception by offscreen inputs)
    await page.waitForSelector('#confirm-yes', { state: 'visible' })
    await page.$eval('#confirm-yes', el => el.click())

    // Wait for the extra tab to be removed from the DOM
    await page.waitForFunction(() => {
        return !Array.from(document.querySelectorAll('.tab .tab-label')).some(e => e.textContent && e.textContent.includes('extra_for_reset.py'))
    }, { timeout: 6000 })

    // Ensure /main.py editor content matches the loaded config starter
    const starter = await page.evaluate(() => (window.Config && window.Config.current) ? (window.Config.current.starter || '') : '')
    const editorContent = await page.evaluate(() => {
        try { if (window.cm) return window.cm.getValue() } catch (e) { }
        const el = document.getElementById('code')
        return el ? el.value : ''
    })

    expect(editorContent).toBe(starter)
})
