test('map traceback maps instrumented line to original line for IndexError example', async () => {
    const mod = await import('../code-transform.js')
    const { transformAndWrap, mapTracebackAndShow } = mod

    const userCode = `x = [1,2,3,4,5,6,7,8,9]\nfor i in range(20):\n    print(x[i])\n`

    // Simulate transform wrapper (non-asyncify path)
    const transformed = transformAndWrap(userCode)
    // The legacy instrumentor has been removed; compute a compatible
    // instrumentation metadata shape directly from the transform result.
    // We emulate the instrumentor's identity lineMap and headerLines
    // heuristic used by the previous implementation.
    const result = {}
    result.code = transformed.code
    // Build identity lineMap (instrumented line -> original line)
    const lines = String(transformed.code || '').split('\n')
    const lineMap = {}
    for (let i = 0; i < lines.length; i++) {
        lineMap[i + 1] = i + 1
    }
    result.lineMap = lineMap
    // Heuristic headerLines: reuse transform.headerLines when present
    result.headerLines = Number(transformed.headerLines) || 0

    // Store global map similar to runtime behavior. The runtime subtracts
    // the transform wrapper's headerLines when exposing the map to callers,
    // so simulate that here for the unit test.
    if (typeof window === 'undefined') global.window = {}
    const adjustedMap = {}
    const transformHeader = Number(transformed.headerLines) || 0
    for (const [k, v] of Object.entries(result.lineMap || {})) {
        try {
            adjustedMap[k] = Math.max(1, Number(v) - transformHeader)
        } catch (_e) { adjustedMap[k] = Number(v) }
    }
    window.__ssg_instrumented_line_map = adjustedMap

    // Suppose runtime reported an IndexError at instrumented line where the print occurs.
    // Find the instrumented line number corresponding to original line 3
    let instrumentedLine = null
    for (const [k, v] of Object.entries(window.__ssg_instrumented_line_map || {})) {
        if (Number(v) === 3) instrumentedLine = Number(k)
    }
    expect(instrumentedLine).not.toBeNull()

    // Craft a fake traceback that references <stdin> at that instrumented line
    const raw = `Traceback (most recent call last):\n  File "<stdin>", line ${instrumentedLine}, in <module>\nIndexError: list index out of range`;

    const mapped = mapTracebackAndShow(raw, result.headerLines, '/main.py')
    expect(mapped).toContain('File "/main.py", line 3')
})
