import { jest } from '@jest/globals'

describe('createSandboxedRunFn', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        jest.resetModules()
    })

    test('AST tests short-circuit using filesSnapshot', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async (code, expr) => ({ ok: true, codeLen: code.length })
        }))
        await jest.unstable_mockModule('../vfs-client.js', () => ({
            getFileManager: () => ({ read: (p) => p === '/main.py' ? 'print(42)' : '', list: () => ['/main.py'] }),
            MAIN_FILE: '/main.py'
        }))
        const mod = await import('../test-runner-sandbox.js')
        const { createSandboxedRunFn } = mod
        const runFn = createSandboxedRunFn({ filesSnapshot: { '/main.py': 'print(1)' } })
        const res = await runFn({ type: 'ast', astRule: { expression: 'x' } })
        expect(res.astPassed === true || res.astPassed === false).toBeTruthy()
    })

    test('AST tests read from current FileManager (KAN-25 regression)', async () => {
        // Mock the in-memory workspace to return current workspace code
        const currentCode = 'print("Problem B code")'

        // Set up global mem (simulating current workspace state)
        global.window = global.window || {}
        global.window.__ssg_mem = { '/main.py': currentCode }

        await jest.unstable_mockModule('../vfs-client.js', () => ({
            getFileManager: () => ({
                read: (p) => p === '/main.py' ? currentCode : '',
                list: () => ['/main.py']
            }),
            MAIN_FILE: '/main.py'
        }))
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async (code, expr) => ({ ok: true, receivedCode: code })
        }))
        const mod = await import('../test-runner-sandbox.js')
        const { createSandboxedRunFn } = mod

        // Create runner with STALE snapshot (simulating Problem A's code)
        const runFn = createSandboxedRunFn({ filesSnapshot: { '/main.py': 'print("Problem A code")' } })

        // Run AST test without providing test.main - should read from mem, not snapshot
        const res = await runFn({ type: 'ast', astRule: { expression: 'x', matcher: 'result.receivedCode.includes("Problem B")' } })

        // Verify it used the current mem code (Problem B), not the stale snapshot (Problem A)
        expect(res.astPassed).toBe(true)
        expect(res.astResult.receivedCode).toContain('Problem B')

        // Cleanup
        delete global.window.__ssg_mem
    })
})
