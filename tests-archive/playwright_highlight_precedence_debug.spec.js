const { test, expect } = require('./fixtures')

test('debug highlight precedence', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    const src = 'a = 1\nprint(a)\nraise Exception("boom")\n'
    await page.evaluate((s) => { if (window.cm) window.cm.setValue(s); else document.getElementById('code').value = s }, src)

    await page.evaluate(() => {
        try { if (window.clearAllErrorHighlights) window.clearAllErrorHighlights() } catch (_e) { }
        // apply error highlight and capture map
        try { if (window.highlightMappedTracebackInEditor) window.highlightMappedTracebackInEditor('/main.py', 3) } catch (_e) { }
        try { if (window.highlightFeedbackLine) window.highlightFeedbackLine('/main.py', 3) } catch (_e) { }
        const afterError = { errorMap: Object.keys(window.__ssg_error_highlights_map || {}).reduce((acc, k) => { acc[k] = (window.__ssg_error_highlights_map[k] || []).slice(); return acc }, {}), feedbackMap: Object.keys(window.__ssg_feedback_highlights_map || {}).reduce((acc, k) => { acc[k] = (window.__ssg_feedback_highlights_map[k] || []).slice(); return acc }, {}) }
        const afterFeedback = { errorMap: Object.keys(window.__ssg_error_highlights_map || {}).reduce((acc, k) => { acc[k] = (window.__ssg_error_highlights_map[k] || []).slice(); return acc }, {}), feedbackMap: Object.keys(window.__ssg_feedback_highlights_map || {}).reduce((acc, k) => { acc[k] = (window.__ssg_feedback_highlights_map[k] || []).slice(); return acc }, {}) }
        return { afterError, afterFeedback }
    })
    // capture state snapshots returned by previous evaluate
    const snapshots = await page.evaluate(() => {
        return window.__ssg_last_highlight_snapshots || null
    })
    console.log('SNAPSHOTS FROM PAGE (direct):', snapshots)
    console.log('SNAPSHOTS FROM PAGE (via window.__ssg_last_highlight_snapshots):', snapshots)

    // clear feedback
    await page.evaluate(() => { try { if (window.clearAllFeedbackHighlights) window.clearAllFeedbackHighlights() } catch (_e) { } })

    const state2 = await page.evaluate(() => {
        try {
            const emap = window.__ssg_error_highlights_map || {}
            const fmap = window.__ssg_feedback_highlights_map || {}
            const domHasError = !!document.querySelector('.CodeMirror .cm-error-line')
            const domHasFeedback = !!document.querySelector('.CodeMirror .cm-feedback-line')
            return {
                terminalLogLen: (window.__ssg_terminal_event_log || []).length,
                errorKeys: Object.keys(emap),
                feedbackKeys: Object.keys(fmap),
                domHasError,
                domHasFeedback
            }
        } catch (e) { return { err: String(e) } }
    })
    console.log('PAGE STATE AFTER CLEAR:', state2)

    expect(true).toBeTruthy()
})
