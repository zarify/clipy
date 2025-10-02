// Test instrumentation to verify function body lines are being traced
import { PythonInstrumentor } from './src/js/python-instrumentor.js'

const sourceCode = `import random

random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

const instrumentor = new PythonInstrumentor()

async function test() {
    const result = await instrumentor.instrumentCode(sourceCode)
    console.log('=== INSTRUMENTED CODE ===')
    console.log(result.code)
    console.log('=== END ===')

    // Analyze which lines get instrumented
    const lines = result.code.split('\n')
    console.log('\n=== LINE ANALYSIS ===')
    lines.forEach((line, idx) => {
        if (line.includes('_trace_execution(')) {
            const match = line.match(/_trace_execution\((\d+)/)
            if (match) {
                console.log(`Line ${idx + 1} traces original line ${match[1]}: ${lines[idx - 1].trim()}`)
            }
        }
    })
}

test()
