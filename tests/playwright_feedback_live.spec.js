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

    // Open the Feedback panel
    await page.click('#tab-btn-feedback')
    await page.waitForSelector('#feedback-list')

    // Ensure no feedback initially
    let items = await page.$$('.feedback-item')
    expect(items.length).toBe(0)

    // Type into the editor by filling the accessible textarea (editor syncs from textarea)
    await page.fill('#code', 'print("hello")\n')
    // wait slightly longer than debounce (300ms) to allow evaluation
    await page.waitForTimeout(400)

    items = await page.$$('.feedback-item')
    expect(items.length).toBe(0)

    // Now add the marker that should trigger feedback
    await page.fill('#code', 'print("hello")\n# magic_marker\n')
    await page.waitForTimeout(400)

    // Wait for the feedback item to appear
    await page.waitForSelector('.feedback-item', { timeout: 2000 })
    const id = await page.$eval('.feedback-item', el => el.getAttribute('data-id'))
    expect(id).toBe('live1')
})
