import { runTests } from '../src/js/test-runner.js'
import { createRunFn } from '../src/js/test-runner-adapter.js'
import { getFileManager, MAIN_FILE } from '../src/js/vfs-client.js'
import { runPythonCode } from '../src/js/execution.js'

// Fake FileManager for Node test: minimal implementation
const fakeFiles = { '/main.py': "print(f\"Hello {input('What is your name? ')}!\")" }
const FileManager = {
    read(p) { return fakeFiles[p] }
}

const runFn = createRunFn({ getFileManager: () => FileManager, MAIN_FILE: '/main.py', runPythonCode, getConfig: () => ({}) })

const tests = [{
    id: 't-ast-1',
    description: 'Should use exactly one variable',
    astRule: {
        type: 'ast',
        target: 'code',
        expression: 'variable_usage',
        matcher: 'result && result.variables.length === 1'
    }
}]

    ; (async () => {
        const results = await runTests(tests, { runFn })
        console.log('RUN_TESTS_RESULT')
        console.log(JSON.stringify(results, null, 2))
    })()
