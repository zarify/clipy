// Debug test to see what's failing
import { getPythonInstrumentor } from './src/js/python-instrumentor.js'
import { getPythonASTAnalyzer } from './src/js/python-ast-analyzer.js'

const sourceCode = `import random

random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

async function test() {
    try {
        const instrumentor = getPythonInstrumentor()
        const astAnalyzer = getPythonASTAnalyzer()

        console.log('Step 1: Analyzing AST...')
        const astResult = await astAnalyzer.analyzeSource(sourceCode, null)
        console.log('AST analysis result:', astResult)

        console.log('\nStep 2: Instrumenting code...')
        const result = await instrumentor.instrumentCode(sourceCode, null)
        console.log('Instrumentation result type:', typeof result)
        console.log('Is object?', typeof result === 'object')
        console.log('Has code property?', result && typeof result === 'object' && 'code' in result)

        if (result && typeof result === 'object' && result.code) {
            console.log('\n✓ Instrumentation succeeded!')
            console.log('Code length:', result.code.length)
        } else if (typeof result === 'string') {
            console.log('\n✗ Instrumentation returned original code (error occurred)')
            console.log('Returned string length:', result.length)
        } else {
            console.log('\n✗ Unexpected result:', result)
        }
    } catch (error) {
        console.error('Error during test:', error)
        console.error('Stack:', error.stack)
    }
}

test()
