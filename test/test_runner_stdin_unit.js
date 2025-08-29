const assert = require('assert')
const { createRunFn } = require('../src/js/test-runner-adapter')

// Simple in-memory FileManager used for tests
function makeFakeFileManager(initial) {
    const store = Object.assign({}, initial || {})
    return {
        list() { return Object.keys(store).sort() },
        read(p) { const n = p.startsWith('/') ? p : ('/' + p); return store[n] || null },
        write(p, content) { const n = p.startsWith('/') ? p : ('/' + p); store[n] = content; return Promise.resolve() },
        delete(p) { const n = p.startsWith('/') ? p : ('/' + p); delete store[n]; return Promise.resolve() }
    }
}

async function run() {
    // Fake runPythonCode simulates a runtime that asks for input() N times and
    // appends the answers to the terminal output according to simple heuristics.
    const runPythonCode = async (code, cfg) => {
        const outEl = document.getElementById('terminal-output')
        if (!outEl) throw new Error('terminal-output missing')

        const numInputs = (code.match(/input\(/g) || []).length
        const answers = []

        // Ensure a place to record prompts for optional assertion
        global.__ssg_seen_prompts = global.__ssg_seen_prompts || []

        for (let i = 0; i < numInputs; i++) {
            // create pending input expected by adapter feeder
            await new Promise((resolve) => {
                window.__ssg_pending_input = {
                    resolve: (v) => {
                        try { delete window.__ssg_pending_input } catch (_e) { }
                        resolve(v)
                    },
                    promptText: `PROMPT#${i}`
                }
                // record prompt text for inspection
                global.__ssg_seen_prompts.push(window.__ssg_pending_input.promptText)
            }).then(v => answers.push(v || ''))
        }

        // Naive printing heuristics: if code contains 'print(x)' assume single input printed
        let out = ''
        if (/print\(x\)/.test(code)) out = (answers[0] || '')
        else if (/print\(a, b\)/.test(code)) out = ((answers[0] || '') + ' ' + (answers[1] || '')).trim()
        else out = answers.join('\n')

        outEl.textContent = out
        return ''
    }

    const MAIN_FILE = '/main.py'
    const fakeFM = makeFakeFileManager({ [MAIN_FILE]: 'print("hi")' })

    // Minimal DOM stub with a persistent terminal-output object so both
    // the fake runtime and the adapter observe the same textContent.
    const terminalOutput = { textContent: '' }
    global.document = global.document || {}
    global.document.getElementById = (id) => {
        if (id === 'terminal-output') return terminalOutput
        return null
    }

    // Provide a window alias and common ssg globals used by adapter/runtime
    global.window = global.window || global
    try { window.__ssg_last_mapped = '' } catch (_e) { }
    try { window.__ssg_suppress_notifier = false } catch (_e) { }

    // No-op state clearer
    global.clearMicroPythonState = () => true

    const runFn = createRunFn({ getFileManager: () => fakeFM, MAIN_FILE, runPythonCode, getConfig: () => ({}) })

    // 1) Single input as string
    const t1 = { id: 's1', main: 'x = input()\nprint(x)', stdin: 'Alice' }
    const r1 = await runFn(t1)
    console.log('DEBUG run result r1:', JSON.stringify(r1))
    const outEl = document.getElementById('terminal-output')
    console.log('DEBUG terminal-output after r1:', outEl ? JSON.stringify(outEl.textContent) : '<none>')
    assert(r1 && typeof r1.stdout === 'string')
    assert(r1.stdout.trim() === 'Alice', 'expected stdout to equal the provided stdin value')

    // 2) More prompts than provided stdin: second prompt will get empty string
    const t2 = { id: 's2', main: 'a = input()\nb = input()\nprint(a, b)', stdin: 'one' }
    const r2 = await runFn(t2)
    // r2.stdout should include the first provided input
    assert(r2.stdout.indexOf('one') !== -1)

    // 3) Fewer prompts than provided stdin: extra values ignored by runner
    const t3 = { id: 's3', main: 'a = input()\nprint(a)', stdin: ['first', 'extra'] }
    const r3 = await runFn(t3)
    assert(r3.stdout.trim() === 'first')

    // 4) Optional prompt text inspection: ensure prompts were recorded by fake runtime
    // The runPythonCode recorded promptText values in global.__ssg_seen_prompts
    assert(Array.isArray(global.__ssg_seen_prompts))
    assert(global.__ssg_seen_prompts.length >= 1)

    console.log('OK')
}

run()
