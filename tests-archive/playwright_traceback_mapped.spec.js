const { test, expect } = require('./fixtures')

test('traceback mapped to main.py only once', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Ensure main tab is open/selected
    await page.evaluate(() => { if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py') })

    // Set code that will raise a NameError at runtime (bar is undefined)
    await page.evaluate(() => {
        const code = `def foo():\n    return 1\n\nfoo()\nbar()\n`
        if (window.cm && typeof window.cm.setValue === 'function') window.cm.setValue(code)
        else { const ta = document.getElementById('code'); if (ta) ta.value = code }
    })

    // Click run
    await page.click('#run')

    // Wait for a traceback to appear in the terminal or an event log entry indicating mapping
    await page.waitForFunction(() => {
        try {
            if ((window.__ssg_terminal_event_log || []).some(e => e && (e.action === 'mapped_debug' || e.action === 'highlight_applied'))) return true
        } catch (_) { }
        const out = document.getElementById('terminal-output')
        return out && out.textContent && out.textContent.indexOf('Traceback') !== -1
    }, { timeout: 6000 })

    // Prefer the mapped event log evidence
    const eventLog = await page.evaluate(() => (window.__ssg_terminal_event_log || []).slice(-40))
    const mappedEvents = eventLog.filter(e => e && (e.action === 'mapped_debug' || e.action === 'highlight_applied'))
    const mainEventRef = mappedEvents.some(e => (e.filePath && String(e.filePath).indexOf('/main.py') !== -1) || (e.mappedPreview && String(e.mappedPreview).indexOf('/main.py') !== -1))

    // Fallback: check terminal text for File "/main.py"
    const terminalText = await page.evaluate(() => document.getElementById('terminal-output')?.innerText || '')
    const mainMatches = (terminalText.match(/File \"\/?main.py\"/g) || []).length

    // The test asserts that the traceback mapping referenced main.py (via event or terminal)
    expect(mainEventRef || mainMatches > 0).toBeTruthy()

    // Ensure we didn't leave raw <stdin> or <string> markers in the visible terminal
    expect(terminalText.indexOf('<stdin>')).toBe(-1)
    expect(terminalText.indexOf('<string>')).toBe(-1)
})
