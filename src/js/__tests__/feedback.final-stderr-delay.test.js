import { jest } from '@jest/globals'
import { setupTerminalDOM, setRuntimeAdapter, setFileManager, setMAIN_FILE } from './test-utils/test-setup.js'

// Simulate a delayed replaceBufferedStderr/terminal publishing to ensure
// runPythonCode's bounded await picks up the canonical stderr when it
// arrives shortly after execution completes.

describe('final stderr canonical slot (delayed)', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('delayed terminal publish is observed by feedback via promise handoff', async () => {
        setupTerminalDOM()
        setMAIN_FILE('/main.py')
        setFileManager({ list: () => ['/main.py'] })

        // Adapter that throws a Python-like traceback when run is invoked
        const adapter = {
            run: async (code) => {
                const err = new Error('Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\nValueError: delayed')
                throw err
            }
        }

        await setRuntimeAdapter(adapter)

        // Intercept terminal behaviors by stubbing replaceBufferedStderr to
        // simulate a delayed publish of the canonical final stderr. We'll
        // delay resolving the per-run promise by 40ms which is within the
        // default 80ms window used by runPythonCode.
        let originalTerminal = null
        try {
            originalTerminal = await import('../terminal.js')
        } catch (_e) { /* best-effort */ }

        // Ensure Feedback capture
        let captured = null
        window.Feedback = { evaluateFeedbackOnRun: (payload) => { captured = payload } }

        // Import execution module fresh so it picks up our test DOM and runtime
        const ex = await import('../execution.js')

        // After starting the run, the terminal.replaceBufferedStderr (or
        // appendTerminal path) will be invoked by the mapping flow. We
        // simulate delayed resolution by scheduling a resolver invocation
        // on window.__ssg_final_stderr_resolve (which runPythonCode creates
        // per-run). This mirrors what the real terminal does when it sets
        // the canonical slot.

        // Kick off the run (do not await immediate side-effects)
        const runPromise = ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })

        // Wait a short amount (simulate mapping time) then resolve canonical slot
        await new Promise(r => setTimeout(r, 40))
        try {
            if (window.__ssg_final_stderr_resolve && typeof window.__ssg_final_stderr_resolve === 'function') {
                window.__ssg_final_stderr_resolve('Traceback (most recent call last):\n  File \"/main.py\", line 1, in <module>\nValueError: delayed')
            }
        } catch (_e) { }

        // Await run completion
        await runPromise

        expect(captured).not.toBeNull()
        expect(typeof captured.stderr === 'string').toBeTruthy()
        // canonical slot should have been used and match captured stderr
        expect(window.__ssg_final_stderr && window.__ssg_final_stderr.length).toBeGreaterThan(0)
        expect(captured.stderr).toBe(window.__ssg_final_stderr)
    })
})
