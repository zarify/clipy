#!/usr/bin/env node

/**
 * Simple test for new AST analyzer features
 * Run with: node test_ast_new_features.js
 */

import { analyzeCode } from './src/js/ast-analyzer.js';

// Test sample code that includes all the new features
const testCode = `
import numpy as np
from math import sqrt, pi
import sys

class Calculator:
    """A simple calculator class."""
    
    def __init__(self, precision=2):
        self.precision = precision
        self.history = []
    
    def calculate_average(self, numbers):
        """Calculate the average of a list of numbers."""
        try:
            if not numbers:
                return 0
            total = sum(numbers)
            count = len(numbers)
            # Magic numbers that should be constants
            if count > 1000:  # Magic number!
                print("Large dataset")
            result = total / count
            self.history.append(result)
            return round(result, self.precision)
        except ZeroDivisionError:
            return 0
        except Exception as e:
            print(f"Error: {e}")
            return None
    
    def get_stats(self):
        if not self.history:
            return {"count": 0}
        return {
            "count": len(self.history), 
            "max": max(self.history),
            "min": min(self.history)
        }

def helper_function():
    magic_value = 42  # Another magic number
    return magic_value * 3.14159  # And another one
`;

async function runTests() {
    console.log('🧪 Testing new AST analyzer features...\n');

    try {
        // Test 1: Class Analysis
        console.log('1️⃣ Testing class analysis...');
        const classResult = await analyzeCode(testCode, 'class_analysis:Calculator');
        if (classResult) {
            console.log('✅ Class analysis working!');
            console.log(`   - Found class: ${classResult.name}`);
            console.log(`   - Methods: ${classResult.methods.length}`);
            console.log(`   - Method names: ${classResult.methods.map(m => m.name).join(', ')}`);
            console.log(`   - Has docstring: ${classResult.hasDocstring}`);
        } else {
            console.log('❌ Class analysis failed');
        }
        console.log();

        // Test 2: Import Analysis
        console.log('2️⃣ Testing import analysis...');
        const importResult = await analyzeCode(testCode, 'import_statements:*');
        if (importResult) {
            console.log('✅ Import analysis working!');
            console.log(`   - Found ${importResult.count} import statements`);
            importResult.imports.forEach(imp => {
                if (imp.type === 'import') {
                    console.log(`   - import ${imp.module}${imp.alias ? ' as ' + imp.alias : ''}`);
                } else {
                    console.log(`   - from ${imp.module} import ${imp.name}${imp.alias ? ' as ' + imp.alias : ''}`);
                }
            });
        } else {
            console.log('❌ Import analysis failed');
        }
        console.log();

        // Test 3: Magic Numbers
        console.log('3️⃣ Testing magic numbers detection...');
        const magicResult = await analyzeCode(testCode, 'magic_numbers:10');
        if (magicResult) {
            console.log('✅ Magic numbers detection working!');
            console.log(`   - Found ${magicResult.count} magic numbers`);
            magicResult.magicNumbers.forEach(magic => {
                console.log(`   - Magic number ${magic.value} at line ${magic.lineno}`);
            });
        } else {
            console.log('❌ Magic numbers detection failed');
        }
        console.log();

        // Test 4: Exception Handling
        console.log('4️⃣ Testing exception handling analysis...');
        const exceptionResult = await analyzeCode(testCode, 'exception_handling:*');
        if (exceptionResult) {
            console.log('✅ Exception handling analysis working!');
            console.log(`   - Found ${exceptionResult.tryCount} try blocks`);
            console.log(`   - Found ${exceptionResult.handlerCount} exception handlers`);
            exceptionResult.exceptHandlers.forEach(handler => {
                console.log(`   - Handler for ${handler.exceptionType} at line ${handler.lineno}`);
            });
        } else {
            console.log('❌ Exception handling analysis failed');
        }
        console.log();

        // Test 5: Test matchers
        console.log('5️⃣ Testing matcher expressions...');

        // Test class matcher
        const classMatcher = new Function('result', 'return result && result.name === "Calculator" && result.methods.length > 0');
        const classMatch = classMatcher(classResult);
        console.log(`   - Class matcher result: ${classMatch ? '✅' : '❌'}`);

        // Test import matcher
        const importMatcher = new Function('result', 'return result && result.imports.some(i => i.module && i.module.includes("numpy"))');
        const importMatch = importMatcher(importResult);
        console.log(`   - Import matcher result: ${importMatch ? '✅' : '❌'}`);

        // Test magic numbers matcher
        const magicMatcher = new Function('result', 'return result && result.magicNumbers.length > 0');
        const magicMatch = magicMatcher(magicResult);
        console.log(`   - Magic numbers matcher result: ${magicMatch ? '✅' : '❌'}`);

        console.log('\n🎉 All tests completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the tests
runTests().catch(console.error);
