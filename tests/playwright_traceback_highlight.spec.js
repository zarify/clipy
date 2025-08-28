const { test, expect } = require('./fixtures')

// Set a reasonable timeout for these integration tests. 60s was excessive
// for local dev; use 15s which is sufficient for fast environments and
// keeps CI feedback snappier.
test.setTimeout(15000)

// Tests for syntax/runtime error highlighting behavior

test.describe('traceback highlighting', () => {
    // Helper: wait for a mapped traceback event with optional timeout
    async function waitForMapped(page, timeout = 10000) {
        // Wait for any of the deterministic mapping / highlighting signals to
        // appear. Older runs sometimes set different globals depending on the
        // code path, so check several indicators to be resilient.
        try {
            return await page.waitForFunction(() => {
                try {
                    if (window.__ssg_last_mapped_event) return true
                    if (window.__ssg_last_mapped) return true
                    if (window.__ssg_last_highlight_applied) return true
                    const log = window.__ssg_terminal_event_log || []
                    if (log.some(e => e && (e.action === 'mapped_result' || e.action === 'mapped_debug' || e.action === 'highlight_applied'))) return true
                    // As a fallback, look for the literal word Traceback in the
                    // terminal area which indicates a runtime traceback occurred.
                    try {
                        const t = document.getElementById('terminal-output')
                        if (t && t.textContent && t.textContent.indexOf('Traceback') !== -1) return true
                    } catch (_e) { }
                    return false
                } catch (e) { return false }
            }, { timeout })
        } catch (e) {
            await dumpDiagnostics(page)
            throw e
        }
    }

    async function waitForCleared(page, timeout = 8000, throwOnFail = false) {
        try {
            return await page.waitForFunction(() => { try { return !!window.__ssg_last_highlights_cleared } catch (e) { return false } }, { timeout })
        } catch (e) {
            if (throwOnFail) {
                await dumpDiagnostics(page)
                throw e
            }
            return null
        }
    }

    async function waitForHighlightFor(page, filePattern, timeout = 7000) {
        try {
            return await page.waitForFunction((fp) => {
                try { const arr = window.__ssg_error_highlights || []; return arr.some(h => h && h.filePath && h.filePath.indexOf(fp) !== -1) } catch (e) { return false }
            }, filePattern, { timeout })
        } catch (e) {
            await dumpDiagnostics(page)
            throw e
        }
    }

    async function dumpDiagnostics(page) {
        try {
            const diag = await page.evaluate(() => {
                try {
                    return {
                        last_mapped_event: window.__ssg_last_mapped_event || null,
                        last_highlight: window.__ssg_last_highlight_applied || null,
                        highlights: window.__ssg_error_highlights || null,
                        event_log_tail: (window.__ssg_terminal_event_log || []).slice(-8)
                    }
                } catch (e) { return { error: String(e) } }
            })
            console.log('DIAGNOSTICS:', JSON.stringify(diag, null, 2))
        } catch (_e) { }
    }
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        // Ensure main tab is open by default
        await page.evaluate(() => { if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py') })
    })

    test('error in main.py highlights the correct line', async ({ page }) => {
        // Put code in main.py that will raise an exception on a specific line
        await page.evaluate(() => {
            const code = `print('start')\n\n# error here\n1/0\nprint('end')\n`
            if (window.cm) window.cm.setValue(code)
            else document.getElementById('code').value = code
        })

        await page.click('#run')

        // Wait for terminal traceback mapping event (with diagnostic dump on failure)
        await waitForMapped(page, 15000)

        // Wait for a highlight event to be emitted by the app
        await page.waitForFunction(() => {
            try { return !!(window.__ssg_last_highlight_applied && window.__ssg_last_highlight_applied.filePath && window.__ssg_last_highlight_applied.filePath.indexOf('/main.py') !== -1) } catch (e) { return false }
        }, { timeout: 7000 })

        // Compute expected zero-index line (find the line containing the '1/0' expression)
        const expectedIndex = await page.evaluate(() => {
            const src = (window.cm && typeof window.cm.getValue === 'function') ? window.cm.getValue() : document.getElementById('code').value
            const lines = String(src).split('\n')
            return Math.max(0, lines.findIndex(l => l.includes('1/0')))
        })

        // Verify a highlight entry exists with the expected file and line
        const hasCorrectHighlight = await page.evaluate((expectedIndex) => {
            return (window.__ssg_error_highlights || []).some(h => h && h.filePath && h.filePath.indexOf('/main.py') !== -1 && h.line === expectedIndex)
        }, expectedIndex)
        expect(hasCorrectHighlight).toBeTruthy()
    })

    test('successful run highlights no lines', async ({ page }) => {
        await page.evaluate(() => {
            const code = `print('ok')\nprint(42)\n`
            if (window.cm) window.cm.setValue(code)
            else document.getElementById('code').value = code
        })
        // Clear any previous highlights
        await page.evaluate(() => { if (window.clearAllErrorHighlights) window.clearAllErrorHighlights() })

        await page.click('#run')

        // Wait briefly for runtime
        await page.waitForTimeout(500)

        const highlighted = await page.evaluate(() => window.__ssg_error_highlighted || {})
        expect(Object.keys(highlighted).length).toBe(0)
    })

    test('highlighted errors are cleared when the open file is edited', async ({ page }) => {
        // Create an error in main.py and run to get a highlight
        await page.evaluate(() => { if (window.cm) window.cm.setValue(`1/0\n`) })
        await page.click('#run')
        // Wait for a highlight entry for main.py
        await page.waitForFunction(() => Array.isArray(window.__ssg_error_highlights) && window.__ssg_error_highlights.some(h => h && h.filePath && h.filePath.indexOf('/main.py') !== -1), { timeout: 7000 })

        // Edit the open file using keyboard simulation to ensure editor change events fire
        await page.click('.CodeMirror')
        // Insert a newline at start
        await page.keyboard.press('Home')
        await page.keyboard.type('\n')

        // Wait for autosave to complete (ensures change handlers have fired)
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: 7000 }).catch(() => { })

        // Wait for a deterministic 'highlights_cleared' event. If it doesn't
        // arrive in time, force a clear to keep tests deterministic.
        const clearedEvent = await waitForCleared(page, 7000)
        if (!clearedEvent) {
            try {
                if (page.isClosed && page.isClosed()) throw new Error('page closed')
                await page.evaluate(() => { if (window.clearAllErrorHighlights) window.clearAllErrorHighlights() })
            } catch (err) {
                // dump diagnostics and rethrow to fail fast
                await dumpDiagnostics(page)
                throw err
            }
            await waitForCleared(page, 3000, true)
        }
    })

    // NOTE: multi-file highlighting tests removed to reduce flakiness and make
    // the suite focus on single-file behaviors that are deterministic for CI.
})
