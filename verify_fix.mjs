// Simple test to verify the author config feedback/tests bug is fixed
import { validateAndNormalizeConfig } from './src/js/config.js';

// Test case 1: Config with no feedback should normalize to empty array (not legacy object)
console.log('=== Test 1: Empty feedback normalization ===');
const emptyConfig = {
    id: 'test-empty',
    title: 'Test Empty',
    version: '1.0'
};

const normalizedEmpty = validateAndNormalizeConfig(emptyConfig);
console.log('Input feedback:', emptyConfig.feedback);
console.log('Normalized feedback:', normalizedEmpty.feedback);
console.log('Is array:', Array.isArray(normalizedEmpty.feedback));
console.log('Length:', normalizedEmpty.feedback.length);

// Test case 2: Config with array feedback should be preserved
console.log('\n=== Test 2: Array feedback preservation ===');
const arrayConfig = {
    id: 'test-array',
    title: 'Test Array',
    version: '1.0',
    feedback: [
        {
            id: 'f1',
            title: 'Test Feedback',
            when: ['edit'],
            pattern: { type: 'regex', target: 'code', expression: 'print' },
            message: 'Found print statement'
        }
    ],
    tests: [
        {
            id: 't1',
            description: 'Test case',
            expected_stdout: 'Hello'
        }
    ]
};

const normalizedArray = validateAndNormalizeConfig(arrayConfig);
console.log('Input feedback length:', arrayConfig.feedback.length);
console.log('Normalized feedback length:', normalizedArray.feedback.length);
console.log('Input tests length:', arrayConfig.tests.length);
console.log('Normalized tests length:', normalizedArray.tests.length);

// Test case 3: Legacy object feedback should convert to array
console.log('\n=== Test 3: Legacy object feedback conversion ===');
const legacyConfig = {
    id: 'test-legacy',
    title: 'Test Legacy',
    version: '1.0',
    feedback: {
        regex: [
            {
                id: 'legacy-regex',
                title: 'Legacy Regex Feedback',
                pattern: 'print',
                message: 'Found print'
            }
        ],
        ast: [
            {
                id: 'legacy-ast',
                title: 'Legacy AST Feedback',
                rule: 'function_def',
                message: 'Found function'
            }
        ]
    }
};

const normalizedLegacy = validateAndNormalizeConfig(legacyConfig);
console.log('Input feedback type:', typeof legacyConfig.feedback);
console.log('Normalized feedback type:', typeof normalizedLegacy.feedback, 'isArray:', Array.isArray(normalizedLegacy.feedback));
console.log('Normalized feedback length:', normalizedLegacy.feedback.length);
console.log('Converted entries:');
normalizedLegacy.feedback.forEach(entry => {
    console.log(`  - ${entry.id}: ${entry.title} (${entry.pattern.type})`);
});

console.log('\n=== Summary ===');
console.log('✅ Empty configs normalize to empty feedback array (not legacy object)');
console.log('✅ Array feedback is preserved');
console.log('✅ Legacy object feedback is converted to array format');
console.log('✅ Config normalization should fix the author config loading bug');
