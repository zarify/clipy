// Regression tests to ensure instrumentor returns a usable lineMap and that
// the traceback mapper prefers explicit mappings when available. This covers
// cases where the instrumentor injects multiple lines between original user
// lines (multi-line instrumentation) which previously caused off-by-one
// mappings.

describe('regression: instrumentation -> traceback mapping', () => {
    test('instrumentor builds explicit lineMap for multi-line instrumentation', async () => {
        const src = [
            'a = 1',
            'b = 2',
            'raise Exception("boom")',
        ].join('\n')

        const instrMod = await import('../python-instrumentor.js')
        const { getPythonInstrumentor } = instrMod
        const instr = getPythonInstrumentor()
        const result = await instr.instrumentCode(src)

        // Instrumentor must return code and a lineMap object
        expect(result).toHaveProperty('code')
        expect(result).toHaveProperty('lineMap')
        const map = result.lineMap
        // map should map some instrumented lines back to original lines
        const mappedValues = Object.values(map)
        expect(mappedValues.length).toBeGreaterThan(0)
        expect(mappedValues).toContain(1)
        expect(mappedValues).toContain(3)
    })

    test('mapTracebackAndShow prefers explicit instrumented->original mapping', async () => {
        const mod = await import('../code-transform.js')
        const { mapTracebackAndShow } = mod

        // Simulate an instrumented output where the exception reports line 12
        // (instrumented) and we have a lineMap telling us it maps to original 3.
        const fakeStderr = 'Traceback (most recent call last):\n  File "<stdin>", line 12, in <module>\nException: boom\n'

        // Place an explicit mapping on the window as the runtime would
        if (typeof window === 'undefined') global.window = {}
        window.__ssg_instrumented_line_map = { '12': 3 }

        const mapped = mapTracebackAndShow(fakeStderr, 0, 'a=1\nb=2\nraise Exception("boom")', () => { })

        // The mapper returns the mapped text (or shows it); ensure the mapped
        // output references original line 3 instead of 12.
        expect(mapped).toMatch(/line 3/)
        try { delete window.__ssg_instrumented_line_map } catch (_e) { }
    })

    test('instrumentor handles blank lines and comments between code', async () => {
        const src = [
            '# header comment',
            '',
            'a = 1',
            '',
            '# another comment',
            'raise ValueError("boom")',
        ].join('\n')

        const instrMod = await import('../python-instrumentor.js')
        const { getPythonInstrumentor } = instrMod
        const instr = getPythonInstrumentor()
        const result = await instr.instrumentCode(src)

        // Ensure lineMap contains mappings for the non-blank executable lines
        const vals = Object.values(result.lineMap || {})
        expect(vals).toContain(3) // 'a = 1'
        expect(vals).toContain(6) // 'raise ValueError' original line number
    })

    test('instrumentor maps indented block lines correctly', async () => {
        const src = [
            'def f():',
            '    x = 1',
            '    y = 2',
            '    raise RuntimeError("oops")',
            '',
            'f()',
        ].join('\n')

        const instrMod = await import('../python-instrumentor.js')
        const { getPythonInstrumentor } = instrMod
        const instr = getPythonInstrumentor()
        const result = await instr.instrumentCode(src)

        // Find instrumented line that maps back to the raise (original line 4)
        const mappedBack = Object.entries(result.lineMap || {}).find(([k, v]) => Number(v) === 4)
        expect(mappedBack).toBeTruthy()
        // Ensure mapping keys are numeric instrumented line numbers
        expect(Number(mappedBack[0])).toBeGreaterThan(0)
    })

    test('instrumentor maps consecutive executable lines', async () => {
        const src = [
            'a=1',
            'b=2',
            'c=3',
            'raise Exception("boom")',
        ].join('\n')

        const instrMod = await import('../python-instrumentor.js')
        const { getPythonInstrumentor } = instrMod
        const instr = getPythonInstrumentor()
        const result = await instr.instrumentCode(src)

        // Ensure every original executable line has at least one mapping
        const originalLines = [1, 2, 3, 4]
        const mappedSet = new Set(Object.values(result.lineMap || {}).map(Number))
        for (const ln of originalLines) {
            expect(mappedSet.has(ln)).toBe(true)
        }
    })
})
