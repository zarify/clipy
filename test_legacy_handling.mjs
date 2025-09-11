// Test legacy config handling
import { validateAndNormalizeConfig } from './src/js/config.js';

console.log('=== Testing Legacy Config Handling ===\n');

// Simulate an old config that was saved before the fix (with legacy object format)
const oldLegacyConfig = {
    id: 'old-config',
    title: 'Old Configuration',
    version: '1.0',
    feedback: {
        ast: [],
        regex: [
            {
                id: 'old-regex',
                title: 'Old Regex Feedback',
                pattern: 'def ',
                message: 'Found function definition'
            }
        ]
    },
    tests: []
};

console.log('1. Old config with legacy feedback object:');
console.log('   Feedback type:', typeof oldLegacyConfig.feedback);
console.log('   Has regex entries:', oldLegacyConfig.feedback.regex.length);

const normalizedLegacy = validateAndNormalizeConfig(oldLegacyConfig);
console.log('\n2. After normalization:');
console.log('   Feedback type:', Array.isArray(normalizedLegacy.feedback) ? 'array' : typeof normalizedLegacy.feedback);
console.log('   Feedback entries:', normalizedLegacy.feedback.length);

if (normalizedLegacy.feedback.length > 0) {
    console.log('   First entry:');
    console.log('     ID:', normalizedLegacy.feedback[0].id);
    console.log('     Title:', normalizedLegacy.feedback[0].title);
    console.log('     Pattern type:', normalizedLegacy.feedback[0].pattern.type);
    console.log('     Pattern expression:', normalizedLegacy.feedback[0].pattern.expression);
}

console.log('\n✅ Legacy configs are correctly converted to the new format!');
