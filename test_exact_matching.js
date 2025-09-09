// Test script to verify exact matching functionality
import { matchExpectation } from './src/js/test-runner.js';

// Test cases for exact matching
console.log('Testing exact matching functionality...');

// Test 1: Exact match should match exactly
const result1 = matchExpectation('hello world', { type: 'exact', expression: 'hello world' });
console.log('Test 1 (exact match - identical):', result1.matched ? 'PASS' : 'FAIL');

// Test 2: Exact match should NOT match if different
const result2 = matchExpectation('hello world!', { type: 'exact', expression: 'hello world' });
console.log('Test 2 (exact mismatch - extra chars):', !result2.matched ? 'PASS' : 'FAIL');

// Test 3: Exact match should NOT match if expected is substring of actual
const result3 = matchExpectation('hello world from python', { type: 'exact', expression: 'hello world' });
console.log('Test 3 (exact mismatch - expected is substring):', !result3.matched ? 'PASS' : 'FAIL');

// Test 4: Exact match should NOT match if actual is substring of expected
const result4 = matchExpectation('hello', { type: 'exact', expression: 'hello world' });
console.log('Test 4 (exact mismatch - actual is substring):', !result4.matched ? 'PASS' : 'FAIL');

// Test 5: String match should still work as contains (backward compatibility)
const result5 = matchExpectation('hello world!', 'world');
console.log('Test 5 (string contains - substring):', result5.matched ? 'PASS' : 'FAIL');

// Test 6: String match should work even if expected is contained in larger output
const result6 = matchExpectation('hello world from python', 'hello world');
console.log('Test 6 (string contains - partial match):', result6.matched ? 'PASS' : 'FAIL');

// Test 7: Regex should still work
const result7 = matchExpectation('hello 123', { type: 'regex', expression: '\\d+', flags: '' });
console.log('Test 7 (regex match):', result7.matched ? 'PASS' : 'FAIL');

// Test 8: Exact match with empty strings
const result8 = matchExpectation('', { type: 'exact', expression: '' });
console.log('Test 8 (exact match - both empty):', result8.matched ? 'PASS' : 'FAIL');

// Test 9: Exact match should handle whitespace exactly
const result9 = matchExpectation('hello world', { type: 'exact', expression: 'hello  world' });
console.log('Test 9 (exact mismatch - whitespace difference):', !result9.matched ? 'PASS' : 'FAIL');

// Test 10: Exact match should handle line endings exactly
const result10 = matchExpectation('hello\nworld', { type: 'exact', expression: 'hello world' });
console.log('Test 10 (exact mismatch - newline vs space):', !result10.matched ? 'PASS' : 'FAIL');

console.log('All tests completed.');
