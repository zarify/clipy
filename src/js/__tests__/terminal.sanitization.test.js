/**
 * Tests for terminal sanitization behavior.
 *
 * These tests verify that dangerous HTML provided to terminal APIs is
 * not inserted as active HTML into the DOM. We add tests for both
 * appendTerminal (which should be safe already) and setTerminalInnerHTML
 * (which is intentionally failing initially so we can implement a fix
 * afterwards).
 */

beforeEach(() => {
    // Ensure a clean DOM terminal container for each test
    document.body.innerHTML = '<div id="terminal-output"></div>'
    // Clear any test globals
    try { delete global.__terminal_test_flag } catch (_e) { }
    // Ensure DOMPurify is stubbed in the test environment so sanitizeHtml
    // and other code paths that rely on it behave as expected.
    if (!window.DOMPurify) {
        window.DOMPurify = { sanitize: (s) => String(s).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/on[a-z]+=(("[^"]*")|(\'[^']*\')|([^\s>]+))/gi, '') }
    }
})

test('appendTerminal should not inject raw HTML (uses textContent)', async () => {
    const { appendTerminal, getTerminalInnerHTML } = await import('../terminal.js')
    // Append a string that looks like HTML
    appendTerminal('<b>bold</b>')
    const html = getTerminalInnerHTML()
    // appendTerminal uses textContent, so the innerHTML should contain escaped entities
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;')
    expect(html).not.toContain('<script>')
})

test('setTerminalInnerHTML should sanitize or remove dangerous attributes and scripts', async () => {
    const { setTerminalInnerHTML, getTerminalInnerHTML } = await import('../terminal.js')
    const malicious = '<img src="x" onerror="window.__terminal_executed=1"><script>window.__terminal_script=1</script><b>ok</b>'

    // Ensure globals are not set before call
    try { delete global.__terminal_executed } catch (_e) { }
    try { delete global.__terminal_script } catch (_e) { }

    // Call the risky API (this test will fail until we add sanitization)
    setTerminalInnerHTML(malicious)

    const html = getTerminalInnerHTML()

    // Expect dangerous attributes and script tags to be absent after sanitization
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/<script\b/i)

    // The allowed content (bold) should remain (possibly sanitized but present)
    expect(html).toMatch(/ok|&lt;b&gt;ok&lt;\/b&gt;|<b>ok<\/b>/i)
})
