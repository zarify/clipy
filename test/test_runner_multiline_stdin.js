const assert = require('assert')
const { loadRunner } = require('./runner_process_wrapper')

async function run() {
    const { window } = await loadRunner()

    // Capture posts from runner to parent
    let messages = []
    window.parent.postMessage = (m) => {
        messages.push(m)
    }

    // Helper to deliver messages to runner
    const postToRunner = async (m) => {
        const ev = { data: m, source: window.parent }
        try {
            const listeners = (window.__listeners && window.__listeners.message) || []
            for (const fn of listeners) {
                try { await fn(ev) } catch (_e) { }
            }
        } catch (_e) { }
        try { if (typeof window.onmessage === 'function') await window.onmessage(ev) } catch (_e) { }
    }

    // Wait a moment for runner to post loaded
    await new Promise(r => setTimeout(r, 20))
    if (messages.length === 0 && Array.isArray(window.__posted) && window.__posted.length) messages = messages.concat(window.__posted)
    assert(messages.length > 0 && messages[0].type === 'loaded')

    // Define program: two prompts, then uses age
    const main = `name = input("What is your name? ")\nprint(name)\nage = input("How old are you? ")\nprint(age)\n`

    // Provide a multi-line stdin string: name then age separated by newline
    const stdinString = 'Rob\n42'

    // Intercept stdinRequest posts and reply sequentially with parts of stdinString
    let replied = 0
    window.parent.postMessage = (m) => {
        messages.push(m)
        if (m && m.type === 'stdinRequest') {
            const toReply = replied === 0 ? 'Rob' : '42'
            replied++
            setTimeout(() => {
                const ev = { data: { type: 'stdinResponse', value: String(toReply) }, source: window.parent }
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

    // Kick off runner
    await postToRunner({ type: 'init', runtimeUrl: '/vendor/micropython.mjs', files: { '/main.py': main } })
    await new Promise(r => setTimeout(r, 20))
    await postToRunner({ type: 'runTest', test: { id: 'tmulti', main, stdin: stdinString, timeoutMs: 20000 } })

    // Wait for testResult
    await new Promise((resolve, reject) => {
        const start = Date.now()
        const check = () => {
            const tr = messages.find(m => m && m.type === 'testResult')
            if (tr) return resolve(tr)
            if (Date.now() - start > 5000) return reject(new Error('timeout waiting for testResult'))
            setTimeout(check, 20)
        }
        check()
    })

    const tr = messages.find(m => m && m.type === 'testResult')
    assert(tr, 'expected testResult')
    assert(tr.passed === true, 'expected pass')
    const out = tr.stdout || ''

    // The expected combined stdout should contain prompt+input on single lines
    assert(out.indexOf('What is your name? Rob') !== -1, `expected name prompt+input, got: ${out}`)
    assert(out.indexOf('How old are you? 42') !== -1, `expected age prompt+input, got: ${out}`)
    // Program prints name and age directly in this test
    assert(out.indexOf('Rob') !== -1, 'expected printed name')
    assert(out.indexOf('42') !== -1, 'expected printed age')

    console.log('OK')
}

run().catch((e) => { console.error(e); process.exit(1) })
