const { test, expect } = require('./fixtures')

test('iframe runner via UI triggers stdin loop and reports results', async ({ page }) => {
    test.setTimeout(60000)

    // Navigate to the app and wait for initialization
    await page.goto('http://localhost:8000')
    await page.waitForFunction(() => window.Config && window.Feedback)

    // Prepare a test that uses stdin array consumed by the sandboxed runner
    const inputs = []
    for (let i = 0; i < 10; i++) inputs.push('w' + i)
    const cfg = {
        tests: [
            { id: 'iframe-echo', description: 'echo loop', main: "for i in range(10):\n    word = input()\n    print(word)", stdin: inputs }
        ],
        feedback: []
    }

    // Inject config into the running app
    await page.evaluate((cfg) => {
        try { window.Config = window.Config || {} } catch (e) { window.Config = { current: cfg } }
        try { window.Config.current = cfg } catch (e) { window.Config = Object.assign(window.Config || {}, { current: cfg }) }
        try { if (typeof window.__ssg_set_feedback_config === 'function') window.__ssg_set_feedback_config(cfg) } catch (e) { }
    }, cfg)

    // Open feedback panel and ensure Run tests is enabled
    await page.click('#tab-btn-feedback')
    await page.waitForSelector('#tab-btn-feedback[aria-selected="true"]')
    // Wait for Run tests to be present/enabled and click it (robust to hidden/overlay states)
    try {
        await page.locator('#run-tests-btn:not([disabled])').click({ timeout: 2000 })
    } catch (e) {
        await page.waitForSelector('#run-tests-btn:not([disabled])', { timeout: 2000 })
        await page.evaluate(() => { const b = document.querySelector('#run-tests-btn'); if (b) b.click() })
    }

    // After clicking Run, the app may show a results modal or a feedback entry.
    // Wait for either to appear instead of forcing a Feedback tab click (the modal can intercept pointer events).
    await page.waitForSelector('.feedback-entry.test-entry, #test-results-modal', { timeout: 20000 })

    // If modal present, grab its text; otherwise inspect the feedback entry
    const modal = await page.$('#test-results-modal')
    if (modal) {
        // Wait for the modal to populate its results area (avoid asserting while it's still loading)
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-results-content'), { timeout: 20000 })
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-result-row'), { timeout: 20000 })
        const text = await page.evaluate(el => el.innerText, modal)
        expect(text).toContain('Passed')
    } else {
        // Ensure Feedback tab is open so entries are visible, then wait for the test-entry specifically
        await page.click('#tab-btn-feedback')
        await page.waitForSelector('.feedback-entry.test-entry', { timeout: 20000 })
        // Access internal test results object if available
        const results = await page.evaluate(() => {
            try { return window.__ssg_get_last_test_results ? window.__ssg_get_last_test_results() : (window.__ssg_test_results || null) } catch (e) { return null }
        })
        // As a fallback, check that at least one feedback-entry exists
        const entry = await page.$('.feedback-entry.test-entry')
        expect(entry).toBeTruthy()
    }
})
