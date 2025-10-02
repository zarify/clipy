// Test to see what variables the AST analyzer finds in the dice example

const sourceCode = `import random
random.seed(42)

def roll(n):
    dice = [random.randint(1, 6) for i in range(n)]
    return dice

print(roll(3))`

// Simulate what variables would be found
const lines = sourceCode.split('\n')
lines.forEach((line, idx) => {
    const lineNo = idx + 1
    console.log(`Line ${lineNo}: ${line}`)
})

// Line 5 is the problem: `dice = [random.randint(1, 6) for i in range(n)]`
// The AST analyzer would find:
// - `dice` (defined)
// - `random` (used)
// - `i` (used in list comprehension)
// - `range` (used)
// - `n` (used)

console.log('\nProblem: Variable `i` is in list comprehension scope, not function scope!')
console.log('When we try to reference `i` after the list comprehension, it does not exist.')
console.log('This could cause the trace capture to fail with NameError.')
