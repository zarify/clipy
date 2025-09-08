const assert = require('assert')
const { runTests, matchExpectation } = require('../src/js/test-runner')

async function run() {
    // matchExpectation unit checks
    assert(matchExpectation('hello world', 'hello').matched === true)
    assert(matchExpectation('hello world', 'bye').matched === false)
    assert(matchExpectation('ERROR: oops', { type: 'regex', expression: 'ERROR:(.*)' }).matched === true)
    assert(matchExpectation('nope', /nope/).matched === true)

    // runner with fake runFn
    const tests = [
        { id: 't1', description: 'stdout contains OK', expected_stdout: 'OK' },
        { id: 't2', description: 'stderr regex', expected_stderr: { type: 'regex', expression: 'ERR:(.*)' } },
        { id: 't3', description: 'timeout test', expected_stdout: 'x', timeoutMs: 5 }
    ]

    const fakeRunFn = async (t) => {
        if (t.id === 't1') return { stdout: 'OK\n', stderr: '', durationMs: 10 }
        if (t.id === 't2') return { stdout: '', stderr: 'ERR: problem', durationMs: 5 }
        if (t.id === 't3') { await new Promise(r => setTimeout(r, 20)); return { stdout: 'x', stderr: '', durationMs: 20 } }
        return { stdout: '', stderr: '' }
    }

    const results = await runTests(tests, { runFn: fakeRunFn })
    assert(results.length === 3)
    const r1 = results.find(r => r.id === 't1')
    assert(r1.passed === true, 't1 should pass')
    const r2 = results.find(r => r.id === 't2')
    assert(r2.passed === true, 't2 should pass')
    const r3 = results.find(r => r.id === 't3')
    assert(r3.passed === false && r3.reason === 'timeout')

    console.log('OK')
}

run()
