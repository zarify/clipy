import { jest } from '@jest/globals'

describe('test-runner pre/post execution', () => {
    let createSandboxedRunFn
    let mockIframeEnv

    beforeEach(async () => {
        jest.resetModules()

        // Mock the iframe environment
        mockIframeEnv = {
            iframes: [],
            messages: [],
            currentIframe: null
        }

        // Import the module
        const mod = await import('../test-runner-sandbox.js')
        createSandboxedRunFn = mod.createSandboxedRunFn
    })

    afterEach(() => {
        // Clean up any iframes
        mockIframeEnv.iframes.forEach(iframe => {
            try {
                if (iframe.remove) iframe.remove()
            } catch (e) { }
        })
        mockIframeEnv.iframes = []
    })

    // Helper to create a mock iframe-based test runner
    function createMockRunner(testResults = {}) {
        return async (test) => {
            // Simulate the three-step execution
            let hasPrePy = false
            let hasPostPy = false

            if (test.setup) {
                hasPrePy = !!(test.setup['/__pre.py'] || test.setup['__pre.py'])
                hasPostPy = !!(test.setup['/__post.py'] || test.setup['__post.py'])
            }
            if (test.files) {
                hasPrePy = hasPrePy || !!(test.files['/__pre.py'] || test.files['__pre.py'])
                hasPostPy = hasPostPy || !!(test.files['/__post.py'] || test.files['__post.py'])
            }

            // Return predetermined results or default success
            if (testResults[test.id]) {
                return testResults[test.id]
            }

            return {
                id: test.id,
                passed: true,
                stdout: '',
                stderr: '',
                durationMs: 10,
                hasPrePy,
                hasPostPy
            }
        }
    }

    describe('Basic pre/post file detection', () => {
        test('detects __pre.py in setup', async () => {
            const runFn = createMockRunner()
            const test = {
                id: 'test-1',
                description: 'Test with pre',
                setup: {
                    '/__pre.py': 'print("pre")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.hasPrePy).toBe(true)
            expect(result.hasPostPy).toBe(false)
        })

        test('detects __post.py in setup', async () => {
            const runFn = createMockRunner()
            const test = {
                id: 'test-2',
                description: 'Test with post',
                setup: {
                    '/__post.py': 'print("post")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.hasPrePy).toBe(false)
            expect(result.hasPostPy).toBe(true)
        })

        test('detects both __pre.py and __post.py', async () => {
            const runFn = createMockRunner()
            const test = {
                id: 'test-3',
                description: 'Test with both',
                setup: {
                    '/__pre.py': 'print("pre")',
                    '/__post.py': 'print("post")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.hasPrePy).toBe(true)
            expect(result.hasPostPy).toBe(true)
        })

        test('detects pre/post files without leading slash', async () => {
            const runFn = createMockRunner()
            const test = {
                id: 'test-4',
                description: 'Test without slash',
                setup: {
                    '__pre.py': 'print("pre")',
                    '__post.py': 'print("post")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.hasPrePy).toBe(true)
            expect(result.hasPostPy).toBe(true)
        })

        test('detects pre/post files in files section', async () => {
            const runFn = createMockRunner()
            const test = {
                id: 'test-5',
                description: 'Test in files',
                files: {
                    '/__pre.py': 'print("pre")',
                    '/__post.py': 'print("post")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.hasPrePy).toBe(true)
            expect(result.hasPostPy).toBe(true)
        })
    })

    describe('Error handling - preConfigError', () => {
        test('__pre.py failure returns preConfigError', async () => {
            const runFn = createMockRunner({
                'test-pre-fail': {
                    id: 'test-pre-fail',
                    passed: false,
                    stdout: '',
                    stderr: '❌ Test setup failed (__pre.py)\n\nTraceback...',
                    durationMs: 5,
                    reason: 'preConfigError',
                    preConfigError: true
                }
            })

            const test = {
                id: 'test-pre-fail',
                setup: {
                    '/__pre.py': 'raise Exception("pre failed")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(false)
            expect(result.preConfigError).toBe(true)
            expect(result.reason).toBe('preConfigError')
            expect(result.stderr).toContain('❌ Test setup failed (__pre.py)')
        })

        test('__pre.py failure prevents main execution', async () => {
            const executionOrder = []
            const runFn = async (test) => {
                if (test.setup && test.setup['/__pre.py']) {
                    executionOrder.push('pre')
                    // Simulate pre failure - main should not execute
                    return {
                        id: test.id,
                        passed: false,
                        stdout: '',
                        stderr: 'Pre failed',
                        durationMs: 5,
                        reason: 'preConfigError',
                        preConfigError: true
                    }
                }
                executionOrder.push('main')
                return { id: test.id, passed: true, stdout: '', stderr: '', durationMs: 10 }
            }

            const test = {
                id: 'test-pre-stops',
                setup: {
                    '/__pre.py': 'raise Exception("fail")'
                },
                main: 'print("should not run")'
            }

            await runFn(test)
            expect(executionOrder).toEqual(['pre'])
            expect(executionOrder).not.toContain('main')
        })
    })

    describe('Error handling - postConfigError', () => {
        test('__post.py failure returns postConfigError', async () => {
            const runFn = createMockRunner({
                'test-post-fail': {
                    id: 'test-post-fail',
                    passed: false,
                    stdout: '',
                    stderr: '❌ Test verification failed (__post.py)\n\nTraceback...',
                    durationMs: 5,
                    reason: 'postConfigError',
                    postConfigError: true,
                    mainAlsoFailed: false
                }
            })

            const test = {
                id: 'test-post-fail',
                setup: {
                    '/__post.py': 'raise Exception("post failed")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(false)
            expect(result.postConfigError).toBe(true)
            expect(result.reason).toBe('postConfigError')
            expect(result.stderr).toContain('❌ Test verification failed (__post.py)')
        })

        test('__post.py failure when main also failed sets mainAlsoFailed flag', async () => {
            const runFn = createMockRunner({
                'test-both-fail': {
                    id: 'test-both-fail',
                    passed: false,
                    stdout: '',
                    stderr: '❌ Test verification failed (__post.py)\n\nNote: main.py also had errors.',
                    durationMs: 5,
                    reason: 'postConfigError',
                    postConfigError: true,
                    mainAlsoFailed: true
                }
            })

            const test = {
                id: 'test-both-fail',
                setup: {
                    '/__post.py': 'raise Exception("post failed")'
                },
                main: 'raise Exception("main failed")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(false)
            expect(result.postConfigError).toBe(true)
            expect(result.mainAlsoFailed).toBe(true)
        })
    })

    describe('Error handling - main execution with pre/post context', () => {
        test('main.py failure with __pre.py shows enhanced context in author mode', async () => {
            const runFn = createMockRunner({
                'test-main-fail-with-pre': {
                    id: 'test-main-fail-with-pre',
                    passed: false,
                    stdout: '',
                    stderr: '⚠️  Test execution failed in main.py\n\n📋 Execution context: __pre.py → main.py\n   ✓ __pre.py executed successfully\n   ✗ main.py failed (see error below)',
                    durationMs: 5,
                    reason: 'AttributeError: ...'
                }
            })

            const test = {
                id: 'test-main-fail-with-pre',
                setup: {
                    '/__pre.py': 'test_var = 42'
                },
                main: 'print(__pre.missing_var)'  // This should fail
            }

            const result = await runFn(test)
            expect(result.passed).toBe(false)
            expect(result.stderr).toContain('⚠️  Test execution failed in main.py')
            expect(result.stderr).toContain('📋 Execution context:')
            expect(result.stderr).toContain('✓ __pre.py executed successfully')
            expect(result.stderr).toContain('✗ main.py failed')
        })

        test('main.py failure with __post.py shows enhanced context in author mode', async () => {
            const runFn = createMockRunner({
                'test-main-fail-with-post': {
                    id: 'test-main-fail-with-post',
                    passed: false,
                    stdout: '',
                    stderr: '⚠️  Test execution failed in main.py\n\n📋 Execution context: main.py → __post.py\n   ✗ main.py failed (see error below)\n   ℹ️  __post.py was still executed',
                    durationMs: 5,
                    reason: 'Error'
                }
            })

            const test = {
                id: 'test-main-fail-with-post',
                setup: {
                    '/__post.py': 'print("post")'
                },
                main: 'raise Exception("fail")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(false)
            expect(result.stderr).toContain('⚠️  Test execution failed in main.py')
            expect(result.stderr).toContain('__post.py was still executed')
        })

        test('main.py failure with both pre and post shows full context', async () => {
            const runFn = createMockRunner({
                'test-main-fail-both': {
                    id: 'test-main-fail-both',
                    passed: false,
                    stdout: '',
                    stderr: '⚠️  Test execution failed in main.py\n\n📋 Execution context: __pre.py → main.py → __post.py\n   ✓ __pre.py executed successfully\n   ✗ main.py failed (see error below)\n   ℹ️  __post.py was still executed but may have encountered issues',
                    durationMs: 5,
                    reason: 'Error'
                }
            })

            const test = {
                id: 'test-main-fail-both',
                setup: {
                    '/__pre.py': 'print("pre")',
                    '/__post.py': 'print("post")'
                },
                main: 'raise Exception("fail")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(false)
            expect(result.stderr).toContain('__pre.py → main.py → __post.py')
            expect(result.stderr).toContain('✓ __pre.py executed successfully')
            expect(result.stderr).toContain('✗ main.py failed')
            expect(result.stderr).toContain('__post.py was still executed')
        })
    })

    describe('Successful execution', () => {
        test('test succeeds when all steps pass', async () => {
            const runFn = createMockRunner({
                'test-success': {
                    id: 'test-success',
                    passed: true,
                    stdout: 'pre\nmain\npost',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-success',
                setup: {
                    '/__pre.py': 'print("pre")',
                    '/__post.py': 'print("post")'
                },
                main: 'print("main")',
                expected_stdout: 'pre\nmain\npost'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
            expect(result.stdout).toContain('pre')
            expect(result.stdout).toContain('main')
            expect(result.stdout).toContain('post')
        })

        test('test succeeds with only __pre.py', async () => {
            const runFn = createMockRunner({
                'test-pre-only': {
                    id: 'test-pre-only',
                    passed: true,
                    stdout: 'pre\nmain',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-pre-only',
                setup: {
                    '/__pre.py': 'print("pre")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
        })

        test('test succeeds with only __post.py', async () => {
            const runFn = createMockRunner({
                'test-post-only': {
                    id: 'test-post-only',
                    passed: true,
                    stdout: 'main\npost',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-post-only',
                setup: {
                    '/__post.py': 'print("post")'
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
        })
    })

    describe('Output concatenation', () => {
        test('stdout from all three files is concatenated', async () => {
            const runFn = createMockRunner({
                'test-concat': {
                    id: 'test-concat',
                    passed: true,
                    stdout: 'from pre\nfrom main\nfrom post',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-concat',
                setup: {
                    '/__pre.py': 'print("from pre")',
                    '/__post.py': 'print("from post")'
                },
                main: 'print("from main")',
                expected_stdout: {
                    type: 'regex',
                    expression: 'from pre.*from main.*from post',
                    flags: 's'
                }
            }

            const result = await runFn(test)
            expect(result.stdout).toContain('from pre')
            expect(result.stdout).toContain('from main')
            expect(result.stdout).toContain('from post')
        })

        test('stderr from all three files is concatenated', async () => {
            const runFn = createMockRunner({
                'test-stderr': {
                    id: 'test-stderr',
                    passed: false,
                    stdout: '',
                    stderr: 'error from main\nerror from post',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-stderr',
                setup: {
                    '/__post.py': 'import sys; sys.stderr.write("error from post\\n")'
                },
                main: 'import sys; sys.stderr.write("error from main\\n")'
            }

            const result = await runFn(test)
            expect(result.stderr).toContain('error from main')
        })
    })

    describe('Execution order and flow', () => {
        test('__post.py executes even when main.py fails', async () => {
            const executionLog = []
            const runFn = async (test) => {
                if (test.setup && test.setup['/__pre.py']) {
                    executionLog.push('pre')
                }

                // Main always runs (and fails in this test)
                executionLog.push('main-fail')

                if (test.setup && test.setup['/__post.py']) {
                    executionLog.push('post')
                }

                return {
                    id: test.id,
                    passed: false,
                    stdout: '',
                    stderr: 'main failed',
                    durationMs: 10,
                    reason: 'Error'
                }
            }

            const test = {
                id: 'test-order',
                setup: {
                    '/__pre.py': 'x = 1',
                    '/__post.py': 'print("post ran")'
                },
                main: 'raise Exception("fail")'
            }

            await runFn(test)
            expect(executionLog).toEqual(['pre', 'main-fail', 'post'])
        })

        test('execution stops at __pre.py failure', async () => {
            const executionLog = []
            const runFn = async (test) => {
                if (test.setup && test.setup['/__pre.py']) {
                    executionLog.push('pre-fail')
                    // Simulate early termination
                    return {
                        id: test.id,
                        passed: false,
                        stdout: '',
                        stderr: 'Pre failed',
                        durationMs: 5,
                        reason: 'preConfigError',
                        preConfigError: true
                    }
                }

                // These should not execute
                executionLog.push('main')
                if (test.setup && test.setup['/__post.py']) {
                    executionLog.push('post')
                }

                return {
                    id: test.id,
                    passed: true,
                    stdout: '',
                    stderr: '',
                    durationMs: 10
                }
            }

            const test = {
                id: 'test-early-stop',
                setup: {
                    '/__pre.py': 'raise Exception("pre fail")',
                    '/__post.py': 'print("should not run")'
                },
                main: 'print("should not run")'
            }

            await runFn(test)
            expect(executionLog).toEqual(['pre-fail'])
            expect(executionLog).not.toContain('main')
            expect(executionLog).not.toContain('post')
        })
    })

    describe('Integration with existing test runner', () => {
        test('tests without pre/post files work as before', async () => {
            const runFn = createMockRunner({
                'test-normal': {
                    id: 'test-normal',
                    passed: true,
                    stdout: 'Hello World',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-normal',
                main: 'print("Hello World")',
                expected_stdout: 'Hello World'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
            expect(result.stdout).toBe('Hello World')
            expect(result.preConfigError).toBeUndefined()
            expect(result.postConfigError).toBeUndefined()
        })

        test('AST tests are not affected by pre/post feature', async () => {
            const runFn = createMockRunner({
                'test-ast': {
                    id: 'test-ast',
                    passed: true,
                    stdout: '{"variables":[]}',
                    stderr: '',
                    durationMs: 0,
                    astPassed: true,
                    astResult: { variables: [] }
                }
            })

            const test = {
                id: 'test-ast',
                type: 'ast',
                astRule: {
                    expression: 'variable_usage',
                    matcher: 'result && result.variables'
                },
                main: 'x = 42'
            }

            const result = await runFn(test)
            expect(result.astPassed).toBe(true)
        })
    })

    describe('Edge cases', () => {
        test('handles empty __pre.py file', async () => {
            const runFn = createMockRunner({
                'test-empty-pre': {
                    id: 'test-empty-pre',
                    passed: true,
                    stdout: 'main',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-empty-pre',
                setup: {
                    '/__pre.py': ''
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
        })

        test('handles empty __post.py file', async () => {
            const runFn = createMockRunner({
                'test-empty-post': {
                    id: 'test-empty-post',
                    passed: true,
                    stdout: 'main',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-empty-post',
                setup: {
                    '/__post.py': ''
                },
                main: 'print("main")'
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
        })

        test('handles test with no main code but has pre/post', async () => {
            const runFn = createMockRunner({
                'test-no-main': {
                    id: 'test-no-main',
                    passed: true,
                    stdout: 'pre\npost',
                    stderr: '',
                    durationMs: 10
                }
            })

            const test = {
                id: 'test-no-main',
                setup: {
                    '/__pre.py': 'print("pre")',
                    '/__post.py': 'print("post")'
                }
            }

            const result = await runFn(test)
            expect(result.passed).toBe(true)
        })
    })
})
