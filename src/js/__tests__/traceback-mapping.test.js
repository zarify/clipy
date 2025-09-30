test('map traceback maps instrumented line to original line for IndexError example', async () => {
    const mod = await import('../code-transform.js')
    const instrMod = await import('../python-instrumentor.js')
    const { transformAndWrap, mapTracebackAndShow } = mod
    const { getPythonInstrumentor } = instrMod

    const userCode = `x = [1,2,3,4,5,6,7,8,9]\nfor i in range(20):\n    print(x[i])\n`

    // Simulate transform wrapper (non-asyncify path)
    const transformed = transformAndWrap(userCode)
    // Instrument using our instrumentor
    const instr = getPythonInstrumentor()
    const result = await instr.instrumentCode(transformed, null)

    // Store global map similar to runtime behavior
    if (typeof window === 'undefined') global.window = {}
    window.__ssg_instrumented_line_map = result.lineMap || null

    // Suppose runtime reported an IndexError at instrumented line where the print occurs.
    // Find the instrumented line number corresponding to original line 3
    let instrumentedLine = null
    for (const [k, v] of Object.entries(result.lineMap || {})) {
        if (Number(v) === 3) instrumentedLine = Number(k)
    }
    expect(instrumentedLine).not.toBeNull()

    // Craft a fake traceback that references <stdin> at that instrumented line
    const raw = `Traceback (most recent call last):\n  File "<stdin>", line ${instrumentedLine}, in <module>\nIndexError: list index out of range`;

    const mapped = mapTracebackAndShow(raw, result.headerLines, '/main.py')
    expect(mapped).toContain('File "/main.py", line 3')
})
