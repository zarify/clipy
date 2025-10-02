// Quick test to check if AST is working or falling back to heuristics

import { getPythonInstrumentor } from './src/js/python-instrumentor.js'
import { getPythonASTAnalyzer } from './src/js/python-ast-analyzer.js'

const code = `import random
random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

const analyzer = getPythonASTAnalyzer()
const instrumentor = getPythonInstrumentor()

async function test() {
    console.log('=== Checking if AST Analysis is Working ===\n')

    // Analyze with AST
    const astSuccess = await analyzer.analyzeSource(code, null)
    console.log('AST Analysis returned:', astSuccess)
    console.log('Variables found by AST:', analyzer.lineVariableMap.size > 0 ? 'YES' : 'NO')

    if (analyzer.lineVariableMap.size > 0) {
        console.log('AST found variables on lines:', Array.from(analyzer.lineVariableMap.keys()))
        let totalVars = new Set()
        for (const [lineNum, info] of analyzer.lineVariableMap) {
            for (const v of info.defined) totalVars.add(v)
            for (const v of info.used) totalVars.add(v)
        }
        console.log('Total unique variables from AST:', totalVars.size, '-', Array.from(totalVars))
    }

    console.log('\n=== Instrumenting Code ===\n')

    // Instrument the code (this will show console warnings if heuristics are used)
    const result = await instrumentor.instrumentCode(code, null)

    console.log('\n=== Result ===')
    console.log('Check console output above for:')
    console.log('  - "🔍 HEURISTIC EXTRACTION ACTIVE" = AST failed, using fallback')
    console.log('  - No warning = AST is working!')
}

test().catch(console.error)
