/*
 * Minimal program test runner for Clipy
 * Exports:
 *  - runTests(tests, options)
 *  - matchExpectation(actual, expected) helper
 *
 * Design notes:
 *  - The runner is runtime-agnostic: it accepts an injected `runFn(test)` that
 *    performs the actual program execution and returns a Promise resolving to
 *    { stdout, stderr, filename, durationMs }
 *  - This makes the runner easily unit-testable in Node by providing a fake
 *    runFn.
 */

// Lightweight matcher for expected outputs. `expected` may be:
//  - a string -> we check `actual` includes the string
//  - an object { type: 'regex', expression: '...' } -> RegExp test
//  - a RegExp instance
function matchExpectation(actual, expected) {
    const s = String(actual || '')
    if (expected == null) return { matched: true }
    if (expected instanceof RegExp) {
        return { matched: !!s.match(expected), detail: null }
    }
    if (typeof expected === 'object' && expected.type === 'regex') {
        try {
            const re = new RegExp(expected.expression, expected.flags || '')
            const m = s.match(re)
            return { matched: !!m, detail: m || null }
        } catch (e) {
            return { matched: false, detail: null }
        }
    }
    // string compare - include
    if (typeof expected === 'string') {
        return { matched: s.indexOf(expected) !== -1 }
    }
    return { matched: false }
}

/**
 * Run an array of tests.
 * Each test shape (minimal):
 *  { id, description, stdin, expected_stdout, expected_stderr, timeoutMs, setup }
 * options:
 *  - runFn: async function(test) -> { stdout, stderr, filename, durationMs }
 *  - setupFn: async function(setup) optional
 */
async function runTests(tests, options = {}) {
    if (!Array.isArray(tests)) throw new Error('tests must be an array')
    const runFn = typeof options.runFn === 'function' ? options.runFn : async () => { throw new Error('no runFn provided') }
    const setupFn = typeof options.setupFn === 'function' ? options.setupFn : null

    const results = []
    for (const t of tests) {
        const res = { id: t.id || null, description: t.description || '', passed: false, stdout: null, stderr: null, durationMs: null, reason: null }
        try {
            if (t.setup && setupFn) {
                try { await setupFn(t.setup) } catch (e) { /* continue but record */ res.reason = 'setup_failed' }
            }

            const start = Date.now()
            const runResult = await runFn(t)
            const end = Date.now()
            const duration = typeof runResult.durationMs === 'number' ? runResult.durationMs : (end - start)
            res.durationMs = duration
            res.stdout = runResult.stdout || ''
            res.stderr = runResult.stderr || ''
            res.filename = runResult.filename || null

            // Include the author-provided expected values in the result for
            // easier debugging/diagnostics by the UI or logs.
            try {
                res.expected_stdout = (t && typeof t.expected_stdout !== 'undefined') ? t.expected_stdout : null
                res.expected_stderr = (t && typeof t.expected_stderr !== 'undefined') ? t.expected_stderr : null
            } catch (_e) { res.expected_stdout = null; res.expected_stderr = null }

            // Debug trace: show what we're about to match so UI logs can be used
            // to diagnose surprising pass/fail outcomes.
            try { console.debug && console.debug('[runTests] test', String(t.id || ''), 'stdout(actual):', String(res.stdout).slice(0, 200), 'expected_stdout:', res.expected_stdout) } catch (_e) { }

            // Timeout handling
            if (typeof t.timeoutMs === 'number' && duration > t.timeoutMs) {
                res.passed = false
                res.reason = 'timeout'
                results.push(res)
                continue
            }

            // Check expected_stdout and expected_stderr (both optional)
            let ok = true
            let details = {}
            if (t.expected_stdout != null) {
                const m = matchExpectation(res.stdout, t.expected_stdout)
                if (!m.matched) ok = false
                details.stdout = m.detail || null
            }
            if (t.expected_stderr != null) {
                const m = matchExpectation(res.stderr, t.expected_stderr)
                if (!m.matched) ok = false
                details.stderr = m.detail || null
            }

            res.passed = ok
            if (!ok && !res.reason) res.reason = 'mismatch'
            if (Object.keys(details).length) res.details = details
        } catch (e) {
            res.passed = false
            res.reason = 'error'
            res.error = (e && e.message) ? e.message : String(e)
        }
        results.push(res)
    }
    return results
}

// Expose for Node require and ES imports
if (typeof module !== 'undefined' && module.exports) module.exports = { runTests, matchExpectation }
export { runTests, matchExpectation }
