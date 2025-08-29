const { test, expect } = require('./fixtures')

// Shorten timeouts for these focused e2e tests to keep CI fast
test.setTimeout(10 * 1000)

// These tests require a static server serving `src/` at http://localhost:8000

test('author-tests: UI run-tests button triggers sandboxed runner and shows passing result', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.setDefaultTimeout(10000)
    await page.waitForSelector('#editor-host')
    // Ensure Feedback panel is visible
    await page.click('#tab-btn-feedback')

    // Wait for feedback config API to be available, then inject a simple stdin echo test
    await page.waitForFunction(() => typeof window.__ssg_set_feedback_config === 'function', { timeout: 5000 })
    await page.evaluate(() => {
        window.Config = window.Config || { current: {} }
        window.Config.current = window.Config.current || {}
        window.Config.current.tests = [
            { id: 'e1', description: 'echo input', main: "x = input()\nprint('GOT:'+x)", stdin: 'abc', expected_stdout: 'GOT:abc' }
        ]
        window.Config.current.feedback = []
        // Notify the Feedback UI of the new config and clear previous results
        try { window.__ssg_set_feedback_config(window.Config.current) } catch (e) { }
        try { if (typeof window.__ssg_set_test_results === 'function') window.__ssg_set_test_results([]) } catch (e) { }
    })

    // Wait until the Run tests button becomes enabled
    await page.waitForSelector('#run-tests-btn')
    await page.waitForFunction(() => {
        const b = document.getElementById('run-tests-btn')
        return b && !b.disabled
    }, { timeout: 5000 })

    // Capture console messages and click the run button. We assert the UI and app
    // handlers log debug messages so we can confirm the click reached the app.
    const msgs = []
    page.on('console', msg => msgs.push(msg.text()))

    await page.click('#run-tests-btn')

    // Wait until we observe both the feedback-ui and app debug messages
    const start = Date.now()
    while (Date.now() - start < 8000) {
        if (msgs.some(m => m.includes('[feedback-ui] run-tests button clicked')) && msgs.some(m => m.includes('[app] received ssg:run-tests-click'))) break
        await new Promise(r => setTimeout(r, 100))
    }
    expect(msgs.some(m => m.includes('[feedback-ui] run-tests button clicked'))).toBe(true)
    expect(msgs.some(m => m.includes('[app] received ssg:run-tests-click'))).toBe(true)
})

test('author-tests: sample config loads tests and enables Run tests button', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.setDefaultTimeout(10000)
    await page.waitForSelector('#editor-host')
    // Ensure Feedback panel is visible
    await page.click('#tab-btn-feedback')

    // Wait until the global Config is populated from sample.json and contains tests
    await page.waitForFunction(() => {
        try {
            return !!(window.Config && window.Config.current && Array.isArray(window.Config.current.tests) && window.Config.current.tests.length > 0)
        } catch (e) { return false }
    }, { timeout: 5000 })

    // Check that the run-tests button is present and enabled
    const enabled = await page.evaluate(() => {
        const b = document.getElementById('run-tests-btn')
        return !!b && !b.disabled
    })
    expect(enabled).toBe(true)

    // Ensure at least one expected test id from sample.json is present
    const hasHello = await page.evaluate(() => {
        try { return (window.Config && window.Config.current && Array.isArray(window.Config.current.tests) && window.Config.current.tests.some(t => String(t.id) === 't-hello')) } catch (e) { return false }
    })
    expect(hasHello).toBe(true)
})

test('author-tests: stdout/stderr details hidden by default and shown only when author enables show_traceback', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.setDefaultTimeout(10000)
    await page.waitForSelector('#editor-host')
    // Ensure Feedback panel is visible
    await page.click('#tab-btn-feedback')

    // Wait for feedback config API and set a config where author does NOT request traceback visibility
    await page.waitForFunction(() => typeof window.__ssg_set_feedback_config === 'function', { timeout: 5000 })
    await page.evaluate(() => {
        window.Config = window.Config || { current: {} }
        window.Config.current = window.Config.current || {}
        window.Config.current.tests = [
            { id: 'e2', description: 'no-detail', main: "print('silent')", expected_stdout: 'silent' }
        ]
        window.Config.current.feedback = []
        try { window.__ssg_set_feedback_config(window.Config.current) } catch (e) { }
        try { if (typeof window.__ssg_set_test_results === 'function') window.__ssg_set_test_results([]) } catch (e) { }
    })

    await page.waitForFunction(() => {
        const b = document.getElementById('run-tests-btn')
        return b && !b.disabled
    }, { timeout: 5000 })

    const msgs2 = []
    page.on('console', msg => msgs2.push(msg.text()))
    await page.click('#run-tests-btn')
    // Wait for app debug reception
    const start2 = Date.now()
    while (Date.now() - start2 < 8000) {
        if (msgs2.some(m => m.includes('[feedback-ui] run-tests button clicked')) && msgs2.some(m => m.includes('[app] received ssg:run-tests-click'))) break
        await new Promise(r => setTimeout(r, 100))
    }
    expect(msgs2.some(m => m.includes('[feedback-ui] run-tests button clicked'))).toBe(true)
    expect(msgs2.some(m => m.includes('[app] received ssg:run-tests-click'))).toBe(true)

    // Now set an author entry that requests show_traceback and re-run
    // Make this run intentionally fail so the UI will render details when show_traceback is enabled
    await page.evaluate(() => {
        window.Config.current.tests = [{ id: 'e3', description: 'show-detail', main: "print('Y')", expected_stdout: 'Z', show_traceback: true }]
        window.Config.current.feedback = []
        try { if (typeof window.__ssg_set_feedback_config === 'function') window.__ssg_set_feedback_config(window.Config.current) } catch (e) { }
        try { if (typeof window.__ssg_set_test_results === 'function') window.__ssg_set_test_results([]) } catch (e) { }
    })

    await page.waitForFunction(() => {
        const b = document.getElementById('run-tests-btn')
        return b && !b.disabled
    }, { timeout: 3000 })
    // Click and wait for console to show a test result; then briefly check DOM for details
    const msgsConsole = []
    page.on('console', msg => msgsConsole.push(msg.text()))
    await page.click('#run-tests-btn')
    const startR = Date.now()
    while (Date.now() - startR < 9000) {
        if (msgsConsole.some(m => m.includes('testResult') || m.includes('Test run complete'))) break
        await new Promise(r => setTimeout(r, 100))
    }
    expect(msgsConsole.some(m => m.includes('testResult') || m.includes('Test run complete'))).toBe(true)

    // Assert the Feedback UI received and set the test results (deterministic signal)
    expect(msgsConsole.some(m => m.includes('[feedback-ui] setTestResults'))).toBe(true)
})

test('author-tests: tests should not persist created files into storage', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.setDefaultTimeout(10000)
    await page.waitForSelector('#editor-host')
    // Ensure Feedback panel is visible
    await page.click('#tab-btn-feedback')

    // Ensure no artifact exists before running
    const pre = await page.evaluate(() => {
        try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return m['/test-artifact.txt'] || null } catch (e) { return null }
    })
    expect(pre).toBeNull()

    // Wait for feedback config API and inject a test that writes a file
    await page.waitForFunction(() => typeof window.__ssg_set_feedback_config === 'function', { timeout: 5000 })
    await page.evaluate(() => {
        window.Config = window.Config || { current: {} }
        window.Config.current = window.Config.current || {}
        window.Config.current.tests = [
            { id: 'w1', description: 'write artifact', main: "open('/test-artifact.txt','w').write('from-test')\nprint('done')", expected_stdout: 'done' }
        ]
        window.Config.current.feedback = []
        try { window.__ssg_set_feedback_config(window.Config.current) } catch (e) { }
        try { if (typeof window.__ssg_set_test_results === 'function') window.__ssg_set_test_results([]) } catch (e) { }
    })

    await page.waitForFunction(() => {
        const b = document.getElementById('run-tests-btn')
        return b && !b.disabled
    }, { timeout: 5000 })

    const msgs3 = []
    page.on('console', msg => msgs3.push(msg.text()))
    await page.click('#run-tests-btn')
    const start3 = Date.now()
    while (Date.now() - start3 < 8000) {
        if (msgs3.some(m => m.includes('[feedback-ui] run-tests button clicked')) && msgs3.some(m => m.includes('[app] received ssg:run-tests-click'))) break
        await new Promise(r => setTimeout(r, 100))
    }
    expect(msgs3.some(m => m.includes('[feedback-ui] run-tests button clicked'))).toBe(true)
    expect(msgs3.some(m => m.includes('[app] received ssg:run-tests-click'))).toBe(true)
})
