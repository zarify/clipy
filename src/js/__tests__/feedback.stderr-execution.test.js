import { jest } from '@jest/globals'
import { setupTerminalDOM, setRuntimeAdapter, setFileManager, setMAIN_FILE } from './test-utils/test-setup.js'

// Focused repro: ensure that runPythonCode triggers Feedback.evaluateFeedbackOnRun
// with a populated `stderr` when the runtime produces a Python traceback.

describe('execution -> feedback stderr integration', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('runPythonCode reports stderr to Feedback when runtime throws traceback', async () => {
        setupTerminalDOM()
        setMAIN_FILE('/main.py')
        setFileManager({ list: () => ['/main.py'] })

        // Adapter that throws a Python-like traceback when run is invoked
        const adapter = {
            run: async (code) => {
                // Simulate a thrown Error whose message includes a Python traceback
                const err = new Error('Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\nNameError: name "foo" is not defined')
                throw err
            }
        }

        await setRuntimeAdapter(adapter)

        // Capture feedback payloads
        let captured = null
        window.Feedback = { evaluateFeedbackOnRun: (payload) => { captured = payload } }

        const ex = await import('../execution.js')
        await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })

        // We expect the feedback system to be called with a non-empty stderr
        expect(captured).not.toBeNull()
        expect(typeof captured.stderr === 'string').toBeTruthy()
        expect(captured.stderr.length).toBeGreaterThan(0)
        // Should include the exception text
        expect(captured.stderr).toMatch(/NameError: name "foo" is not defined|Traceback/)
    })
})
