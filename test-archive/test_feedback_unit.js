const assert = require('assert')
const Feedback = require('../src/js/feedback')

function run() {
    // 1) filename-array handling for run-time filename target
    const cfgA = {
        feedback: [
            { id: 'fa', title: 'file-match', when: ['run'], pattern: { type: 'regex', target: 'filename', expression: '^/main.py$', flags: '' }, message: 'matched' }
        ]
    }
    Feedback.resetFeedback(cfgA)
    const rA = Feedback.evaluateFeedbackOnRun({ filename: ['/main.py', '/other.py'] })
    assert(Array.isArray(rA) && rA.length === 1, 'expected one filename match')
    assert(rA[0].filename === '/main.py')

    // 2) message formatting with capture groups
    const cfgB = {
        feedback: [
            { id: 'fb', title: 'stdout-capture', when: ['run'], pattern: { type: 'regex', target: 'stdout', expression: 'ERROR:(.*)', flags: '' }, message: 'found $1' }
        ]
    }
    Feedback.resetFeedback(cfgB)
    const rB = Feedback.evaluateFeedbackOnRun({ stdout: 'OK\nERROR: something bad\n' })
    assert(rB.length === 1 && rB[0].id === 'fb', 'expected stdout match')
    assert(rB[0].message === 'found  something bad', 'message template should inject capture group')

    // 3) event emission: ensure 'matches' is emitted with combined matches
    let seen = null
    const handler = (m) => { seen = m }
    Feedback.on('matches', handler)
    const cfgC = {
        feedback: [
            { id: 'e1', title: 'edit-rule', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: 'TODO', flags: '' }, message: 'todo found' },
            { id: 'r1', title: 'run-rule', when: ['run'], pattern: { type: 'regex', target: 'stdout', expression: 'ALERT', flags: '' }, message: 'alert' }
        ]
    }
    Feedback.resetFeedback(cfgC)
    const em1 = Feedback.evaluateFeedbackOnEdit('line1\n// TODO: fix\n', '/main.py')
    // em1 should have the edit match
    assert(Array.isArray(em1) && em1.length === 1 && em1[0].id === 'e1')
    const em2 = Feedback.evaluateFeedbackOnRun({ stdout: 'OK\nALERT now\n', filename: '/main.py' })
    // Now seen should have combined matches
    assert(Array.isArray(seen), 'matches event should have fired')
    const ids = seen.map(x => x.id).sort()
    assert(ids.includes('e1') && ids.includes('r1'))
    Feedback.off('matches', handler)

    console.log('OK')
}

run()
