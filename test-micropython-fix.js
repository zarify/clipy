// Test that instrumentation now explicitly references variables by name
// This should work with MicroPython's limitation that locals() doesn't return function-local variables

import { getPythonInstrumentor } from './src/js/python-instrumentor.js'
import { getPythonASTAnalyzer } from './src/js/python-ast-analyzer.js'

const sourceCode = `import random

random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

async function test() {
    const instrumentor = getPythonInstrumentor()
    const astAnalyzer = getPythonASTAnalyzer()

    // Initialize AST analyzer first
    await astAnalyzer.analyzeSource(sourceCode, null)

    const result = await instrumentor.instrumentCode(sourceCode, null)

    if (!result || !result.code) {
        console.error('ERROR: Instrumentation failed!')
        return
    }

    console.log('=== INSTRUMENTED CODE ===')
    console.log(result.code)
    console.log('\n=== END ===\n')

    // Check that we're explicitly referencing variables by name, not using locals()
    const hasExplicitVarCapture = result.code.includes('try:') &&
        result.code.includes('_trace_vars[') &&
        !result.code.includes('_local_vars = locals()')

    const hasDiceCapture = result.code.includes("_trace_vars['dice']")
    const hasNCapture = result.code.includes("_trace_vars['n']")

    console.log('✓ Verification:')
    console.log(`  - Uses explicit variable capture (not locals()): ${hasExplicitVarCapture ? '✓' : '✗'}`)
    console.log(`  - Captures 'dice' variable: ${hasDiceCapture ? '✓' : '✗'}`)
    console.log(`  - Captures 'n' parameter: ${hasNCapture ? '✓' : '✗'}`)

    if (hasExplicitVarCapture && hasDiceCapture && hasNCapture) {
        console.log('\n✓ SUCCESS: Instrumentation should now work with MicroPython!')
    } else {
        console.log('\n✗ FAILURE: Instrumentation may not work correctly')
    }
}

test().catch(err => {
    console.error('Test failed:', err)
    process.exit(1)
})
