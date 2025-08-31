// Parent-side helper to create a sandboxed runFn that uses per-test iframes.
export function createSandboxedRunFn({ runtimeUrl = '/vendor/micropython.mjs', filesSnapshot = {}, iframeSrc = '/tests/runner.html', timeoutMsDefault = 20000 } = {}) {
    return function runFn(test) {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            // Allow same-origin so the iframe can load module scripts from the same dev server
            // (this avoids CORS issues when serving with a vanilla static server)
            iframe.sandbox = 'allow-scripts allow-same-origin'
            iframe.src = iframeSrc
            document.body.appendChild(iframe)

            const msgListener = (ev) => {
                try { if (ev.source !== iframe.contentWindow) return } catch (e) { return }
                const m = ev.data || {}
                if (m.type === 'loaded') {
                    // Normalize runtimeUrl: authors may supply the raw .wasm URL
                    // in their config. The iframe runner must import a JS module
                    // (e.g. micropython.mjs) so the module can locate/instantiate
                    // the wasm. Convert *.wasm -> *.mjs when present.
                    let runtimeUrlToSend = runtimeUrl
                    try {
                        if (runtimeUrlToSend && typeof runtimeUrlToSend === 'string' && /\.wasm(\?|$)/i.test(runtimeUrlToSend)) {
                            runtimeUrlToSend = runtimeUrlToSend.replace(/\.wasm(\?|$)/i, '.mjs$1')
                        }
                    } catch (_e) { }

                    // send init with normalized runtime url and snapshot files
                    iframe.contentWindow.postMessage({ type: 'init', runtimeUrl: runtimeUrlToSend, files: filesSnapshot }, '*')
                } else if (m.type === 'ready') {
                    // start the test
                    // remember current test id for streaming messages
                    iframe.__ssg_current_test_id = test && test.id ? test.id : null
                    iframe.contentWindow.postMessage({ type: 'runTest', test }, '*')
                } else if (m.type === 'stdout' || m.type === 'stderr' || m.type === 'debug') {
                    // Stream output into Feedback UI if available
                    try {
                        const tid = iframe.__ssg_current_test_id || (test && test.id)
                        if (typeof window.__ssg_append_test_output === 'function') {
                            window.__ssg_append_test_output({ id: tid, type: m.type, text: m.text })
                        }
                    } catch (e) { }
                    try { console.debug && console.debug('[sandbox] stream', m.type, (m.text || '').slice ? (m.text || '').slice(0, 200) : m.text) } catch (e) { }
                } else if (m.type === 'stdinRequest') {
                    // If the runner provided a prompt string, surface it to the host UI
                    try {
                        const tid = iframe.__ssg_current_test_id || (test && test.id)
                        if (m.prompt && typeof window.__ssg_show_stdin_prompt === 'function') {
                            try { window.__ssg_show_stdin_prompt({ id: tid, prompt: m.prompt }) } catch (e) { }
                        }
                    } catch (e) { }

                    // reply immediately with queued stdin (string or array)
                    let v = ''
                    if (typeof test.stdin === 'string') v = test.stdin
                    else if (Array.isArray(test.stdin)) v = test.stdin.shift() || ''
                    iframe.contentWindow.postMessage({ type: 'stdinResponse', value: String(v) }, '*')
                } else if (m.type === 'testResult') {
                    try { console.debug && console.debug('[sandbox] testResult', m) } catch (e) { }
                    cleanup()
                    resolve(m)
                } else if (m.type === 'error') {
                    try { console.debug && console.debug('[sandbox] error', m) } catch (e) { }
                    cleanup()
                    resolve({ id: test.id, passed: false, stdout: '', stderr: String(m.error), durationMs: 0, reason: m.error })
                }
            }

            const cleanup = () => {
                try { window.removeEventListener('message', msgListener) } catch (e) { }
                try { iframe.remove() } catch (e) { }
            }

            // global timeout guard in parent to ensure recovery
            const watchdog = setTimeout(() => {
                try {
                    iframe.contentWindow.postMessage({ type: 'terminate' }, '*')
                } catch (e) { }
                cleanup()
                resolve({ id: test.id, passed: false, stdout: '', stderr: 'timeout (parent)', durationMs: timeoutMsDefault, reason: 'timeout' })
            }, (test.timeoutMs || timeoutMsDefault) + 500)

            window.addEventListener('message', msgListener)

            // ensure we clean on resolve
            const origResolve = resolve
            resolve = (res) => {
                clearTimeout(watchdog)
                origResolve(res)
            }
        })
    }
}
