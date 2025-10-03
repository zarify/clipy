// Regression tests for traceback mapping with native trace
// Native trace eliminates the need for instrumentation and line mapping

describe('regression: native trace -> traceback mapping', () => {
    test('native trace: headerLines=0 skips mapping and shows errors as-is', async () => {
        const mod = await import('../code-transform.js')
        const { mapTracebackAndShow } = mod

        // With native trace, errors already have correct line numbers
        const nativeStderr = 'Traceback (most recent call last):\n  File "/main.py", line 3, in <module>\nException: boom\n'

        // Native trace uses headerLines=0 to indicate no mapping needed
        const mapped = mapTracebackAndShow(nativeStderr, 0, '/main.py', () => { })

        // The mapper should return the error unchanged (line 3 stays line 3)
        expect(mapped).toMatch(/line 3/)
        expect(mapped).toContain('Exception: boom')
    })

    test('native trace: multi-file errors preserve correct filenames', async () => {
        const mod = await import('../code-transform.js')
        const { mapTracebackAndShow } = mod

        // Native trace preserves filenames across files
        const multiFileError = 'Traceback (most recent call last):\n  File "/helper.py", line 5, in func\n  File "/main.py", line 2, in <module>\nValueError: invalid\n'

        const mapped = mapTracebackAndShow(multiFileError, 0, '/main.py', () => { })

        // Both filenames and line numbers should be preserved
        expect(mapped).toMatch(/helper\.py/)
        expect(mapped).toMatch(/line 5/)
        expect(mapped).toMatch(/main\.py/)
        expect(mapped).toMatch(/line 2/)
    })

    test('mapTracebackAndShow: explicit lineMap still works for legacy compatibility', async () => {
        const mod = await import('../code-transform.js')
        const { mapTracebackAndShow } = mod

        // For backwards compatibility, explicit lineMaps still work when headerLines > 0
        const fakeStderr = 'Traceback (most recent call last):\n  File "<stdin>", line 12, in <module>\nException: boom\n'

        // Place an explicit mapping on the window as the runtime would
        if (typeof window === 'undefined') global.window = {}
        window.__ssg_instrumented_line_map = { '12': 3 }

        // With headerLines > 0, mapping is attempted
        const mapped = mapTracebackAndShow(fakeStderr, 10, 'a=1\nb=2\nraise Exception("boom")', () => { })

        // The mapper returns the mapped text
        expect(mapped).toMatch(/line 3/)
        try { delete window.__ssg_instrumented_line_map } catch (_e) { }
    })
})
