// Simple test to understand instrumentation behavior

const sourceCode = `import random

random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

// Manually apply the isExecutableLine logic
function isExecutableLine(line) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '') return false
    if (trimmed.startsWith('#')) return false

    // Skip control flow keywords that don't execute immediately
    const skipKeywords = ['def ', 'class ', 'if ', 'elif ', 'else:', 'try:', 'except:', 'finally:', 'with ', 'for ', 'while ']
    for (const keyword of skipKeywords) {
        if (trimmed.startsWith(keyword)) return false
    }

    // Include assignment statements (this is the key fix for input() assignments)
    const includePatterns = [
        /^\w+\s*=.*/, // assignment statements (including name = input(...))
        /^print\s*\(/, // print calls  
        /^\w+\(/, // function calls
        /^return\s+/, // return statements
        /^import\s+/, // import statements
        /^from\s+.*import/, // from...import statements
    ]

    for (const pattern of includePatterns) {
        if (pattern.test(trimmed)) return true
    }

    // If it's not a skip keyword and looks like an expression, include it
    return trimmed.length > 0 && !trimmed.endsWith(':')
}

console.log('=== LINE ANALYSIS ===')
const lines = sourceCode.split('\n')
lines.forEach((line, idx) => {
    const result = isExecutableLine(line)
    console.log(`Line ${idx + 1}: ${result ? 'TRACE' : 'SKIP '} - "${line}"`)
})
