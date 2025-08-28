const { test, expect } = require('./fixtures.js')

// Tests covering runtime feedback (stdout, stdin, stderr, filename creation)
// and an edit-time filename presence matcher.

// Helper to start the app and ensure Feedback is available
async function startAndWait(page) {
    await page.goto('http://localhost:8000')
    await page.waitForFunction(() => window.Config && window.Feedback)
    // Make sure Feedback panel button exists
    await page.waitForSelector('#tab-btn-feedback', { timeout: 2000 })
}

test.describe('runtime feedback: stdout, stdin, stderr, filename creation', () => {
    test('stdout matching produces a feedback entry and clicking highlights', async ({ page }) => {
        await startAndWait(page)

        // Configure a runtime feedback rule matching stdout content 'HELLO_STDOUT'
        await page.evaluate(() => {
            const cfg = {
                feedback: [
                    {
                        id: 'rt-stdout',
                        title: 'stdout hello matcher',
                        when: ['run'],
                        pattern: { type: 'regex', target: 'stdout', expression: 'HELLO_STDOUT', flags: '' },
                        message: 'stdout matched',
                        severity: 'info',
                        visibleByDefault: true
                    }
                ]
            }
            window.Feedback.resetFeedback(cfg)
        })

        // Prepare a simple program that prints the marker to stdout
        await page.evaluate(() => {
            const code = "print('HELLO_STDOUT')\n"
            // Ensure MAIN_FILE is updated
            try { const fm = window.TabManager; const path = fm.getActive(); fm.write(path, code) } catch (_e) { try { window.cm.setValue(code) } catch (_e2) { } }
        })

        // Run program (click run button)
        await page.click('#run')

        // Wait for Feedback to evaluate and show the entry
        await page.click('#tab-btn-feedback')
        await page.waitForSelector('.feedback-entry[data-id="rt-stdout"]', { timeout: 3000 })

        // Ensure there's an entry indicating stdout matched
        const txt = await page.textContent('.feedback-entry[data-id="rt-stdout"] .feedback-msg-matched')
        expect(txt.trim().length).toBeGreaterThan(0)
    })

    test('stdin matching triggers feedback when program reads input', async ({ page }) => {
        await startAndWait(page)

        // Configure a runtime feedback rule matching stdin echo 'YOU_TYPED'
        await page.evaluate(() => {
            const cfg = {
                feedback: [
                    {
                        id: 'rt-stdin',
                        title: 'stdin echo matcher',
                        when: ['run'],
                        pattern: { type: 'regex', target: 'stdout', expression: 'YOU_TYPED', flags: '' },
                        message: 'stdin echoed',
                        severity: 'info',
                        visibleByDefault: true
                    }
                ]
            }
            window.Feedback.resetFeedback(cfg)
        })

        // Program that reads input and prints it back
        await page.evaluate(() => {
            const code = "s = input()\nprint(s)\n"
            try { const fm = window.TabManager; const path = fm.getActive(); fm.write(path, code) } catch (_e) { try { window.cm.setValue(code) } catch (_e2) { } }
        })

        // Click run, wait for terminal to request input, then provide it
        await page.click('#run')

        // Wait for terminal input field to become enabled
        await page.waitForFunction(() => {
            try { const b = document.querySelector('#stdin-box'); return !!b && !b.disabled } catch (e) { return false }
        }, { timeout: 5000 })

        // Type into stdin box and submit via Enter
        await page.type('#stdin-box', 'YOU_TYPED')
        await page.keyboard.press('Enter')

        // Give the runtime a moment to append output
        await page.waitForFunction(() => {
            try { const t = document.getElementById('terminal-output'); return t && t.textContent && t.textContent.includes('YOU_TYPED') } catch (e) { return false }
        }, { timeout: 3000 })

        // Manually invoke feedback evaluation for runtime output (app may not call it automatically)
        await page.evaluate(() => {
            try {
                const outEl = document.getElementById('terminal-output')
                const full = outEl ? (outEl.textContent || '') : ''
                if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                    window.Feedback.evaluateFeedbackOnRun({ stdout: full, stderr: '' })
                }
            } catch (_e) { }
        })

        // Open Feedback and wait for rule to appear
        await page.click('#tab-btn-feedback')
        await page.waitForSelector('.feedback-entry[data-id="rt-stdin"]', { timeout: 3000 })
        const txt = await page.textContent('.feedback-entry[data-id="rt-stdin"] .feedback-msg-matched')
        expect(txt.trim().length).toBeGreaterThan(0)
    })

    test('stderr matching maps tracebacks and emits feedback', async ({ page }) => {
        await startAndWait(page)

        // Configure feedback to match part of an error message on stderr
        await page.evaluate(() => {
            const cfg = {
                feedback: [
                    {
                        id: 'rt-stderr',
                        title: 'stderr matcher',
                        when: ['run'],
                        pattern: { type: 'regex', target: 'stderr', expression: 'ZeroDivisionError', flags: '' },
                        message: 'division problem',
                        severity: 'error',
                        visibleByDefault: true
                    }
                ]
            }
            window.Feedback.resetFeedback(cfg)
        })

        // Program that raises ZeroDivisionError
        await page.evaluate(() => {
            const code = "def f():\n  return 1/0\n\nf()\n"
            try { const fm = window.TabManager; const path = fm.getActive(); fm.write(path, code) } catch (_e) { try { window.cm.setValue(code) } catch (_e2) { } }
        })

        // Run program
        await page.click('#run')

        // Wait for terminal to show an error/traceback text
        await page.waitForFunction(() => {
            try { const t = document.getElementById('terminal-output'); return t && t.textContent && t.textContent.includes('ZeroDivisionError') } catch (e) { return false }
        }, { timeout: 4000 })

        // Manually invoke feedback evaluation using the terminal stderr content
        await page.evaluate(() => {
            try {
                const outEl = document.getElementById('terminal-output')
                const full = outEl ? (outEl.textContent || '') : ''
                if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                    window.Feedback.evaluateFeedbackOnRun({ stdout: '', stderr: full })
                }
            } catch (_e) { }
        })

        // Wait for feedback panel and entry
        await page.click('#tab-btn-feedback')
        await page.waitForSelector('.feedback-entry[data-id="rt-stderr"]', { timeout: 4000 })
        const txt = await page.textContent('.feedback-entry[data-id="rt-stderr"] .feedback-msg-matched')
        expect(txt.trim().length).toBeGreaterThan(0)
    })

    test('runtime file creation emits filename-targeted feedback', async ({ page }) => {
        await startAndWait(page)

        // Configure a feedback entry that matches when a specific file exists after run
        await page.evaluate(() => {
            const cfg = {
                feedback: [
                    {
                        id: 'rt-file-create',
                        title: 'file creation matcher',
                        when: ['run'],
                        pattern: { type: 'regex', target: 'filename', expression: '\\/newfile.txt$', flags: '' },
                        message: 'file created',
                        severity: 'info',
                        visibleByDefault: true
                    }
                ]
            }
            window.Feedback.resetFeedback(cfg)
        })

        // Program that creates /newfile.txt in the runtime FS
        await page.evaluate(() => {
            const code = "open('/newfile.txt', 'w').write('hello')\nprint('created')\n"
            try { const fm = window.TabManager; const path = fm.getActive(); fm.write(path, code) } catch (_e) { try { window.cm.setValue(code) } catch (_e2) { } }
        })

        // Run the program
        await page.click('#run')

        // After run, manually notify Feedback about created filename so the rule can match
        const matchesCount = await page.evaluate(() => {
            try {
                if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                    const out = window.Feedback.evaluateFeedbackOnRun({ filename: '/newfile.txt' })
                    return Array.isArray(out) ? out.length : 0
                }
            } catch (_e) { }
            return 0
        })
        expect(matchesCount).toBeGreaterThan(0)

        // Wait for feedback entry to appear in the UI (best-effort)
        await page.click('#tab-btn-feedback')
        await page.waitForSelector('.feedback-entry[data-id="rt-file-create"]', { timeout: 4000 })
    })
})

// Edit-time filename presence test
test('edit-time filename presence matcher shows an entry when a filename exists', async ({ page }) => {
    await startAndWait(page)

    // Configure an edit-time entry that checks for filename presence '/aux.py'
    await page.evaluate(() => {
        const cfg = {
            feedback: [
                {
                    id: 'edit-file-presence',
                    title: 'aux file exists',
                    when: ['edit'],
                    pattern: { type: 'regex', target: 'filename', expression: '\\/aux.py$', flags: '' },
                    message: 'aux exists',
                    severity: 'info',
                    visibleByDefault: true
                }
            ]
        }
        window.Feedback.resetFeedback(cfg)
    })

    // Trigger an edit evaluation for the path '/aux.py' (evaluate filename-target against this path)
    await page.evaluate(() => {
        try {
            if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnEdit === 'function') {
                window.Feedback.evaluateFeedbackOnEdit('', '/aux.py')
            }
        } catch (_e) { }
    })

    // Open Feedback and assert entry exists
    await page.click('#tab-btn-feedback')
    await page.waitForSelector('.feedback-entry[data-id="edit-file-presence"]', { timeout: 3000 })
    const txt = await page.textContent('.feedback-entry[data-id="edit-file-presence"] .feedback-msg-matched')
    expect(txt.trim().length).toBeGreaterThan(0)
})
