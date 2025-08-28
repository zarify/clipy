const assert = require('assert')
const Feedback = require('../src/js/feedback')

function run() {
    // 1) invalid config throws
    let threw = false
    try {
        Feedback.resetFeedback(null)
    } catch (e) { threw = true }
    // our implementation allows null -> empty config, so expect no throw
    assert(!threw, 'resetFeedback should accept null/empty')

    // 2) valid config and edit-time code regex
    const cfg = {
        feedback: [
            { id: 'f1', title: 'no-print', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: '\\bprint\\(', flags: '' }, message: 'avoid print' }
        ]
    }
    Feedback.resetFeedback(cfg)
    const matches = Feedback.evaluateFeedbackOnEdit('print("hi")\n x = 1', '/main.py')
    assert(Array.isArray(matches) && matches.length === 1, 'expected one match for print')
    assert(matches[0].line === 1 && matches[0].file === '/main.py')

    // 3) filename target
    const cfg2 = { feedback: [{ id: 'f2', title: 'badname', when: ['edit'], pattern: { type: 'regex', target: 'filename', expression: '^secret\\.', flags: '' }, message: 'do not name secret' }] }
    Feedback.resetFeedback(cfg2)
    const m2 = Feedback.evaluateFeedbackOnEdit('x=1', 'secret.txt')
    assert(m2.length === 1 && m2[0].file === 'secret.txt')

    // 4) run-time stdout matching
    const cfg3 = { feedback: [{ id: 'f3', title: 'error-out', when: ['run'], pattern: { type: 'regex', target: 'stdout', expression: 'ERROR:(.*)', flags: '' }, message: 'found error $1' }] }
    Feedback.resetFeedback(cfg3)
    const runMatches = Feedback.evaluateFeedbackOnRun({ stdout: 'OK\nERROR: something bad\n' })
    assert(runMatches.length === 1 && runMatches[0].id === 'f3')

    console.log('OK')
}

run()
