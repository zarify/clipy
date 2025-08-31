// Copied runner for src/ path so dev server can serve it at /tests/runner.js

try {

    const log = (...args) => { try { console.debug('[runner]', ...args) } catch (e) { } }

    let mpInstance = null
    let runtimeAdapter = null
    let stdoutBuf = []
    let stderrBuf = []
    let pendingStdinResolve = null

    function post(o) {
        try { console.log('[runner post]', o) } catch (_) { }
        try { window.parent.postMessage(o, location.origin) } catch (e) { try { window.parent.postMessage(o, '*') } catch (_) { } }
    }

    async function initRuntime(runtimeUrl) {
        log('initRuntime', runtimeUrl)
        try {
            // Try to import the runtime module and prefer its exported loader function.
            let loaderFn = null
            try {
                const mod = await import(runtimeUrl)
                if (mod && typeof mod.loadMicroPython === 'function') loaderFn = mod.loadMicroPython
            } catch (e) { log('import failed', e) }

            // Fallback to globalThis if the module sets loadMicroPython globally
            if (!loaderFn && typeof globalThis.loadMicroPython === 'function') loaderFn = globalThis.loadMicroPython

            if (loaderFn) {
                // (module inputHandler will be set after we declare it) - don't set it here
                const stdout = (chunk) => {
                    const text = (typeof chunk === 'string') ? chunk : (new TextDecoder().decode(chunk || new Uint8Array()))
                    stdoutBuf.push(text)
                    post({ type: 'stdout', text })
                }
                const stderr = (chunk) => {
                    const text = (typeof chunk === 'string') ? chunk : (new TextDecoder().decode(chunk || new Uint8Array()))
                    stderrBuf.push(text)
                    post({ type: 'stderr', text })
                }
                // Define inputHandler first so stdin can delegate to it when available.
                const inputHandler = async function (promptText = '') {
                    return new Promise((resolve) => {
                        // Use the same pendingStdinResolve mechanism so parent can reply via postMessage
                        pendingStdinResolve = resolve
                        try {
                            // Mirror the prompt into stdoutBuf so the runtime's own
                            // output includes the prompt string. Do not append a
                            // newline — keep the prompt as the runtime would emit it.
                            const ptxt = promptText == null ? '' : String(promptText)
                            if (ptxt !== '') {
                                stdoutBuf.push(ptxt)
                                post({ type: 'stdout', text: ptxt })
                            }
                        } catch (_e) { }
                        post({ type: 'stdinRequest', prompt: promptText || '' })
                        // safety timeout: resolve empty after 20s
                        setTimeout(() => {
                            if (pendingStdinResolve) {
                                try { pendingStdinResolve('') } catch (e) { }
                                pendingStdinResolve = null
                                post({ type: 'debug', text: 'stdin timeout, returning empty' })
                            }
                        }, 20000)
                    })
                }

                // Custom stdin: delegate to inputHandler when present to avoid dual-calls
                const stdin = () => {
                    if (typeof inputHandler === 'function') {
                        try {
                            // Delegate to inputHandler and return its resolved value
                            return Promise.resolve(inputHandler('')).then(v => (v == null ? '' : String(v)))
                        } catch (e) {
                            post({ type: 'debug', text: 'stdin delegation failed: ' + String(e) })
                            // fall through to legacy behavior
                        }
                    }

                    return new Promise((resolve) => {
                        pendingStdinResolve = resolve
                        post({ type: 'stdinRequest' })
                        setTimeout(() => {
                            if (pendingStdinResolve) {
                                try { pendingStdinResolve('') } catch (e) { }
                                pendingStdinResolve = null
                                post({ type: 'debug', text: 'stdin timeout, returning empty' })
                            }
                        }, 20000)
                    })
                }

                // Initialize the runtime and capture the mpInstance
                try {
                    // Ensure Module.inputHandler is populated for runtimes that probe Module
                    try { globalThis.Module = globalThis.Module || {}; globalThis.Module.inputHandler = inputHandler } catch (e) { }
                    mpInstance = await loaderFn({ url: '/vendor/micropython.wasm', stdout, stderr, stdin, linebuffer: true, inputHandler })
                } catch (e) {
                    post({ type: 'error', error: String(e) })
                    return false
                }

                runtimeAdapter = {
                    _module: mpInstance,
                    run: async (code) => {
                        if (!mpInstance) throw new Error('mpInstance not initialized')
                        if (typeof mpInstance.runPythonAsync === 'function') return await mpInstance.runPythonAsync(code)
                        if (typeof mpInstance.runPython === 'function') return mpInstance.runPython(code)
                        return ''
                    },
                    runPythonAsync: async (code) => {
                        if (!mpInstance) throw new Error('mpInstance not initialized')
                        if (typeof mpInstance.runPythonAsync === 'function') return await mpInstance.runPythonAsync(code)
                        throw new Error('runPythonAsync not available')
                    },
                    interruptExecution: (mpInstance && mpInstance.interruptExecution) ? mpInstance.interruptExecution.bind(mpInstance) : null
                }

                return true
            }

            post({ type: 'error', error: 'No loadMicroPython available after import' })
            return false
        } catch (err) {
            post({ type: 'error', error: String(err) })
            return false
        }
    }

    function writeFilesToFS(files) {
        try {
            if (!mpInstance || !mpInstance.FS) return
            for (const p of Object.keys(files || {})) {
                try {
                    try {
                        const preview = (typeof files[p] === 'string') ? String(files[p]).slice(0, 200) : (files[p] && files[p].length ? ('<binary:' + files[p].length + '>') : '<empty>')
                        post({ type: 'debug', text: 'writeFilesToFS: ' + String(p) + ' len=' + (typeof files[p] === 'string' ? String(files[p]).length : (files[p] && files[p].length ? files[p].length : 0)) + ' preview=' + preview })
                    } catch (e) { post({ type: 'debug', text: 'writeFilesToFS: ' + String(p) }) }
                    const dir = p.split('/').slice(0, -1).join('/') || '/'
                    try { mpInstance.FS.mkdirTree(dir) } catch (e) { }
                    const data = files[p]
                    if (typeof data === 'string') {
                        mpInstance.FS.writeFile(p, data)
                    } else if (data instanceof Uint8Array) {
                        mpInstance.FS.writeFile(p, data)
                    }
                } catch (e) {
                    log('writeFilesToFS error', p, e)
                }
            }
        } catch (e) { log('writeFilesToFS outer error', e) }
    }

    async function handleRunTest(test) {
        stdoutBuf = []
        stderrBuf = []
        pendingStdinResolve = null
        const start = Date.now()
        try {
            if (test.setup && typeof test.setup === 'object') {
                writeFilesToFS(test.setup)
            }
            if (test.files && typeof test.files === 'object') {
                writeFilesToFS(test.files)
            }
            const mainToRun = (test.main && typeof test.main === 'string') ? test.main : null
            // Helper to run an import expression directly. Previously we executed
            // a Python wrapper string which caused the runtime to report the
            // wrapper as the traceback source (e.g. "<stdin>"). Running the
            // import expression directly ensures tracebacks refer to the actual
            // module files (for example "/main.py"). We rely on the host-side
            // heuristic that moves tracebacks from stdout->stderr when needed.
            const runImport = async (importExpr) => {
                try {
                    await runtimeAdapter.run(importExpr)
                } catch (e) {
                    // Some runtimes surface Python tracebacks by rejecting the
                    // promise with an error whose message contains the traceback.
                    // Capture that text, filter out wrapper-inserted lines like
                    // `File "<stdin>"`, and treat the result as stderr so the
                    // host can display it without the import wrapper noise.
                    try {
                        const raw = String(e || '')
                        const filtered = raw.split('\n').filter(l => !l.includes('File "<stdin>"')).join('\n')
                        if (filtered) {
                            stderrBuf.push(filtered)
                            post({ type: 'stderr', text: filtered })
                        }
                    } catch (_err) { }
                    // Swallow the error here; the harness will inspect buffers
                    // and determine pass/fail. Returning allows the test run to
                    // continue to the buffer-heuristic and result assembly.
                }
            }

            if (mainToRun) {
                // Write the inline main to /main.py inside the runtime FS so the
                // traceback filename will point to /main.py when printed.
                try { writeFilesToFS({ '/main.py': mainToRun }) } catch (e) { }
                await runImport('import main')
            } else if (test.entry && typeof test.entry === 'string') {
                const mod = test.entry.replace(/\.[^/.]+$/, '')
                await runImport(`import ${mod}`)
            } else {
                // If no main/entry provided, attempt to import /main.py directly.
                // Some runtime FS implementations may not expose lookupPath or
                // behave inconsistently, so attempt the import and let it fail
                // gracefully if the file doesn't exist.
                try {
                    post({ type: 'debug', text: 'attempting import main' })
                    await runImport('import main')
                    post({ type: 'debug', text: 'import main completed' })
                } catch (e) {
                    post({ type: 'debug', text: 'import main failed: ' + String(e) })
                    // ignore -- handled below via buffers/heuristic
                }
            }

            // Diagnostic debug: report buffer sizes and small previews so the
            // host can see whether the runtime emitted any output.
            try {
                const joinedOut = (stdoutBuf && stdoutBuf.length) ? stdoutBuf.join('') : ''
                const joinedErr = (stderrBuf && stderrBuf.length) ? stderrBuf.join('') : ''
                post({ type: 'debug', text: 'afterRun stdout.len=' + (stdoutBuf ? stdoutBuf.length : 0) + ' stderr.len=' + (stderrBuf ? stderrBuf.length : 0) })
                if (joinedOut) post({ type: 'debug', text: 'afterRun stdout.preview=' + String(joinedOut).slice(0, 200) })
                if (joinedErr) post({ type: 'debug', text: 'afterRun stderr.preview=' + String(joinedErr).slice(0, 200) })
            } catch (e) { }

            const duration = Date.now() - start

            // Heuristic: some MicroPython runtimes emit exception tracebacks
            // through the stdout callback. If stderr is empty but stdout
            // contains a traceback, move the traceback suffix into stderr so
            // the host can treat it as stderr.
            try {
                if ((!stderrBuf || stderrBuf.length === 0) && stdoutBuf && stdoutBuf.length) {
                    const joined = stdoutBuf.join('')
                    const tbIdx = joined.indexOf('Traceback (most recent call last):')
                    const tbIdxAlt = tbIdx === -1 ? joined.indexOf('Traceback') : tbIdx
                    if (tbIdxAlt !== -1) {
                        const before = joined.slice(0, tbIdxAlt)
                        const after = joined.slice(tbIdxAlt)
                        // replace buffers
                        stdoutBuf = before ? [before] : []
                        stderrBuf = after ? [after] : []
                    }
                }
            } catch (e) { /* best-effort, don't fail the test harness */ }

            // Assemble streamed chunks: if any chunk contains a newline already,
            // assume the runtime included line breaks and join as-is. Otherwise
            // insert a single '\n' between chunks so multi-chunk prints like
            // print('a\nb') become 'a\nb' instead of 'ab'.
            const assemble = (buf) => {
                if (!buf || !buf.length) return ''
                const hasNewline = buf.some(s => typeof s === 'string' && s.indexOf('\n') !== -1)
                return hasNewline ? buf.join('') : buf.join('\n')
            }
            return { id: test.id, passed: true, stdout: assemble(stdoutBuf), stderr: assemble(stderrBuf), durationMs: duration }
        } catch (err) {
            const duration = Date.now() - start
            const assemble = (buf) => {
                if (!buf || !buf.length) return ''
                const hasNewline = buf.some(s => typeof s === 'string' && s.indexOf('\n') !== -1)
                return hasNewline ? buf.join('') : buf.join('\n')
            }
            const stderrJoined = assemble(stderrBuf)
            return { id: test.id, passed: false, stdout: assemble(stdoutBuf), stderr: (stderrJoined ? (stderrJoined + '\n' + String(err)) : String(err)), durationMs: duration, reason: String(err) }
        }
    }

    window.addEventListener('message', async (ev) => {
        try { if (ev?.source !== window.parent) return } catch (e) { }
        const msg = ev.data || {}
        try {
            if (msg.type === 'init') {
                const ok = await initRuntime(msg.runtimeUrl || '/vendor/micropython.mjs')
                if (ok) {
                    // If the parent supplied an initial files snapshot (e.g. /main.py),
                    // write those into the runtime FS so tests without an explicit
                    // `main` can import/run the user's MAIN_FILE.
                    try { if (msg.files && typeof msg.files === 'object') writeFilesToFS(msg.files) } catch (e) { log('write init files failed', e) }
                    post({ type: 'ready' })
                }
            } else if (msg.type === 'runTest') {
                const timeout = (msg.test && msg.test.timeoutMs) || 20000
                let finished = false
                const timer = setTimeout(async () => {
                    if (finished) return
                    finished = true
                    try {
                        if (runtimeAdapter && runtimeAdapter.interruptExecution) {
                            try { runtimeAdapter.interruptExecution() } catch (e) { }
                        }
                    } catch (e) { }
                    post({ type: 'error', error: 'timeout' })
                }, timeout)

                const result = await handleRunTest(msg.test)
                if (!finished) {
                    finished = true
                    clearTimeout(timer)
                    post({ type: 'testResult', ...result })
                }
            } else if (msg.type === 'stdinResponse') {
                if (pendingStdinResolve) {
                    try { pendingStdinResolve(msg.value || '') } catch (e) { }
                    // Echo the input back into stdoutBuf so the host can match
                    // prompt+input sequences (for author tests that expect the
                    // user's typed response to be visible). Mirror what a
                    // terminal would show when a user types and presses Enter.
                    try {
                        const v = msg.value == null ? '' : String(msg.value)
                        if (v !== '') {
                            const echo = v + '\n'
                            stdoutBuf.push(echo)
                            post({ type: 'stdout', text: echo })
                        }
                    } catch (_e) { }
                    pendingStdinResolve = null
                }
            } else if (msg.type === 'terminate') {
                try { post({ type: 'debug', text: 'terminate received' }) } catch (e) { }
                try { if (runtimeAdapter && runtimeAdapter.interruptExecution) runtimeAdapter.interruptExecution() } catch (e) { }
            }
        } catch (err) {
            post({ type: 'error', error: String(err) })
        }
    })


    post({ type: 'loaded' })
    try { post({ type: 'checkpoint', name: 'runner_loaded' }) } catch (_e) { }

} catch (e) {
    try { window.__runner_error = String(e) } catch (_e) { }
    try { console.error('runner top-level exception', e) } catch (_e) { }
}
