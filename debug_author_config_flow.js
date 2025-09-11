// Debug script to inspect author config save/load flow
// Run this in browser console to trace the data pipeline

async function debugAuthorConfigFlow() {
    console.log('=== Debug Author Config Save/Load Flow ===');

    try {
        // Import the storage modules
        const { loadSetting, saveSetting } = await import('./src/js/unified-storage.js');
        const { getAuthorConfigFromLocalStorage, saveAuthorConfigToLocalStorage } = await import('./src/js/author-storage.js');

        // Check what's currently in IndexedDB under 'author_config'
        console.log('\n1. Checking unified storage (IndexedDB):');
        const unifiedConfig = await loadSetting('author_config');
        console.log('   Unified storage author_config exists:', !!unifiedConfig);
        if (unifiedConfig) {
            console.log('   Config keys:', Object.keys(unifiedConfig));
            console.log('   Feedback type:', Array.isArray(unifiedConfig.feedback) ? 'array' : typeof unifiedConfig.feedback);
            if (unifiedConfig.feedback) {
                console.log('   Feedback structure:', unifiedConfig.feedback);
            }
            console.log('   Tests type:', Array.isArray(unifiedConfig.tests) ? 'array' : typeof unifiedConfig.tests);
            if (unifiedConfig.tests) {
                console.log('   Tests structure:', unifiedConfig.tests);
            }
        }

        // Check what the author-storage adapter returns
        console.log('\n2. Checking author-storage adapter:');
        const adapterConfig = await getAuthorConfigFromLocalStorage();
        console.log('   Adapter returns:', !!adapterConfig);
        if (adapterConfig) {
            console.log('   Config keys:', Object.keys(adapterConfig));
            console.log('   Feedback type:', Array.isArray(adapterConfig.feedback) ? 'array' : typeof adapterConfig.feedback);
            if (adapterConfig.feedback) {
                console.log('   Feedback structure:', adapterConfig.feedback);
            }
            console.log('   Tests type:', Array.isArray(adapterConfig.tests) ? 'array' : typeof adapterConfig.tests);
            if (adapterConfig.tests) {
                console.log('   Tests structure:', adapterConfig.tests);
            }
        }

        // Test a round-trip save/load with sample data
        console.log('\n3. Testing round-trip save/load:');
        const testConfig = {
            id: 'test-debug',
            title: 'Debug Test Config',
            version: '1.0',
            feedback: [
                {
                    id: 'test-feedback',
                    title: 'Test Feedback',
                    when: ['edit'],
                    pattern: { type: 'regex', target: 'code', expression: 'print' },
                    message: 'Found print statement',
                    severity: 'info'
                }
            ],
            tests: [
                {
                    id: 'test-1',
                    description: 'Test output',
                    expected_stdout: 'Hello'
                }
            ]
        };

        console.log('   Saving test config...');
        await saveAuthorConfigToLocalStorage(testConfig);

        console.log('   Loading back...');
        const loadedBack = await getAuthorConfigFromLocalStorage();
        console.log('   Loaded config keys:', Object.keys(loadedBack || {}));
        if (loadedBack) {
            console.log('   Feedback preserved:', !!loadedBack.feedback, 'type:', Array.isArray(loadedBack.feedback) ? 'array' : typeof loadedBack.feedback);
            console.log('   Tests preserved:', !!loadedBack.tests, 'type:', Array.isArray(loadedBack.tests) ? 'array' : typeof loadedBack.tests);
        }

        // Check how the main app's config modal loads it
        console.log('\n4. Checking main app config modal logic (simulated):');
        if (loadedBack) {
            console.log('   Raw loaded config feedback:', loadedBack.feedback);
            console.log('   Raw loaded config tests:', loadedBack.tests);

            // Simulate the normalization that happens in app.js
            try {
                if (loadedBack && typeof loadedBack.tests === 'string' && loadedBack.tests.trim()) {
                    const parsedTests = JSON.parse(loadedBack.tests);
                    if (Array.isArray(parsedTests)) {
                        console.log('   Tests would be parsed from string to array:', parsedTests.length, 'tests');
                    }
                }
            } catch (e) {
                console.log('   Tests parsing failed:', e.message);
            }

            // Check what config validation does
            try {
                const { validateAndNormalizeConfig } = await import('./src/js/config.js');
                const normalized = validateAndNormalizeConfig(loadedBack);
                console.log('   After validateAndNormalizeConfig:');
                console.log('     Feedback type:', Array.isArray(normalized.feedback) ? 'array' : typeof normalized.feedback);
                console.log('     Tests type:', Array.isArray(normalized.tests) ? 'array' : typeof normalized.tests);
                console.log('     Feedback content:', normalized.feedback);
                console.log('     Tests content:', normalized.tests);
            } catch (e) {
                console.log('   Config validation failed:', e.message);
            }
        }

    } catch (error) {
        console.error('Debug script failed:', error);
    }
}

// Auto-run if loaded as a script
if (typeof window !== 'undefined') {
    window.debugAuthorConfigFlow = debugAuthorConfigFlow;
    console.log('Debug function loaded. Run debugAuthorConfigFlow() to inspect the flow.');
}
