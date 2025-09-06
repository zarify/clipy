#!/usr/bin/env node

/**
 * Comprehensive demo of all new AST analyzer features
 */

import { analyzeCode } from './src/js/ast-analyzer.js';

console.log('🎯 Demo: New AST Rule Builder Options\n');

// Demo scenarios for each new feature
const scenarios = [
    {
        name: "Class Analysis Demo",
        code: `
class MathUtils:
    """Utility class for mathematical operations."""
    
    def __init__(self):
        self.operations = 0
    
    def add(self, a, b):
        self.operations += 1
        return a + b
    
    def multiply(self, x, y, z=1):
        """Multiply numbers with optional third parameter."""
        self.operations += 1
        return x * y * z
    
    def _private_method(self):
        pass
        
    def __str__(self):
        return f"MathUtils({self.operations} operations)"
`,
        expression: 'class_analysis:*',
        matcher: 'result && result.classes.some(c => c.name === "MathUtils" && c.methods.length >= 4)',
        expectedResult: 'Should find MathUtils class with 5 methods'
    },

    {
        name: "Import Statements Demo",
        code: `
import os
import sys
from pathlib import Path
from collections import defaultdict, Counter
import numpy as np
from sklearn.model_selection import train_test_split

def process_data():
    pass
`,
        expression: 'import_statements:*',
        matcher: 'result && result.count >= 6 && result.imports.some(i => i.module === "numpy")',
        expectedResult: 'Should find 6+ imports including numpy'
    },

    {
        name: "Magic Numbers Demo",
        code: `
def analyze_performance():
    # Magic numbers that should be constants
    max_retries = 3
    timeout_seconds = 30
    buffer_size = 8192
    pi_approx = 3.14159
    
    # Acceptable numbers (not magic)
    start = 0
    increment = 1
    default_size = 100
    
    return buffer_size * timeout_seconds
`,
        expression: 'magic_numbers:10',
        matcher: 'result && result.magicNumbers.length >= 2',
        expectedResult: 'Should find magic numbers 8192 and 3.14159 (but not 30, which is < threshold)'
    },

    {
        name: "Exception Handling Demo",
        code: `
def robust_file_processing(filename):
    try:
        with open(filename, 'r') as f:
            data = f.read()
        try:
            result = process_data(data)
            return result
        except ValueError as ve:
            print(f"Data processing error: {ve}")
            return None
    except FileNotFoundError:
        print(f"File {filename} not found")
        return None
    except PermissionError:
        print("Permission denied")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
    finally:
        print("Cleanup completed")

def process_data(data):
    # This could be within a try block when called
    return data.upper()
`,
        expression: 'exception_handling:*',
        matcher: 'result && result.tryCount >= 2 && result.handlerCount >= 4',
        expectedResult: 'Should find 2 try blocks and 4+ exception handlers'
    }
];

async function runDemo() {
    for (const [index, scenario] of scenarios.entries()) {
        console.log(`${index + 1}️⃣ ${scenario.name}`);
        console.log(`Expression: ${scenario.expression}`);
        console.log(`Expected: ${scenario.expectedResult}`);
        console.log();

        try {
            const result = await analyzeCode(scenario.code, scenario.expression);

            if (result) {
                console.log('📊 Analysis Result:');
                console.log(JSON.stringify(result, null, 2));

                // Test the matcher
                const matcher = new Function('result', `return ${scenario.matcher}`);
                const matchResult = matcher(result);
                console.log(`\n🎯 Matcher Test: ${matchResult ? '✅ PASS' : '❌ FAIL'}`);

            } else {
                console.log('❌ No results found');
            }

        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }

        console.log('\n' + '─'.repeat(80) + '\n');
    }

    console.log('🎉 Demo completed! These are the new AST rule building options:');
    console.log('✅ class_analysis - Interrogate classes, methods, and inheritance');
    console.log('✅ import_statements - Check for specific imports or patterns');
    console.log('✅ magic_numbers - Detect hardcoded numbers that should be constants');
    console.log('✅ exception_handling - Analyze try/except blocks and error handling');
}

runDemo().catch(console.error);
