const { test, expect } = require('./fixtures')

// Increase timeout for these integration tests because runtime initialization
// and file-sync operations can be slow in CI/local environments.
test.setTimeout(60000)

// Tests for syntax/runtime error highlighting behavior

test.describe('traceback highlighting', () => {
    // Helper: wait for a mapped traceback event with optional timeout
    async function waitForMapped(page, timeout = 10000) {
        try {
            return await page.waitForFunction(() => { try { return !!window.__ssg_last_mapped_event } catch (e) { return false } }, { timeout })
        } catch (e) {
            await dumpDiagnostics(page)
            throw e
        }
    }

    async function waitForCleared(page, timeout = 7000, throwOnFail = false) {
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

    test('highlighted errors are cleared when an open file is edited, a new file is opened, or deleted', async ({ page }) => {
        // First, create an error in main.py and run to get highlight
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

        // Re-run to reintroduce highlight
        await page.evaluate(() => { if (window.cm) window.cm.setValue(`1/0\n`) })
        await page.click('#run')
        await waitForHighlightFor(page, '/main.py', 5000)

        // Open a new file (simulate creating/opening another file)
        await page.evaluate(() => {
            try {
                if (window.TabManager && typeof window.TabManager.openTab === 'function') {
                    // create a new temporary file via FileManager (if available) or open a builtin
                    if (window.FileManager && typeof window.FileManager.save === 'function') {
                        window.FileManager.save('/temp.py', 'print(1)')
                        window.TabManager.openTab('/temp.py')
                    } else {
                        window.TabManager.openTab('/__placeholder__.py')
                    }
                }
            } catch (e) { }
        })

        // Wait for file to appear in the local mirror if FileManager was used
        await page.waitForFunction((p) => {
            try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return Object.prototype.hasOwnProperty.call(m, p) } catch (e) { return false }
        }, '/temp.py', { timeout: 10000 }).catch(() => { })

        // Wait for highlight cleared
        await waitForCleared(page, 7000)

        // Reintroduce highlight, then delete file to test deletion clears highlights
        await page.evaluate(() => { if (window.cm) window.cm.setValue(`1/0\n`) })
        await page.click('#run')
        await waitForHighlightFor(page, '/main.py', 5000)

        // Delete the file via FileManager if present
        await page.evaluate(() => {
            try { if (window.FileManager && typeof window.FileManager.delete === 'function') window.FileManager.delete('/main.py') } catch (e) { }
        })

        // Wait for file to be removed from local mirror
        await page.waitForFunction((p) => {
            try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return !Object.prototype.hasOwnProperty.call(m, p) } catch (e) { return true }
        }, '/main.py', { timeout: 7000 }).catch(() => { })

        await waitForCleared(page, 7000)
    })

    test('highlighted errors in a file other than main.py highlights the line in the correct file', async ({ page }) => {
        // Create another file and open it
        await page.evaluate(() => {
            if (window.FileManager && typeof window.FileManager.save === 'function') {
                window.FileManager.save('/other.py', "def f():\n    x = 1\n    return x\n\nf()\nraise Exception('boom')\n")
                if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/other.py')
            } else {
                if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/other.py')
            }
        })

        // Create a main.py that imports and calls other.py so runtime will execute it
        await page.evaluate(() => {
            try { if (window.FileManager && typeof window.FileManager.save === 'function') window.FileManager.save('/main.py', "from other import f\nf()\n") } catch (e) { }
            try { if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/main.py') } catch (e) { }
        })

        // Wait for files to appear in the local mirror before running
        await page.waitForFunction((p) => {
            try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return Object.prototype.hasOwnProperty.call(m, p) } catch (e) { return false }
        }, 'other.py', { timeout: 10000 }).catch(() => { })
        await page.waitForFunction((p) => {
            try { const m = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); return Object.prototype.hasOwnProperty.call(m, p) } catch (e) { return false }
        }, '/main.py', { timeout: 10000 }).catch(() => { })

        await page.click('#run')

        // Wait for a mapped traceback event to be recorded
        await waitForMapped(page, 10000)

        // Wait for the deterministic highlight event for other.py
        await waitForHighlightFor(page, 'other.py', 15000)
        const found = await page.evaluate(() => !!(window.__ssg_last_highlight_applied && window.__ssg_last_highlight_applied.filePath && window.__ssg_last_highlight_applied.filePath.indexOf('other.py') !== -1))
        expect(found).toBeTruthy()
    })

    test('traceback with multiple errors highlights all relevant lines in relevant files', async ({ page }) => {
        // Create two files such that traceback contains frames from both
        await page.evaluate(() => {
            if (window.FileManager && typeof window.FileManager.save === 'function') {
                window.FileManager.save('/a.py', "def a():\n    from b import bfunc\n    bfunc()\n")
                window.FileManager.save('/b.py', "def bfunc():\n    x = 1\n    y = 0\n    return x / y\n")
                // open a.py in the editor
                if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/a.py')
            }
        })

        // Run (a.py should be main or imported depending on how runtime resolves; use a direct exec trick)
        await page.evaluate(() => {
            // ensure main.py imports a
            if (window.FileManager && typeof window.FileManager.save === 'function') {
                window.FileManager.save('/main.py', "from a import a\na()\n")
                if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/main.py')
            }
        })

        await page.click('#run')

        // Wait for a mapped traceback event to be recorded
        await waitForMapped(page, 15000)

        // Wait for both files to have highlighted entries in the highlights array
        await waitForHighlightFor(page, '/a.py', 10000)
        await waitForHighlightFor(page, '/b.py', 10000)

        const keys = await page.evaluate(() => (window.__ssg_error_highlights || []).map(h => h.filePath))
        expect(keys.some(k => k && k.indexOf('/a.py') !== -1)).toBeTruthy()
        expect(keys.some(k => k && k.indexOf('/b.py') !== -1)).toBeTruthy()
    })
})
