#!/usr/bin/env node

/**
 * Detailed test for magic numbers detection
 */

import { analyzeCode } from './src/js/ast-analyzer.js';

const testCodeNumbers = `
def test_function():
    # These should be detected as magic numbers (>= 10)
    large_number = 1000  # Magic number
    pi_approx = 3.14159  # Magic number
    answer = 42          # Magic number
    
    # These should NOT be detected (acceptable numbers)
    zero = 0
    one = 1
    minus_one = -1
    two = 2
    ten = 10
    hundred = 100
    
    # Edge case - exactly 10 should not be detected
    exactly_ten = 10
    
    # Small numbers should not be detected
    small = 5
`;

async function testMagicNumbers() {
    console.log('🔢 Testing magic numbers detection in detail...\n');

    try {
        const result = await analyzeCode(testCodeNumbers, 'magic_numbers:10');

        if (result) {
            console.log(`Found ${result.count} magic numbers with threshold ${result.threshold}:`);
            result.magicNumbers.forEach((magic, index) => {
                console.log(`${index + 1}. Value: ${magic.value} at line ${magic.lineno}`);
            });
        } else {
            console.log('No magic numbers found');
        }

        // Test with lower threshold
        console.log('\n--- Testing with threshold 3 ---');
        const result2 = await analyzeCode(testCodeNumbers, 'magic_numbers:3');
        if (result2) {
            console.log(`Found ${result2.count} magic numbers with threshold ${result2.threshold}:`);
            result2.magicNumbers.forEach((magic, index) => {
                console.log(`${index + 1}. Value: ${magic.value} at line ${magic.lineno}`);
            });
        } else {
            console.log('No magic numbers found with threshold 3');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testMagicNumbers();
