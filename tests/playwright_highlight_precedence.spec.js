const { test, expect } = require('./fixtures')

// Ensure error highlight precedence: when both an error and a feedback highlight
// are present on the same line, clearing feedback highlights should leave the
// error highlight applied (Option B behavior).

test('highlight precedence: error restored after feedback clear', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Put a simple program into main.py
    const src = 'a = 1\nprint(a)\nraise Exception("boom")\n'
    await page.evaluate((s) => { if (window.cm) window.cm.setValue(s); else document.getElementById('code').value = s }, src)

    // Use public APIs to add an error highlight and a feedback highlight on
    // the same user line, then clear feedback highlights and assert the
    // error highlight remains (Option B behavior).
    await page.evaluate(() => {
        try { if (window.clearAllErrorHighlights) window.clearAllErrorHighlights() } catch (_e) { }
        try { if (window.highlightMappedTracebackInEditor) window.highlightMappedTracebackInEditor('/main.py', 3) } catch (_e) { }
        try { if (window.highlightFeedbackLine) window.highlightFeedbackLine('/main.py', 3) } catch (_e) { }
    })
    // Diagnostic: capture internal highlight maps and editor presence
    const maps = await page.evaluate(() => {
        return {
            cmPresent: !!window.cm,
            cmValue: (window.cm && typeof window.cm.getValue === 'function') ? window.cm.getValue() : null,
            errorMap: (window.__ssg_error_highlights_map || {}),
            feedbackMap: (window.__ssg_feedback_highlights_map || {})
        }
    })
    console.log('DIAG-MAPS (post-apply):', JSON.stringify(maps))

    // Wait for both highlight classes to appear in the editor DOM. Use
    // selector waits instead of fixed timeouts to reduce flakiness.
    await page.waitForSelector('.CodeMirror .cm-error-line')
    await page.waitForSelector('.CodeMirror .cm-feedback-line')

    // Clear feedback highlights via public API
    await page.evaluate(() => { try { if (window.clearAllFeedbackHighlights) window.clearAllFeedbackHighlights() } catch (_e) { } })
    // Wait for the feedback classes to be removed and ensure the error
    // highlight remains present.
    await page.waitForSelector('.CodeMirror .cm-feedback-line', { state: 'detached' })
    await page.waitForSelector('.CodeMirror .cm-error-line')
    const errorStill = await page.$('.CodeMirror .cm-error-line')
    expect(errorStill).toBeTruthy()
})
