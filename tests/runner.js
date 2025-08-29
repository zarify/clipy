// Minimal in-iframe test runner harness.
// Communicates with parent via postMessage and implements the small protocol
// defined in project/author-tests-runner-spec.md

const log = (...args) => { try { console.debug('[runner]', ...args) } catch (e) { } }

let mpInstance = null
let runtimeAdapter = null
let stdoutBuf = []
// Try to import the runtime module and prefer its exported loader function.
let loaderFn = null
try {
    const mod = await import(runtimeUrl)
    if (mod && typeof mod.loadMicroPython === 'function') loaderFn = mod.loadMicroPython
} catch (e) { log('import failed', e) }

// Fallback to globalThis if the module sets loadMicroPython globally
if (!loaderFn && typeof globalThis.loadMicroPython === 'function') loaderFn = globalThis.loadMicroPython

if (loaderFn) {
    let pendingStdinResolve = null

    function post(o) {
        try { console.log('[runner post]', o) } catch (_) { }
        try { window.parent.postMessage(o, location.origin) } catch (e) { try { window.parent.postMessage(o, '*') } catch (_) { } }
    }

    async function initRuntime(runtimeUrl) {
        log('initRuntime', runtimeUrl)
        try {
            // Try dynamic import of the runtime module
            try { await import(runtimeUrl) } catch (e) { log('import failed', e) }

            if (typeof globalThis.loadMicroPython === 'function') {
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
                const stdin = () => {
                    return new Promise((resolve) => {
                        // Send request to parent and wait for response
                        pendingStdinResolve = resolve
                        post({ type: 'stdinRequest' })
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

                const inputHandler = async function (promptText = '') {
                    return new Promise((resolve) => {
                        try {
                            mpInstance = await loaderFn({ url: '/vendor/micropython.wasm', stdout, stderr, stdin, linebuffer: true, inputHandler })
                        } catch (e) {
                            post({ type: 'error', error: String(e) })
                            return false
                        }
                        post({ type: 'stdinRequest', prompt: promptText || '' })
                        setTimeout(() => {
                            if (pendingStdinResolve) {
                                try { pendingStdinResolve('') } catch (e) { }
                                pendingStdinResolve = null
                                post({ type: 'debug', text: 'stdin timeout, returning empty' })
                            }
                        }, 20000)
                    })
                }

                // Ensure global Module has inputHandler set before runtime initialization
                try { globalThis.Module = globalThis.Module || {}; globalThis.Module.inputHandler = inputHandler } catch (e) { }
                mpInstance = await globalThis.loadMicroPython({ url: '/vendor/micropython.wasm', stdout, stderr, stdin, linebuffer: true, inputHandler })

                // Ensure global Module has inputHandler set before runtime initialization
                try { globalThis.Module = globalThis.Module || {}; globalThis.Module.inputHandler = inputHandler } catch (e) { }
                try {
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

                runtimeAdapter = {
                    _module: mpInstance,
                    run: async (code) => {
                        if (typeof mpInstance.runPythonAsync === 'function') return await mpInstance.runPythonAsync(code)
                        if (typeof mpInstance.runPython === 'function') return mpInstance.runPython(code)
                        return ''
                    },
                    runPythonAsync: async (code) => {
                        if (typeof mpInstance.runPythonAsync === 'function') return await mpInstance.runPythonAsync(code)
                        throw new Error('runPythonAsync not available')
                    },
                    interruptExecution: (mpInstance && mpInstance.interruptExecution) ? mpInstance.interruptExecution.bind(mpInstance) : null
                }

                return true
            }

            // If we reach here, we failed to locate loader
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
                    const dir = p.split('/').slice(0, -1).join('/') || '/'
                    // ensure directory exists
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
            // Write setup files and main
            if (test.setup && typeof test.setup === 'object') {
                writeFilesToFS(test.setup)
            }
            if (test.files && typeof test.files === 'object') {
                writeFilesToFS(test.files)
            }
            // If main provided as string, write to /main.py and run it; otherwise if test.main absent, run MAIN_FILE
            const mainToRun = (test.main && typeof test.main === 'string') ? test.main : null
            if (mainToRun) {
                // run the provided main code directly
                await runtimeAdapter.run(mainToRun)
            } else if (test.entry && typeof test.entry === 'string') {
                // run entry file
                await runtimeAdapter.run(`import ${test.entry.replace(/\.[^/.]+$/, '')}`)
            } else if (mpInstance && mpInstance.FS && typeof mpInstance.FS.readFile === 'function') {
                // try run /main.py if exists
                try {
                    const exists = mpInstance.FS.lookupPath('/main.py').node
                    if (exists) {
                        await runtimeAdapter.run('import main')
                    }
                } catch (e) {
                    // fallback: run nothing
                }
            }

            const duration = Date.now() - start
            return { id: test.id, passed: true, stdout: stdoutBuf.join(''), stderr: stderrBuf.join(''), durationMs: duration }
        } catch (err) {
            const duration = Date.now() - start
            return { id: test.id, passed: false, stdout: stdoutBuf.join(''), stderr: (stderrBuf.join('') + '\n' + String(err)), durationMs: duration, reason: String(err) }
        }
    }

    window.addEventListener('message', async (ev) => {
        // Accept only same-origin parent messages when possible
        try { if (ev?.source !== window.parent) return } catch (e) { }
        const msg = ev.data || {}
        try {
            if (msg.type === 'init') {
                const ok = await initRuntime(msg.runtimeUrl || '/vendor/micropython.mjs')
                if (ok) post({ type: 'ready' })
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
                    pendingStdinResolve = null
                }
            } else if (msg.type === 'terminate') {
                // destroy runtime quickly by reloading iframe
                try { post({ type: 'debug', text: 'terminate received' }) } catch (e) { }
                // best-effort: attempt interrupt
                try { if (runtimeAdapter && runtimeAdapter.interruptExecution) runtimeAdapter.interruptExecution() } catch (e) { }
            }
        } catch (err) {
            post({ type: 'error', error: String(err) })
        }
    })

    // Notify parent that the runner script loaded and is listening (parent still needs to send init)
    post({ type: 'loaded' })
