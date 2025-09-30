import { jest } from '@jest/globals'
import { setupTerminalDOM, setRuntimeAdapter, setFileManager, setMAIN_FILE } from './test-utils/test-setup.js'

// Ensure the canonical __ssg_final_stderr slot is set and Feedback uses it

describe('final stderr canonical slot', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('runPythonCode prefers __ssg_final_stderr for feedback', async () => {
        setupTerminalDOM()
        setMAIN_FILE('/main.py')
        setFileManager({ list: () => ['/main.py'] })

        // Adapter that throws a Python-like traceback when run is invoked
        const adapter = {
            run: async (code) => {
                const err = new Error('Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\nValueError: bad')
                throw err
            }
        }

        await setRuntimeAdapter(adapter)

        // Capture feedback payloads
        let captured = null
        window.Feedback = { evaluateFeedbackOnRun: (payload) => { captured = payload } }

        const ex = await import('../execution.js')
        await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })

        expect(captured).not.toBeNull()
        expect(typeof captured.stderr === 'string').toBeTruthy()
        // canonical slot should have been used
        expect(window.__ssg_final_stderr && window.__ssg_final_stderr.length).toBeGreaterThan(0)
        expect(captured.stderr).toBe(window.__ssg_final_stderr)
    })
})
