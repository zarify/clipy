const { test, expect } = require('./fixtures.js')

test('feedback runtime (stdout) triggers on run and appears in UI', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForFunction(() => window.Config && window.Feedback)

    // Install run-time feedback that matches the sample starter output
    await page.evaluate(() => {
        const cfg = { feedback: [{ id: 'run1', title: 'sample-output', when: ['run'], pattern: { type: 'regex', target: 'stdout', expression: 'Hello from MicroPython', flags: '' }, message: 'Sample output detected', severity: 'info', visibleByDefault: true }] }
        window.Feedback.resetFeedback(cfg)
    })

    // Ensure feedback UI is visible
    await page.click('#tab-btn-feedback')

    // Click Run to execute the starter code (or invoke the run button)
    await page.click('#run')

    // Run activates the Terminal tab; re-open the Feedback panel so we can assert run-time feedback
    await page.click('#tab-btn-feedback')

    // Wait for the matched element to be present in the DOM (attached), visibility checked separately
    const selector = '.feedback-section.feedback-run-section .feedback-msg-matched'
    await page.waitForSelector(selector, { timeout: 5000, state: 'attached' })

    // Ensure the matched element contains the expected message text
    const msgText = await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return el ? (el.textContent || '').trim() : ''
    }, selector)
    expect(msgText).toContain('Sample output detected')

    // Verify the matched element corresponds to our id
    const matchedId = await page.evaluate(() => {
        const el = document.querySelector('.feedback-section.feedback-run-section .feedback-entry')
        return el ? el.getAttribute('data-id') : null
    })
    expect(matchedId).toBe('run1')
})
