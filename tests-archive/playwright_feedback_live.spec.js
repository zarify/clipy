const { test, expect } = require('./fixtures.js')

test('live feedback updates as user types into editor', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForFunction(() => window.Config && window.Feedback)

    // Install a simple feedback rule that looks for the token 'magic_marker'
    await page.evaluate(() => {
        const cfg = {
            feedback: [
                { id: 'live1', title: 'marker', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: '\\bmagic_marker\\b', flags: '' }, message: 'found marker' }
            ]
        }
        window.Feedback.resetFeedback(cfg)
    })

    // Open the Feedback panel and ensure it's active/visible
    await page.click('#tab-btn-feedback')
    // Wait for the feedback tab to be marked selected and the panel to be visible
    await page.waitForSelector('#tab-btn-feedback[aria-selected="true"]', { timeout: 2000 })
    await page.waitForSelector('#fdbk', { state: 'visible', timeout: 2000 })
    await page.waitForSelector('#fdbk-list')

    // The feedback panel shows configured titles even when not matched.
    // Ensure the configured entry is present but has no matched message yet.
    let items = await page.$$('.feedback-entry')
    expect(items.length).toBe(1)
    // There should be no matched message initially
    let matchedMsg = await page.$('.feedback-entry .feedback-msg-matched')
    expect(matchedMsg).toBeNull()

    // Type into the editor by filling the accessible textarea (editor syncs from textarea)
    await page.fill('#code', 'print("hello")\n')
    // wait slightly longer than debounce (300ms) to allow evaluation
    await page.waitForTimeout(400)

    // Still one entry; message should now be absent until the marker is present
    items = await page.$$('.feedback-entry')
    expect(items.length).toBe(1)
    matchedMsg = await page.$('.feedback-entry .feedback-msg-matched')
    expect(matchedMsg).toBeNull()

    // Now add the marker that should trigger feedback
    await page.fill('#code', 'print("hello")\n# magic_marker\n')
    await page.waitForTimeout(400)

    // Wait for the feedback entry to be attached and visible
    const sel = '.feedback-entry'
    await page.waitForSelector(sel, { timeout: 2000, state: 'attached' })
    await page.waitForSelector(sel, { timeout: 2000, state: 'visible' })
    const id = await page.$eval(sel, el => el.getAttribute('data-id'))
    expect(id).toBe('live1')
})
