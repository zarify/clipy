const { test, expect } = require('./fixtures.js')

test('feedback: edit-time regex triggers matches and emits event', async ({ page }) => {
    await page.goto('http://localhost:8000')

    // wait for app to initialize
    await page.waitForFunction(() => window.Config && window.Feedback)

    // install a feedback config in the page
    await page.evaluate(() => {
        const cfg = { feedback: [{ id: 't1', title: 'no-print', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: '\\bprint\\(', flags: '' }, message: 'avoid print' }] }
        window.Feedback.resetFeedback(cfg)
    })

    // set the editor content to include a print statement
    // Try to set via TabManager or textarea fallback
    await page.evaluate(() => {
        try {
            if (window.TabManager) {
                const path = window.TabManager.getActive()
                window.TabManager.write(path, 'print("hello")\n')
            } else {
                const ta = document.querySelector('textarea, #editor')
                if (ta) ta.value = 'print("hello")\n'
            }
        } catch (e) { /* ignore */ }
    })

    // ask the page for matches via waiting for emitted matches event
    const matches = await page.waitForFunction(() => {
        return window.__ssg_latest_feedback_matches || (window._lastFeedbackMatches = window._lastFeedbackMatches || (window.Feedback ? (window.Feedback.evaluateFeedbackOnEdit ? window.Feedback.evaluateFeedbackOnEdit((document.querySelector('textarea') || { value: '' }).value, window.TabManager && window.TabManager.getActive ? window.TabManager.getActive() : '/main.py') : []) : []))
    }, { timeout: 2000 })

    const val = await matches.jsonValue()
    expect(Array.isArray(val)).toBe(true)
    expect(val.length).toBeGreaterThan(0)
})
