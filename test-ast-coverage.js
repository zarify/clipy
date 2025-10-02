// Test to see what AST finds vs what heuristics add

import { getPythonInstrumentor } from './src/js/python-instrumentor.js'
import { getPythonASTAnalyzer } from './src/js/python-ast-analyzer.js'

const code = `import random
random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

const analyzer = getPythonASTAnalyzer()

async function test() {
    console.log('=== What Does AST Find? ===\n')

    await analyzer.analyzeSource(code, null)

    console.log('AST Line Variable Map:')
    for (const [lineNum, info] of analyzer.lineVariableMap) {
        console.log(`  Line ${lineNum}:`)
        console.log(`    Defined: [${Array.from(info.defined).join(', ')}]`)
        console.log(`    Used: [${Array.from(info.used).join(', ')}]`)
    }

    // Collect all variables AST found
    const astVars = new Set()
    for (const [lineNum, info] of analyzer.lineVariableMap) {
        for (const v of info.defined) astVars.add(v)
        for (const v of info.used) astVars.add(v)
    }

    console.log('\nTotal variables AST found:', astVars.size)
    console.log('Variables:', Array.from(astVars))

    console.log('\n=== What Variables Are Actually In The Code? ===')
    console.log('Expected variables:')
    console.log('  - random (imported module)')
    console.log('  - n (function parameter)')
    console.log('  - dice (local variable)')
    console.log('  - i (comprehension loop var - should be filtered)')
    console.log('  - roll (function name)')

    console.log('\n=== Conclusion ===')
    if (astVars.size === 1 && astVars.has('dice')) {
        console.log('✅ AST only finds assignment targets (dice)')
        console.log('⚠️  AST misses: function params (n), imports (random), function names (roll)')
        console.log('➡️  We NEED heuristics to complement AST!')
    } else {
        console.log('AST found more than expected, investigating...')
    }
}

test().catch(console.error)
