import { runTests } from '../src/js/test-runner.js'
import { analyzeCode } from '../src/js/ast-analyzer.js'

const code = "print(f\"Hello {input('What is your name? ')}!\")"

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

const runFn = async (t) => {
    try {
        const result = await analyzeCode(code, t.astRule.expression)
        let passed = false
        if (t.astRule && t.astRule.matcher) {
            try {
                const evaluateMatch = new Function('result', `try { return ${t.astRule.matcher} } catch (e) { return false }`)
                passed = !!evaluateMatch(result)
            } catch (_e) { passed = false }
        } else {
            passed = !!result
        }
        return { stdout: JSON.stringify(result || null), stderr: '', durationMs: 0, astPassed: passed, astResult: result }
    } catch (e) {
        return { stdout: '', stderr: String(e || ''), durationMs: 0, astPassed: false }
    }
}

(async () => {
    const results = await runTests(tests, { runFn })
    console.log(JSON.stringify(results, null, 2))
})()
