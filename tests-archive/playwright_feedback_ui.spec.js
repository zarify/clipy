const { test, expect } = require('./fixtures.js')

test('feedback UI shows matches and emits click events', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForFunction(() => window.Config && window.Feedback)

    // Install config
    await page.evaluate(() => {
        const cfg = { feedback: [{ id: 'ui1', title: 'no-print', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: '\\bprint\\(', flags: '' }, message: 'avoid print' }] }
        window.Feedback.resetFeedback(cfg)
    })

    // Write into editor (via TabManager or textarea)
    await page.evaluate(() => {
        try {
            const path = window.TabManager.getActive()
            window.TabManager.write(path, 'print("hello-ui")\n')
        } catch (e) {
            const ta = document.querySelector('textarea')
            if (ta) ta.value = 'print("hello-ui")\n'
        }
    })

    // Explicitly evaluate feedback against current editor contents so the UI updates
    await page.evaluate(() => {
        try {
            const ta = document.querySelector('textarea')
            const content = ta ? ta.value : ''
            const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
            if (window.Feedback && window.Feedback.evaluateFeedbackOnEdit) {
                window.Feedback.evaluateFeedbackOnEdit(content, path)
            }
        } catch (_e) { }
    })

    // Open the Feedback side tab
    await page.click('#tab-btn-feedback')

    // Wait for an item to appear
    await page.waitForSelector('.feedback-entry', { timeout: 2000 })

    // Listen for the custom event and click the first item
    const ev = await page.evaluate(() => {
        return new Promise((resolve) => {
            window.addEventListener('ssg:feedback-click', function f(e) { window.removeEventListener('ssg:feedback-click', f); resolve(e.detail) })
            const el = document.querySelector('.feedback-entry')
            if (el) el.click()
        })
    })

    expect(ev).toBeTruthy()
    expect(ev.id).toBe('ui1')
})
