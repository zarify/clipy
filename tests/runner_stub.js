// Lightweight test runner stub for Playwright: simulates stdin/echo behavior
const post = (o) => { try { console.log('[stub post]', o) } catch (_) { } try { window.parent.postMessage(o, '*') } catch (e) { } }
post({ type: 'loaded' })
post({ type: 'checkpoint', name: 'stub_loaded' })

let pendingResolve = null
const waitForStdin = () => new Promise((res) => { pendingResolve = res })

window.addEventListener('message', async (ev) => {
    const m = ev.data || {}
    if (m.type === 'init') {
        // ignore
        post({ type: 'ready' })
    } else if (m.type === 'runTest') {
        const test = m.test || {}
        const stdinQueue = Array.isArray(test.stdin) ? test.stdin.slice() : []
        const stdout = []
        // simple loop: request stdin N times or until stdinQueue empty
        const count = (stdinQueue.length > 0) ? stdinQueue.length : 10
        for (let i = 0; i < count; i++) {
            post({ type: 'checkpoint', name: 'stub_before_stdinRequest', idx: i })
            post({ type: 'stdinRequest', prompt: '' })
            // wait for response
            const val = await waitForStdin()
            const v = (val == null) ? '' : String(val)
            stdout.push(v)
            post({ type: 'stdout', text: v + '\n' })
        }
        post({ type: 'checkpoint', name: 'stub_about_to_post_testResult' })
        post({ type: 'testResult', id: test.id || 'stub', passed: true, stdout: stdout.join('\n'), stderr: '', durationMs: 1 })
        post({ type: 'checkpoint', name: 'stub_done' })
    } else if (m.type === 'stdinResponse') {
        if (pendingResolve) {
            pendingResolve(m.value || '')
            pendingResolve = null
        }
    }
})
