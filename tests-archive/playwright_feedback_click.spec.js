const { test, expect } = require('./fixtures.js')

test('feedback click opens file and applies feedback highlight; edits and run clear it', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForFunction(() => window.Config && window.Feedback)

    // Install a feedback rule that matches the literal 'MARKER' on a line
    await page.evaluate(() => {
        const cfg = {
            feedback: [
                {
                    id: 'click1',
                    title: 'marker match',
                    when: ['edit'],
                    pattern: { type: 'regex', target: 'code', expression: 'MARKER', flags: '' },
                    message: 'found marker',
                    severity: 'info',
                    visibleByDefault: true
                }
            ]
        }
        window.Feedback.resetFeedback(cfg)
    })

    // Put content into the active editor with MARKER on line 3
    await page.evaluate(() => {
        try {
            const path = window.TabManager.getActive()
            const content = 'line0\nline1\nMARKER\nline3\n'
            if (window.TabManager && typeof window.TabManager.write === 'function') {
                window.TabManager.write(path, content)
            } else if (window.cm && typeof window.cm.setValue === 'function') {
                window.cm.setValue(content)
            } else {
                const ta = document.querySelector('textarea')
                if (ta) ta.value = content
            }
        } catch (_e) { }
    })

    // Evaluate feedback against current editor contents
    await page.evaluate(() => {
        try {
            const content = (window.cm ? window.cm.getValue() : (document.querySelector('textarea') ? document.querySelector('textarea').value : ''))
            const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
            if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnEdit === 'function') {
                window.Feedback.evaluateFeedbackOnEdit(content, path)
            }
        } catch (_e) { }
    })

    // Open Feedback panel
    await page.click('#tab-btn-feedback')
    await page.waitForSelector('.feedback-entry', { timeout: 2000 })

    // Click the feedback entry
    await page.click('.feedback-entry[data-id="click1"]')

    // Wait for feedback map to include the main file
    await page.waitForFunction(() => {
        try {
            const m = window.__ssg_feedback_highlights_map || {}
            return !!(m['/main.py'] && m['/main.py'].length > 0)
        } catch (e) { return false }
    }, { timeout: 2000 })

    // Ensure the DOM shows a feedback highlight
    const present = await page.evaluate(() => !!document.querySelector('.CodeMirror .cm-feedback-line'))
    expect(present).toBeTruthy()

    // Make a user edit that should clear highlights
    await page.evaluate(() => {
        const cm = window.cm
        if (cm && typeof cm.replaceRange === 'function') {
            cm.replaceRange('X', { line: 0, ch: 0 })
        } else {
            const ta = document.querySelector('textarea')
            if (ta) { ta.value = 'X' + ta.value; ta.dispatchEvent(new Event('input')) }
        }
    })

    // Wait for feedback highlight to be removed
    await page.waitForFunction(() => !document.querySelector('.CodeMirror .cm-feedback-line'), { timeout: 2000 })

    // Re-add the MARKER and re-evaluate + click again
    await page.evaluate(() => {
        try { if (window.cm && typeof window.cm.setValue === 'function') window.cm.setValue('line0\nline1\nMARKER\nline3\n') } catch (_e) { }
        try {
            const content = (window.cm ? window.cm.getValue() : (document.querySelector('textarea') ? document.querySelector('textarea').value : ''))
            const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
            if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnEdit === 'function') {
                window.Feedback.evaluateFeedbackOnEdit(content, path)
            }
        } catch (_e) { }
    })

    await page.click('.feedback-entry[data-id="click1"]')
    await page.waitForFunction(() => {
        try {
            const m = window.__ssg_feedback_highlights_map || {}
            return !!(m['/main.py'] && m['/main.py'].length > 0)
        } catch (e) { return false }
    }, { timeout: 2000 })

    // Simulate run clearing by calling the exposed helper
    await page.evaluate(() => { if (window.clearAllFeedbackHighlights) window.clearAllFeedbackHighlights() })

    // Ensure the feedback highlight is removed
    await page.waitForFunction(() => !document.querySelector('.CodeMirror .cm-feedback-line'), { timeout: 2000 })
})
