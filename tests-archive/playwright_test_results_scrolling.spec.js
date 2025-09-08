const { test, expect } = require('./fixtures')

test('test results modal becomes scrollable when results are many', async ({ page }) => {
    test.setTimeout(20000)

    await page.goto('http://localhost:8000')
    // Wait for app ready
    await page.waitForFunction(() => window.Config && window.Feedback)

    // Construct many fake results to overflow the modal
    const many = []
    for (let i = 0; i < 60; i++) {
        many.push({ id: 't-' + i, description: 'Test ' + i, passed: (i % 3) === 0, reason: (i % 3) === 0 ? null : 'failure', stderr: (i % 3) === 0 ? '' : 'Error line\nMore details\n'.repeat(3) })
    }

    // Inject results and show modal via helper
    await page.evaluate((r) => {
        try { if (typeof window.__ssg_set_test_results === 'function') window.__ssg_set_test_results(r) } catch (e) { }
        try { if (typeof window.__ssg_show_test_results === 'function') window.__ssg_show_test_results(r) } catch (e) { }
    }, many)

    // Wait for modal and content
    await page.waitForSelector('#test-results-modal .test-results-content', { timeout: 5000 })
    await page.waitForSelector('#test-results-modal .test-result-row', { timeout: 5000 })

    // Check that the content area is scrollable (scrollHeight > clientHeight)
    const isScrollable = await page.evaluate(() => {
        const el = document.querySelector('#test-results-modal .test-results-content')
        if (!el) return false
        return el.scrollHeight > el.clientHeight
    })

    expect(isScrollable).toBeTruthy()

    // Scroll to the bottom of the content and ensure header (title) and close
    // button remain visible inside the modal box (header/footer stay put).
    await page.evaluate(() => {
        const el = document.querySelector('#test-results-modal .test-results-content')
        if (el) el.scrollTop = el.scrollHeight
    })

    const headerAndCloseVisible = await page.evaluate(() => {
        const modal = document.querySelector('#test-results-modal')
        if (!modal) return false
        const box = modal.querySelector('.test-results-box')
        const title = modal.querySelector('#test-results-title')
        // close button is the absolute-positioned button inside the box
        const closeBtn = box ? box.querySelector('button') : null
        if (!box || !title || !closeBtn) return false
        const boxRect = box.getBoundingClientRect()
        const titleRect = title.getBoundingClientRect()
        const closeRect = closeBtn.getBoundingClientRect()
        const inBox = (r) => (r.top >= boxRect.top && r.bottom <= boxRect.bottom)
        return inBox(titleRect) && inBox(closeRect)
    })

    expect(headerAndCloseVisible).toBeTruthy()
})
