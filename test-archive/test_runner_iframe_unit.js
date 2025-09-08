const assert = require('assert')
const { loadRunner } = require('./runner_process_wrapper')

async function run() {
    const { window } = await loadRunner()

    // Capture posts from runner to parent by replacing window.parent.postMessage
    let messages = []
    window.parent.postMessage = (m) => {
        messages.push(m)
    }

    // Emulate parent -> child postMessage by calling the runnable's message listener
    const postToRunner = async (m) => {
        const ev = { data: m, source: window.parent }
        // Call addEventListener listeners
        try {
            const listeners = (window.__listeners && window.__listeners.message) || []
            for (const fn of listeners) {
                try { await fn(ev) } catch (_e) { }
            }
        } catch (_e) { }
        // Call onmessage if set
        try { if (typeof window.onmessage === 'function') await window.onmessage(ev) } catch (_e) { }
    }

    // The runner script posts a loaded message on startup; capture it
    // Wait for the runner to initialize (it posts loaded immediately)
    await new Promise((resolve) => setTimeout(resolve, 20))
    if (messages.length === 0 && Array.isArray(window.__posted) && window.__posted.length) {
        messages = messages.concat(window.__posted)
    }
    assert(messages.length > 0 && messages[0].type === 'loaded')

    // Prepare test with 10 inputs
    const inputs = []
    for (let i = 0; i < 10; i++) inputs.push('w' + i)

    // Intercept runner posts and respond to stdinRequest by consuming inputs
    let stdinIndex = 0
    // replace parent.postMessage to additionally handle stdinRequests by calling back
    window.parent.postMessage = (m) => {
        messages.push(m)
        if (m.type === 'stdinRequest') {
            const v = inputs[stdinIndex++] || ''
            // simulate tiny delay
            setTimeout(() => {
                const ev = { data: { type: 'stdinResponse', value: String(v) }, source: window.parent }
                try {
                    const listeners = (window.__listeners && window.__listeners.message) || []
                    for (const fn of listeners) {
                        try { fn(ev) } catch (_e) { }
                    }
                } catch (_e) { }
                try { if (typeof window.onmessage === 'function') window.onmessage(ev) } catch (_e) { }
            }, 5)
        }
    }

    // Now send init and runTest messages
    await postToRunner({ type: 'init', runtimeUrl: '/vendor/micropython.mjs', files: { '/main.py': '' } })
    await new Promise(r => setTimeout(r, 20))
    await postToRunner({ type: 'runTest', test: { id: 't1', main: 'for i in range(10):\n    word = input()\n    print(word)', stdin: inputs, timeoutMs: 20000 } })

    // Wait for testResult message
    await new Promise((resolve, reject) => {
        const start = Date.now()
        const check = () => {
            const tr = messages.find(m => m.type === 'testResult')
            if (tr) return resolve(tr)
            if (Date.now() - start > 5000) return reject(new Error('timeout waiting for testResult'))
            setTimeout(check, 20)
        }
        check()
    })

    const tr = messages.find(m => m.type === 'testResult')
    assert(tr, 'expected testResult message')
    assert(tr.passed === true, 'expected test to pass')
    const out = tr.stdout || ''
    // Expect each input echoed on its own line
    for (let i = 0; i < 10; i++) {
        assert(out.indexOf('w' + i) !== -1, `expected output to contain w${i}`)
    }

    console.log('OK')
}

run().catch((e) => { console.error(e); process.exit(1) })
