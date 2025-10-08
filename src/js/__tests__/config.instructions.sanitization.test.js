/**
 * Tests for instructions rendering sanitization.
 * Ensure renderMarkdown + DOMPurify path is used when available and that
 * dangerous markup is not inserted as active HTML into the instructions
 * container.
 */

beforeEach(() => {
    // Create the instructions container expected by initializeInstructions
    document.body.innerHTML = '<div id="instructions-content"></div>'
    // Ensure DOMPurify and marked are present on window for the test path
    // Load a minimal stub if not present
    if (!window.DOMPurify) {
        window.DOMPurify = { sanitize: (s) => String(s).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/on[a-z]+=((\"[^\"]*\")|(\'[^\']*\')|([^\s>]+))/gi, '') }
    }
    if (!window.marked) {
        window.marked = { parse: (md) => String(md) }
    }
})

test('initializeInstructions uses renderMarkdown and DOMPurify to sanitize', async () => {
    const mod = await import('../config.js')
    const { initializeInstructions } = mod

    const cfg = { instructions: '<img src=x onerror=window.__instr_exec=1>Some text<script>window.__instr_script=1</script>' }

    // Clean any previous globals
    try { delete global.__instr_exec } catch (_e) { }
    try { delete global.__instr_script } catch (_e) { }

    initializeInstructions(cfg)

    const el = document.getElementById('instructions-content')
    expect(el).not.toBeNull()
    const html = el.innerHTML

    // Script tags and event attributes should be removed
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/<script\b/i)
    // Visible text should remain
    expect(html).toMatch(/Some text/)
})
