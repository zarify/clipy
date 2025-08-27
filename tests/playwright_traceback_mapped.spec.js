const { test, expect } = require('./fixtures')

test('traceback mapped to main.py only once', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Ensure main tab is open/selected
    await page.evaluate(() => {
        if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py')
    })

    // Set code that will raise a NameError at runtime (bar is undefined)
    await page.evaluate(() => {
        const editorElement = document.querySelector('.CodeMirror')
        const code = `def foo():\n    return 1\n\nfoo()\nbar()\n`
        if (editorElement && editorElement.CodeMirror) {
            editorElement.CodeMirror.setValue(code)
        } else if (window.cm) {
            window.cm.setValue(code)
        } else {
            const ta = document.getElementById('code')
            if (ta) ta.value = code
        }
    })

    // Click run
    await page.click('#run')

    // Wait for a traceback to appear in the terminal
    await page.waitForFunction(() => {
        const out = document.getElementById('terminal-output')
        return out && out.textContent && out.textContent.indexOf('Traceback') !== -1
    }, { timeout: 5000 })

    // Grab terminal text and assert expectations
    const terminalText = await page.evaluate(() => document.getElementById('terminal-output')?.innerText || '')

    // Should reference main.py (not <stdin> or <string>)
    const mainMatches = (terminalText.match(/File "main.py"/g) || []).length
    const stdinMatches = (terminalText.match(/<stdin>/g) || []).length
    const stringMatches = (terminalText.match(/<string>/g) || []).length

    // Count occurrences of Traceback header to ensure only one traceback printed
    const tracebackCount = (terminalText.match(/Traceback \(most recent call last\)/g) || []).length

    expect(tracebackCount).toBeGreaterThan(0)
    expect(tracebackCount).toBe(1)
    expect(mainMatches).toBeGreaterThan(0)
    expect(stdinMatches).toBe(0)
    expect(stringMatches).toBe(0)
})
