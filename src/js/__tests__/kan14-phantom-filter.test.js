/**
 * Tests for KAN-14 phantom trace filtering
 * 
 * Tests the client-side filtering logic that removes phantom LINE events
 * caused by MicroPython VM bugs where:
 * 1. Code after break/continue/return is traced even though it never executes
 * 2. Last line in loop body is traced even when conditional is FALSE
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { ExecutionRecorder, ExecutionStep, ExecutionTrace } from '../execution-recorder.js'

describe('KAN-14: Phantom Trace Filtering', () => {
    let recorder

    beforeEach(() => {
        recorder = new ExecutionRecorder()
    })

    describe('Unreachable code after control flow statements', () => {
        it('should skip traces after break statement', () => {
            const sourceCode = `i = 0
while True:
    i += 1
    if i > 3:
        break
        pass
print("OK")`

            recorder.startRecording(sourceCode)

            // Simulate trace events
            recorder.recordStep(1, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 1]]), 'global', 'line', '/main.py')

            // First iteration: i=1, condition false, continues loop
            recorder.recordStep(2, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 2]]), 'global', 'line', '/main.py')

            // Continue until i > 3
            recorder.recordStep(2, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 3]]), 'global', 'line', '/main.py')

            recorder.recordStep(2, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(5, new Map([['i', 4]]), 'global', 'line', '/main.py') // break

            // This should be SKIPPED - phantom trace of 'pass' after break
            recorder.recordStep(6, new Map([['i', 4]]), 'global', 'line', '/main.py')

            recorder.recordStep(7, new Map([['i', 4]]), 'global', 'line', '/main.py') // print

            recorder.stopRecording()

            const trace = recorder.getTrace()
            const steps = []
            for (let i = 0; i < trace.getStepCount(); i++) {
                steps.push(trace.getStep(i))
            }

            // Line 6 (pass after break) should not be in the trace
            const line6Steps = steps.filter(s => s.lineNumber === 6)
            expect(line6Steps.length).toBe(0)
        })

        it('should skip traces after continue statement', () => {
            const sourceCode = `for i in range(3):
    if i == 1:
        continue
        pass
    print(i)`

            recorder.startRecording(sourceCode)

            // i=0
            recorder.recordStep(1, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(5, new Map([['i', 0]]), 'global', 'line', '/main.py')

            // i=1
            recorder.recordStep(1, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 1]]), 'global', 'line', '/main.py') // continue
            // This should be SKIPPED - phantom trace of 'pass' after continue
            recorder.recordStep(4, new Map([['i', 1]]), 'global', 'line', '/main.py')

            // i=2
            recorder.recordStep(1, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(5, new Map([['i', 2]]), 'global', 'line', '/main.py')

            recorder.stopRecording()

            const trace = recorder.getTrace()
            const steps = []
            for (let i = 0; i < trace.getStepCount(); i++) {
                steps.push(trace.getStep(i))
            }

            // Line 4 (pass after continue) should not be in the trace
            const line4Steps = steps.filter(s => s.lineNumber === 4)
            expect(line4Steps.length).toBe(0)
        })

        it('should skip traces after return statement', () => {
            const sourceCode = `def test_func():
    if True:
        return 42
        pass
    print("unreachable")

result = test_func()`

            recorder.startRecording(sourceCode)

            recorder.recordStep(1, new Map(), 'global', 'line', '/main.py')
            recorder.recordStep(7, new Map(), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map(), 'function:test_func', 'line', '/main.py')
            recorder.recordStep(3, new Map(), 'function:test_func', 'line', '/main.py') // return
            // This should be SKIPPED - phantom trace of 'pass' after return
            recorder.recordStep(4, new Map(), 'function:test_func', 'line', '/main.py')

            recorder.stopRecording()

            const trace = recorder.getTrace()
            const steps = []
            for (let i = 0; i < trace.getStepCount(); i++) {
                steps.push(trace.getStep(i))
            }

            // Line 4 (pass after return) should not be in the trace
            const line4Steps = steps.filter(s => s.lineNumber === 4)
            expect(line4Steps.length).toBe(0)
        })
    })

    describe('Phantom conditional traces (main KAN-14 bug)', () => {
        it('should skip phantom traces when condition is FALSE', () => {
            const sourceCode = `for i in range(5):
    if i > 2:
        pass
print("OK")`

            recorder.startRecording(sourceCode)

            // i=0 - condition FALSE, should skip line 3
            recorder.recordStep(1, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 0]]), 'global', 'line', '/main.py') // PHANTOM!

            // i=1 - condition FALSE, should skip line 3
            recorder.recordStep(1, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 1]]), 'global', 'line', '/main.py') // PHANTOM!

            // i=2 - condition FALSE, should skip line 3
            recorder.recordStep(1, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 2]]), 'global', 'line', '/main.py') // PHANTOM!

            // i=3 - condition TRUE, should keep line 3
            recorder.recordStep(1, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 3]]), 'global', 'line', '/main.py') // VALID

            // i=4 - condition TRUE, should keep line 3
            recorder.recordStep(1, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 4]]), 'global', 'line', '/main.py') // VALID

            recorder.recordStep(4, new Map([['i', 4]]), 'global', 'line', '/main.py') // print

            recorder.stopRecording()

            const trace = recorder.getTrace()
            const steps = []
            for (let i = 0; i < trace.getStepCount(); i++) {
                steps.push(trace.getStep(i))
            }

            // Line 3 should only appear when i > 2 (i.e., i=3 and i=4)
            const line3Steps = steps.filter(s => s.lineNumber === 3)

            // Should have exactly 2 valid traces (i=3 and i=4)
            expect(line3Steps.length).toBe(2)

            // Verify these are the correct ones
            expect(line3Steps[0].variables.get('i')).toBe(3)
            expect(line3Steps[1].variables.get('i')).toBe(4)
        })

        it('should handle nested conditionals correctly', () => {
            const sourceCode = `for i in range(5):
    if i > 2:
        if i < 4:
            pass
print("OK")`

            recorder.startRecording(sourceCode)

            // i=0 - outer condition FALSE
            recorder.recordStep(1, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 0]]), 'global', 'line', '/main.py') // PHANTOM!

            // i=1 - outer condition FALSE
            recorder.recordStep(1, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 1]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 1]]), 'global', 'line', '/main.py') // PHANTOM!

            // i=2 - outer condition FALSE
            recorder.recordStep(1, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 2]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 2]]), 'global', 'line', '/main.py') // PHANTOM!

            // i=3 - outer TRUE, inner TRUE - should keep
            recorder.recordStep(1, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 3]]), 'global', 'line', '/main.py') // VALID

            // i=4 - outer TRUE, inner FALSE
            recorder.recordStep(1, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(2, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['i', 4]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['i', 4]]), 'global', 'line', '/main.py') // PHANTOM? (inner false)

            recorder.recordStep(5, new Map([['i', 4]]), 'global', 'line', '/main.py')

            recorder.stopRecording()

            const trace = recorder.getTrace()
            const steps = []
            for (let i = 0; i < trace.getStepCount(); i++) {
                steps.push(trace.getStep(i))
            }

            // Line 4 should only appear when i == 3 (both conditions true)
            const line4Steps = steps.filter(s => s.lineNumber === 4)

            // Should have exactly 1 valid trace (i=3)
            // Note: This test may need adjustment based on how nested conditions are handled
            expect(line4Steps.length).toBeGreaterThan(0)
            expect(line4Steps.length).toBeLessThanOrEqual(1)
        })
    })

    describe('Integration with existing phantom filtering', () => {
        it('should work alongside existing for-loop phantom filtering', () => {
            const sourceCode = `n = 4
for i in range(n):
    if i > 2:
        x = i * 2
print(x)`

            recorder.startRecording(sourceCode)

            recorder.recordStep(1, new Map([['n', 4]]), 'global', 'line', '/main.py')

            // First iteration
            recorder.recordStep(2, new Map([['n', 4], ['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['n', 4], ['i', 0]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['n', 4], ['i', 0]]), 'global', 'line', '/main.py') // PHANTOM

            // More iterations...
            recorder.recordStep(2, new Map([['n', 4], ['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(3, new Map([['n', 4], ['i', 3]]), 'global', 'line', '/main.py')
            recorder.recordStep(4, new Map([['n', 4], ['i', 3], ['x', 6]]), 'global', 'line', '/main.py') // VALID

            recorder.recordStep(5, new Map([['n', 4], ['x', 6]]), 'global', 'line', '/main.py')

            recorder.stopRecording()

            const trace = recorder.getTrace()
            expect(trace.getStepCount()).toBeGreaterThan(0)

            const steps = []
            for (let i = 0; i < trace.getStepCount(); i++) {
                steps.push(trace.getStep(i))
            }

            // Verify phantom traces were filtered
            const line4Steps = steps.filter(s => s.lineNumber === 4)

            // Should only have valid traces (when condition is true)
            for (const step of line4Steps) {
                const i = step.variables.get('i')
                if (i !== undefined) {
                    expect(i).toBeGreaterThan(2)
                }
            }
        })
    })
})
