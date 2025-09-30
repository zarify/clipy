import { setupTerminalDOM, setupCodeArea, clearLocalStorageMirror, setRuntimeAdapter, setFileManager, setMAIN_FILE, ensureAppendTerminalDebug } from './test-utils/test-setup.js'

test('executeWithTimeout resolves and times out appropriately', async () => {
    const mod = await import('../execution.js')
    const { executeWithTimeout } = mod

    // quick-resolving promise
    const p1 = Promise.resolve('ok')
    const r1 = await executeWithTimeout(p1, 1000, 500)
    expect(r1).toBe('ok')

    // hanging promise should timeout
    let hung = true
    const p2 = new Promise(() => { /* never resolves */ })
    await expect(executeWithTimeout(p2, 50, 20)).rejects.toThrow(/Execution timeout|Safety timeout|cancelled by user|Execution was cancelled/)
})

// The legacy localStorage mirror behavior was removed in favor of
// unified storage/indexedDB. This test used to assert that MAIN_FILE
// was mirrored into localStorage when no backend was present. That
// behavior is no longer part of the runtime and the test has been
// removed.

test('safety timeout attempts VM interrupt and aborts if interrupt fails', async () => {
    const adapter = { run: async () => new Promise(() => { }), _module: {} }
    await setRuntimeAdapter(adapter)
    setupTerminalDOM()
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 10, safetyTimeoutSeconds: 0.01 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/Safety timeout reached|attempting VM interrupt|forcing abort|VM interrupt failed/i)
})

test('safety timeout uses VM interrupt when available', async () => {
    const adapter = { run: async () => new Promise(() => { }), hasYieldingSupport: true, interruptExecution: () => true }
    await setRuntimeAdapter(adapter)
    setupTerminalDOM()
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 10, safetyTimeoutSeconds: 0.01 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/attempting VM interrupt|KeyboardInterrupt|Safety timeout/i)
})

test('mapTracebackAndShow + replaceBufferedStderr produce mapped traceback output', async () => {
    setupTerminalDOM()
    setMAIN_FILE('/main.py')
    localStorage.setItem('ssg_files_v1', JSON.stringify({ '/main.py': 'print(1)' }))
    window.__ssg_stderr_buffering = true
    window.__ssg_stderr_buffer = [
        'Traceback (most recent call last):',
        '  File "<stdin>", line 3, in <module>',
        'NameError: name "x" is not defined'
    ]
    ensureAppendTerminalDebug()
    const { mapTracebackAndShow } = await import('../code-transform.js')
    const mapped = mapTracebackAndShow(window.__ssg_stderr_buffer.join('\n'), 2, window.MAIN_FILE)
    try { window.__ssg_last_mapped = mapped } catch (_e) { }
    const term = await import('../terminal.js')
    term.replaceBufferedStderr(mapped)
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/File "\/main.py", line/) // mapped filename
    expect(typeof mapped === 'string' && mapped.length > 0).toBeTruthy()
})

test('regression: mixed python+js traceback shows only python traceback (no vendor/js frames)', async () => {
    setupTerminalDOM()
    setMAIN_FILE('/main.py')
    localStorage.setItem('ssg_files_v1', JSON.stringify({ '/main.py': 'print(1)' }))
    window.__ssg_stderr_buffering = true
    // Simulate a runtime that emits a Python traceback followed by JS vendor frames
    window.__ssg_stderr_buffer = [
        'Traceback (most recent call last):',
        '  File "<stdin>", line 5, in <module>',
        'NameError: name "z" is not defined',
        'runPythonAsync@http://localhost:8000/js/micropython.js:1171:68',
        'runPythonCode@http://localhost:8000/js/execution.js:533:78'
    ]
    ensureAppendTerminalDebug()
    const { mapTracebackAndShow } = await import('../code-transform.js')
    const mapped = mapTracebackAndShow(window.__ssg_stderr_buffer.join('\n'), 2, window.MAIN_FILE)
    try { window.__ssg_last_mapped = mapped } catch (_e) { }
    const term = await import('../terminal.js')
    term.replaceBufferedStderr(mapped)
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    // Should contain mapped python file/line but should NOT contain vendor/js frames
    expect(text).toMatch(/File "\/main.py", line/)
    // Avoid complex regex with unescaped slashes in a literal; assert absence of vendor frames with two safe checks
    expect(text).not.toMatch(/micropython\.js/)
    expect(text).not.toMatch(/http:\/\/localhost:8000\/js\//)
    expect(typeof mapped === 'string' && mapped.length > 0).toBeTruthy()
})

test('mixed traceback: debug flag shows vendor frames when enabled', async () => {
    setupTerminalDOM()
    setMAIN_FILE('/main.py')
    localStorage.setItem('ssg_files_v1', JSON.stringify({ '/main.py': 'print(1)' }))
    window.__ssg_stderr_buffering = true
    window.__ssg_stderr_buffer = [
        'Traceback (most recent call last):',
        '  File "<stdin>", line 2, in <module>',
        'NameError: name "y" is not defined',
        'runPythonAsync@http://localhost:8000/js/micropython.js:1171:68'
    ]
    // Enable debug flag so vendor frames are preserved
    window.__ssg_debug_show_vendor_frames = true
    ensureAppendTerminalDebug()
    const { mapTracebackAndShow } = await import('../code-transform.js')
    const mapped = mapTracebackAndShow(window.__ssg_stderr_buffer.join('\n'), 2, window.MAIN_FILE)
    try { window.__ssg_last_mapped = mapped } catch (_e) { }
    const term = await import('../terminal.js')
    term.replaceBufferedStderr(mapped)
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    // With debug flag on we expect vendor frame to be visible
    expect(text).toMatch(/micropython\.js/)
    // cleanup debug flag
    delete window.__ssg_debug_show_vendor_frames
})

test('mixed traceback: header-less python exception followed by js frames hides vendor frames', async () => {
    setupTerminalDOM()
    setMAIN_FILE('/main.py')
    localStorage.setItem('ssg_files_v1', JSON.stringify({ '/main.py': 'print(1)' }))
    window.__ssg_stderr_buffering = true
    // No Traceback header; just a python exception line then JS frames
    window.__ssg_stderr_buffer = [
        'NameError: name "q" is not defined',
        'runPythonAsync@http://localhost:8000/js/micropython.js:1171:68',
        'runPythonCode@http://localhost:8000/js/execution.js:533:78'
    ]
    ensureAppendTerminalDebug()
    const { mapTracebackAndShow } = await import('../code-transform.js')
    const mapped = mapTracebackAndShow(window.__ssg_stderr_buffer.join('\n'), 2, window.MAIN_FILE)
    try { window.__ssg_last_mapped = mapped } catch (_e) { }
    const term = await import('../terminal.js')
    term.replaceBufferedStderr(mapped)
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    // Should show the python exception but not the vendor frames
    expect(text).toMatch(/NameError: name "q" is not defined/)
    expect(text).not.toMatch(/micropython\.js|http:\/\/localhost:8000\/js\//)
})

test('regression: instrumented code maps traceback to original user line', async () => {
    setupTerminalDOM()
    setMAIN_FILE('/main.py')
    // put a simple user program with an error on line 1
    const userCode = `ix = 10\nfor i in range(5):\n    print(f"x + i = {x + i}")\nprint(\"OK Done\")\n`
    localStorage.setItem('ssg_files_v1', JSON.stringify({ '/main.py': userCode }))

    // Transform and instrument the user code to compute the real header offset
    ensureAppendTerminalDebug()
    const ct = await import('../code-transform.js')
    const { transformAndWrap, mapTracebackAndShow } = ct
    const transformed = transformAndWrap(userCode)

    // Instrument the transformed code so we account for instrumentor header lines
    const pi = await import('../python-instrumentor.js')
    const instr = pi.getPythonInstrumentor()
    const instrResult = await instr.instrumentCode(transformed.code)

    // instrResult may be {code, headerLines} or a string for backwards compat
    const instrHeader = (instrResult && typeof instrResult === 'object') ? (Number(instrResult.headerLines) || 0) : 0
    const totalHeader = (Number(transformed.headerLines) || 0) + instrHeader

    // Simulate that stderr was buffered by the runtime with a traceback
    // produced from the transformed+instrumented code: runtime reports line = totalHeader + originalLine
    const runtimeLine = totalHeader + 1
    window.__ssg_stderr_buffering = true
    window.__ssg_stderr_buffer = [
        'Traceback (most recent call last):',
        `  File "<stdin>", line ${runtimeLine}, in <module>`,
        "NameError: name 'x' is not defined"
    ]

    const mapped = mapTracebackAndShow(window.__ssg_stderr_buffer.join('\n'), totalHeader, window.MAIN_FILE)
    try { window.__ssg_last_mapped = mapped } catch (_e) { }

    // Replace buffered stderr with mapped output and inspect terminal
    const term = await import('../terminal.js')
    term.replaceBufferedStderr(mapped)
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''

    // We expect the mapped traceback to refer to '/main.py', line 1 (original code)
    expect(text).toMatch(/File "\/main.py", line 1/)
    expect(text).toMatch(/NameError: name 'x' is not defined/)
})

test('asyncify recovery: successful recovery path clears state', async () => {
    setupTerminalDOM()
    const adapter = {
        runPythonAsync: async () => { throw new Error('async operation in flight') },
        clearInterrupt: () => { /* succeed */ },
        _module: {
            Asyncify: { currData: 1, state: 1 },
            ccall: (name) => { /* pretend to reinit */ }
        }
    }
    await setRuntimeAdapter(adapter)
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/Runtime state cleared successfully|Runtime state cleared/i)
})

test('asyncify recovery: failure path logs automatic recovery failed', async () => {
    setupTerminalDOM()
    const adapter = { runPythonAsync: async () => { throw new Error('async operation in flight') }, _module: {} }
    await setRuntimeAdapter(adapter)
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/Automatic recovery failed|Automatic recovery failed/i)
})

test('input probe fallback: runtime without async runner triggers friendly error', async () => {
    setupTerminalDOM()
    const adapter = { run: async (code) => { if (typeof code === 'string' && code.trim().startsWith('async def __ssg_probe')) { throw new Error('invalid syntax') } return '' } }
    await setRuntimeAdapter(adapter)
    const ex = await import('../execution.js')
    await ex.runPythonCode('x = input()\nprint(x)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/This runtime does not support async input handling|Consider using an asyncify-enabled MicroPython runtime/)
})

test('feedback evaluation is called with run captures', async () => {
    setupTerminalDOM('OUTPUT')
    const adapter = { run: async () => '' }
    await setRuntimeAdapter(adapter)
    setFileManager({ list: () => ['/main.py'] })
    window.Feedback = { evaluateFeedbackOnRun: (payload) => { window.__ssg_feedback_payload = payload } }
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    expect(window.__ssg_feedback_payload).toBeDefined()
    expect(typeof window.__ssg_feedback_payload.stdout === 'string').toBeTruthy()
    expect(Array.isArray(window.__ssg_feedback_payload.filename)).toBeTruthy()
})
