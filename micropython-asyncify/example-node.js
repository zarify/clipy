#!/usr/bin/env node

// Node.js example of using MicroPython with asyncify input()

import { loadMicroPython } from './api.js';

async function nodeExample() {
    console.log('🐍 MicroPython WebAssembly with Asyncify Input - Node.js Example');
    console.log('================================================================\n');

    try {
        // Load MicroPython with asyncify support
        const mp = await loadMicroPython({
            stdout: (text) => process.stdout.write(text),
            stderr: (text) => process.stderr.write(text)
        });

        console.log('✅ MicroPython loaded successfully!\n');

        // Example 1: Simple input
        console.log('Example 1: Simple input() usage');
        console.log('--------------------------------');
        await mp.runPythonAsync(`
print("Enter your information:")
name = input("Name: ")
print(f"Hello, {name}!")
print()
        `);

        // Example 2: Walrus operator (the key feature!)
        console.log('Example 2: Walrus operator with input()');
        console.log('----------------------------------------');
        await mp.runPythonAsync(`
print("Testing walrus operator (this used to break!):")
if age := input("Age (or press Enter to skip): "):
    print(f"You are {age} years old!")
else:
    print("Age not provided")
print()
        `);

        // Example 3: Indented input
        console.log('Example 3: Indented input() calls');
        console.log('----------------------------------');
        await mp.runPythonAsync(`
print("Testing indented input (this also used to break!):")
for i in range(2):
    item = input(f"Enter item {i+1}: ")  # This is indented!
    print(f"  Item {i+1}: {item}")
print()
        `);

        // Example 4: Complex Python without input
        console.log('Example 4: Complex Python features (no input)');
        console.log('----------------------------------------------');
        mp.runPython(`
print("All Python features work normally:")

# List comprehensions
numbers = [x**2 for x in range(5)]
print(f"Squares: {numbers}")

# Functions and classes
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result = calc.add(10, 5)
print(f"10 + 5 = {result}")

# Exception handling
try:
    value = 10 / 2
    print(f"10 / 2 = {value}")
except ZeroDivisionError:
    print("Division by zero!")

print("✅ All features working perfectly!")
        `);

        console.log('\n🎉 All examples completed successfully!');
        console.log('🎯 Key achievements:');
        console.log('  ✅ input() function is fully asyncified');
        console.log('  ✅ Walrus operator works with input()');
        console.log('  ✅ Indented input() calls work');
        console.log('  ✅ No code transformation required');
        console.log('  ✅ All Python syntax preserved');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the example
nodeExample();
