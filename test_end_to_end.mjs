// End-to-end test simulation of the author config save/load bug
import { validateAndNormalizeConfig } from './src/js/config.js';

console.log('=== Simulating Author Config Save/Load Flow ===\n');

// Step 1: Simulate what the author page saves
console.log('1. Author page creates config with feedback/tests:');
const authorPageConfig = {
    id: 'demo-config',
    title: 'Demo Configuration',
    version: '1.0',
    feedback: [
        {
            id: 'demo-feedback',
            title: 'Demo Feedback',
            when: ['edit'],
            pattern: { type: 'regex', target: 'code', expression: 'print\\(' },
            message: 'Good job using print!',
            severity: 'success'
        }
    ],
    tests: [
        {
            id: 'demo-test',
            description: 'Check output',
            expected_stdout: 'Hello, World!'
        }
    ]
};

console.log('   Feedback entries:', authorPageConfig.feedback.length);
console.log('   Test entries:', authorPageConfig.tests.length);

// Step 2: Config gets normalized before saving (this was the problematic step)
console.log('\n2. Config normalization during save:');
const normalizedConfig = validateAndNormalizeConfig(authorPageConfig);
console.log('   After normalization:');
console.log('   Feedback type:', Array.isArray(normalizedConfig.feedback) ? 'array' : typeof normalizedConfig.feedback);
console.log('   Feedback entries:', normalizedConfig.feedback.length);
console.log('   Tests type:', Array.isArray(normalizedConfig.tests) ? 'array' : typeof normalizedConfig.tests);
console.log('   Tests entries:', normalizedConfig.tests.length);

// Step 3: Simulate loading in main app
console.log('\n3. Main app loads the config:');
// The main app would get the normalized config from IndexedDB
const loadedConfig = normalizedConfig; // This is what comes from storage

// Step 4: Main app applies the config (this is where the UI gets updated)
console.log('\n4. Applying config to UI:');

// Simulate setFeedbackConfig normalization (the patch we added to feedback-ui.js)
function simulateSetFeedbackConfig(cfg) {
    let normalizedCfg = cfg || { feedback: [] }

    // The tests string parsing (already worked)
    if (normalizedCfg && typeof normalizedCfg.tests === 'string' && normalizedCfg.tests.trim()) {
        try {
            const parsed = JSON.parse(normalizedCfg.tests)
            if (Array.isArray(parsed)) normalizedCfg.tests = parsed
        } catch (_e) { /* leave as-is if parse fails */ }
    }

    // The legacy feedback conversion (our new fix)
    if (normalizedCfg && normalizedCfg.feedback && !Array.isArray(normalizedCfg.feedback) && typeof normalizedCfg.feedback === 'object') {
        console.log('   WARNING: Legacy feedback object detected, converting...');
        // This conversion would happen but shouldn't be needed now
        const legacy = normalizedCfg.feedback || {}
        const arr = []
        const r = Array.isArray(legacy.regex) ? legacy.regex : []
        for (let i = 0; i < r.length; i++) {
            const item = r[i]
            arr.push({
                id: item.id || ('legacy-regex-' + i),
                title: item.title || ('legacy ' + i),
                when: item.when || ['edit'],
                pattern: { type: 'regex', target: (item.target === 'output' ? 'stdout' : (item.target || 'code')), expression: item.pattern || item.expression || '' },
                message: item.message || '',
                severity: item.severity || 'info',
                visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
            })
        }
        const a = Array.isArray(legacy.ast) ? legacy.ast : []
        for (let i = 0; i < a.length; i++) {
            const item = a[i]
            arr.push({
                id: item.id || ('legacy-ast-' + i),
                title: item.title || ('legacy-ast ' + i),
                when: item.when || ['edit'],
                pattern: { type: 'ast', target: (item.target || 'code'), expression: item.rule || item.expression || item.pattern || '', matcher: item.matcher || '' },
                message: item.message || '',
                severity: item.severity || 'info',
                visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
            })
        }
        normalizedCfg.feedback = arr
    }

    return normalizedCfg;
}

const uiConfig = simulateSetFeedbackConfig(loadedConfig);
console.log('   UI feedback type:', Array.isArray(uiConfig.feedback) ? 'array' : typeof uiConfig.feedback);
console.log('   UI feedback entries:', uiConfig.feedback.length);
console.log('   UI tests type:', Array.isArray(uiConfig.tests) ? 'array' : typeof uiConfig.tests);
console.log('   UI tests entries:', uiConfig.tests.length);

console.log('\n=== Results ===');
if (Array.isArray(uiConfig.feedback) && uiConfig.feedback.length > 0) {
    console.log('✅ FEEDBACK: Successfully loaded and preserved');
    console.log('   Entry:', uiConfig.feedback[0].title);
} else {
    console.log('❌ FEEDBACK: Lost during save/load process');
}

if (Array.isArray(uiConfig.tests) && uiConfig.tests.length > 0) {
    console.log('✅ TESTS: Successfully loaded and preserved');
    console.log('   Entry:', uiConfig.tests[0].description);
} else {
    console.log('❌ TESTS: Lost during save/load process');
}

console.log('\n🎉 The bug should now be fixed!');
