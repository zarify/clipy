/**
 * Test for KAN-10: Loop replay bug showing extra iterations at start
 * This test reproduces the issue where while and for loops show extra iterations
 * at the beginning during replay.
 */

import { ExecutionRecorder, ExecutionTrace, ExecutionStep } from '../execution-recorder.js'
import { appendTerminalDebug } from '../terminal.js'

describe('KAN-10: Loop replay bug', () => {
    let recorder

    beforeEach(() => {
        recorder = new ExecutionRecorder()
        global.appendTerminalDebug = () => { }
    })

    afterEach(() => {
        recorder.clearRecording()
    })

    test('while loop should not show extra iterations at start', () => {
        const whileCode = `i = 0
while i < 3:
    print(i)
    i += 1`

        recorder.startRecording(whileCode)

        // Simulate the trace events that sys.settrace would generate
        // Expected correct sequence:
        // 1. Line 1: i = 0 (assignment)
        // 2. Line 2: while i < 3 (first check, i=0)
        // 3. Line 3: print(i) (i=0)
        // 4. Line 4: i += 1 (i becomes 1)
        // 5. Line 2: while i < 3 (second check, i=1)
        // 6. Line 3: print(i) (i=1)
        // 7. Line 4: i += 1 (i becomes 2)
        // 8. Line 2: while i < 3 (third check, i=2)
        // 9. Line 3: print(i) (i=2)
        // 10. Line 4: i += 1 (i becomes 3)
        // 11. Line 2: while i < 3 (final check, i=3, loop exits)

        // But the bug shows:
        // Line 2 appears twice at the start with i=0 before line 3 executes

        recorder.recordStep(1, new Map([['i', 0]]))  // i = 0
        recorder.recordStep(2, new Map([['i', 0]]))  // while i < 3 (FIRST time - this might be the issue)
        recorder.recordStep(4, new Map([['i', 0]]))  // This is wrong - line 4 before line 3?
        recorder.recordStep(3, new Map([['i', 0]]))  // print(i)
        recorder.recordStep(4, new Map([['i', 1]]))  // i += 1
        recorder.recordStep(3, new Map([['i', 1]]))  // print(i)
        recorder.recordStep(4, new Map([['i', 2]]))  // i += 1
        recorder.recordStep(3, new Map([['i', 2]]))  // print(i)
        recorder.recordStep(4, new Map([['i', 2]]))  // This final one looks wrong too

        recorder.stopRecording()
        const trace = recorder.getTrace()

        // Print out the trace for debugging
        console.log('\nWhile loop trace:')
        for (let i = 0; i < trace.getStepCount(); i++) {
            const step = trace.getStep(i)
            const vars = Array.from(step.variables.entries()).map(([k, v]) => `${k}=${v}`).join(', ')
            console.log(`${i + 1}. Line ${step.lineNumber}: ${vars}`)
        }

        // The trace should NOT have duplicate line 2 entries at the start
        // We expect the sequence to match the actual execution order
    })

    test('for loop should not show extra iterations at start', () => {
        const forCode = `for i in range(3):
    print(i)`

        recorder.startRecording(forCode)

        // Simulate the trace events for a for loop
        // Expected correct sequence:
        // 1. Line 1: for i in range(3) (i=0)
        // 2. Line 2: print(i) (i=0)
        // 3. Line 1: for i in range(3) (i=1)
        // 4. Line 2: print(i) (i=1)
        // 5. Line 1: for i in range(3) (i=2)
        // 6. Line 2: print(i) (i=2)

        // But the bug shows:
        // Line 1: i=0 (extra)
        // Line 2: i=0 (extra)
        // Line 1: i=0 (correct)
        // Line 2: i=0 (correct)
        // ... and so on

        recorder.recordStep(1, new Map([['i', 0]]))  // Extra iteration?
        recorder.recordStep(2, new Map([['i', 0]]))  // Extra iteration?
        recorder.recordStep(1, new Map([['i', 0]]))  // for i in range(3)
        recorder.recordStep(2, new Map([['i', 0]]))  // print(i)
        recorder.recordStep(1, new Map([['i', 1]]))  // for i in range(3)
        recorder.recordStep(2, new Map([['i', 1]]))  // print(i)
        recorder.recordStep(1, new Map([['i', 2]]))  // for i in range(3)
        recorder.recordStep(2, new Map([['i', 2]]))  // print(i)

        recorder.stopRecording()
        const trace = recorder.getTrace()

        // Print out the trace for debugging
        console.log('\nFor loop trace:')
        for (let i = 0; i < trace.getStepCount(); i++) {
            const step = trace.getStep(i)
            const vars = Array.from(step.variables.entries()).map(([k, v]) => `${k}=${v}`).join(', ')
            console.log(`${i + 1}. Line ${step.lineNumber}: ${vars}`)
        }

        // The trace should NOT have duplicate entries at the start
    })
})
