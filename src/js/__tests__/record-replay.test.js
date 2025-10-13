// Tests for execution recording and replay system
import { ExecutionRecorder, ExecutionTrace, ExecutionStep, VariableStateCapture } from '../execution-recorder.js'
import { ReplayEngine, ReplayLineDecorator } from '../replay-ui.js'

describe('Execution Recording System', () => {
    let recorder

    beforeEach(() => {
        recorder = new ExecutionRecorder()

        // Ensure performance.now is available for testing
        if (!global.performance) {
            global.performance = { now: () => Date.now() }
        }

        // Mock appendTerminalDebug (already provided by jest.setup.js)
        global.appendTerminalDebug = () => { }
    })

    afterEach(() => {
        recorder.clearRecording()
    })

    describe('ExecutionTrace', () => {
        test('should create empty trace', () => {
            const trace = new ExecutionTrace()
            expect(trace.getStepCount()).toBe(0)
            expect(trace.steps).toEqual([])
            expect(trace.metadata).toBeDefined()
        })

        test('should add steps', () => {
            const trace = new ExecutionTrace()
            const step = new ExecutionStep(1, new Map([['x', 5]]))

            trace.addStep(step)
            expect(trace.getStepCount()).toBe(1)
            expect(trace.getStep(0)).toBe(step)
        })

        test('should manage metadata', () => {
            const trace = new ExecutionTrace()
            trace.setMetadata('sourceCode', 'x = 5')
            expect(trace.getMetadata('sourceCode')).toBe('x = 5')
        })
    })

    describe('ExecutionStep', () => {
        test('should create step with defaults', () => {
            const step = new ExecutionStep(5)
            expect(step.lineNumber).toBe(5)
            expect(step.variables).toBeInstanceOf(Map)
            expect(step.scope).toBe('global')
            expect(step.executionType).toBe('line')
            expect(step.timestamp).toBeDefined()
        })

        test('should create step with variables', () => {
            const variables = new Map([['x', 5], ['y', 'hello']])
            const step = new ExecutionStep(3, variables, 'function:main')

            expect(step.lineNumber).toBe(3)
            expect(step.variables.get('x')).toBe(5)
            expect(step.variables.get('y')).toBe('hello')
            expect(step.scope).toBe('function:main')
        })
    })

    describe('VariableStateCapture', () => {
        test('should simplify primitive values', () => {
            expect(VariableStateCapture.simplifyValue(42)).toBe(42)
            expect(VariableStateCapture.simplifyValue(true)).toBe(true)
            expect(VariableStateCapture.simplifyValue('hello')).toBe('hello')
            expect(VariableStateCapture.simplifyValue(null)).toBe(null)
            expect(VariableStateCapture.simplifyValue(undefined)).toBe(undefined)
        })

        test('should truncate long strings', () => {
            const longString = 'a'.repeat(300)
            const result = VariableStateCapture.simplifyValue(longString)
            expect(result).toHaveLength(200)
            expect(result).toMatch(/\.\.\.$/)
        })

        test('should simplify arrays', () => {
            expect(VariableStateCapture.simplifyValue([1, 2, 3])).toEqual([1, 2, 3])
            expect(VariableStateCapture.simplifyValue([])).toEqual([])

            // Test array truncation
            const longArray = Array(15).fill(1)
            const result = VariableStateCapture.simplifyValue(longArray)
            expect(result).toHaveLength(11) // 10 items + ellipsis message
            expect(result[10]).toMatch(/more items/)
        })

        test('should simplify objects', () => {
            const obj = { x: 1, y: 'hello' }
            expect(VariableStateCapture.simplifyValue(obj)).toEqual({ x: 1, y: 'hello' })

            // Test object truncation
            const largeObj = {}
            for (let i = 0; i < 15; i++) {
                largeObj[`key${i}`] = i
            }
            const result = VariableStateCapture.simplifyValue(largeObj)
            expect(Object.keys(result)).toHaveLength(11) // 10 keys + ellipsis
            expect(result['...']).toMatch(/more keys/)
        })

        test('should respect depth limits', () => {
            const nested = { a: { b: { c: { d: 'deep' } } } }
            const result = VariableStateCapture.simplifyValue(nested, 2)
            expect(result.a.b).toMatch(/depth limit/)
        })
    })

    describe('ExecutionRecorder', () => {
        test('should support basic recording lifecycle', () => {
            expect(recorder.isCurrentlyRecording()).toBe(false)
            expect(recorder.hasActiveRecording()).toBe(false)

            recorder.startRecording('x = 5')
            expect(recorder.isCurrentlyRecording()).toBe(true)

            recorder.recordStep(1, new Map([['x', 5]]))
            expect(recorder.hasActiveRecording()).toBe(true)

            recorder.stopRecording()
            expect(recorder.isCurrentlyRecording()).toBe(false)
            expect(recorder.hasActiveRecording()).toBe(true)

            const trace = recorder.getTrace()
            expect(trace.getStepCount()).toBe(1)
        })

        test('should respect recording limits', () => {
            recorder.setConfig({ maxSteps: 3 })
            recorder.startRecording('code')

            recorder.recordStep(1)
            recorder.recordStep(2)
            recorder.recordStep(3)
            recorder.recordStep(4) // Should be ignored due to limit

            const trace = recorder.getTrace()
            expect(trace.getStepCount()).toBe(3)
            expect(recorder.isCurrentlyRecording()).toBe(false) // Should auto-stop
        })

        test('should provide execution hooks', () => {
            recorder.startRecording('code')
            const hooks = recorder.getExecutionHooks()

            expect(hooks).toBeDefined()
            expect(typeof hooks.onExecutionStep).toBe('function')
            expect(typeof hooks.onExecutionComplete).toBe('function')
            expect(typeof hooks.onExecutionError).toBe('function')
        })

        test('should handle invalidation', () => {
            recorder.startRecording('code')
            recorder.recordStep(1)
            expect(recorder.hasActiveRecording()).toBe(true)

            recorder.invalidateRecording()
            expect(recorder.hasActiveRecording()).toBe(false)
        })
    })
})

describe('Replay System', () => {
    let replayEngine
    let mockCodeMirror

    beforeEach(() => {
        replayEngine = new ReplayEngine()

        // Mock CodeMirror
        mockCodeMirror = {
            addLineWidget: () => ({}),
            addLineClass: () => { },
            removeLineClass: () => { },
            charCoords: () => ({ top: 100, left: 0 }),
            scrollIntoView: () => { },
            getWrapperElement: () => ({
                classList: {
                    add: () => { },
                    remove: () => { }
                }
            })
        }

        global.window = global.window || {}
        global.window.cm = mockCodeMirror
        if (!global.document) {
            global.document = {
                getElementById: (id) => {
                    if (id === 'replay-controls') return { style: {} }
                    if (id.includes('replay-')) return { disabled: false, value: 0 }
                    return null
                }
            }
        }

        global.appendTerminalDebug = () => { }
    })

    describe('ReplayEngine', () => {
        test('should start replay with valid trace', async () => {
            const trace = new ExecutionTrace()
            trace.addStep(new ExecutionStep(1, new Map([['x', 5]])))
            trace.addStep(new ExecutionStep(2, new Map([['y', 10]])))

            const result = await replayEngine.startReplay(trace)
            expect(result).toBe(true)
            expect(replayEngine.isReplaying).toBe(true)
            expect(replayEngine.currentStepIndex).toBe(0)
        })

        test('should preserve original trace and filter RETURN events', async () => {
            const trace = new ExecutionTrace()
            // Simulate a LINE event
            const lineStep = new ExecutionStep(1, new Map())
            lineStep.executionType = 'line'
            lineStep.filename = '<stdin>'
            trace.addStep(lineStep)

            // Simulate a RETURN event for the same line
            const returnStep = new ExecutionStep(1, new Map())
            returnStep.executionType = 'return'
            returnStep.filename = '<stdin>'
            trace.addStep(returnStep)

            // Provide sourceCode metadata to avoid async analyzer interference
            trace.metadata = trace.metadata || {}
            trace.metadata.sourceCode = 'print("Hello")'

            const result = await replayEngine.startReplay(trace)
            expect(result).toBe(true)
            // originalTrace should be the unfiltered trace with 2 steps
            expect(replayEngine.originalTrace).toBe(trace)
            expect(replayEngine.originalTrace.getStepCount()).toBe(2)
            // executionTrace should have RETURN events filtered out (1 step)
            expect(replayEngine.executionTrace.getStepCount()).toBe(1)
        })

        test('should not start replay with empty trace', async () => {
            const trace = new ExecutionTrace()
            const result = await replayEngine.startReplay(trace)
            expect(result).toBe(false)
            expect(replayEngine.isReplaying).toBe(false)
        })
    })
})