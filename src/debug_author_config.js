// Debug script for author config persistence issues
// Run this in the browser console to diagnose the problem

async function debugAuthorConfig() {
    console.log('=== Author Config Debug Session ===');

    try {
        // Check if we're in test environment
        const { isTestEnvironment } = await import('./js/unified-storage.js');
        console.log('1. Test environment:', isTestEnvironment());
        console.log('   NODE_ENV:', typeof process !== 'undefined' ? process.env?.NODE_ENV : 'undefined');
        console.log('   __SSG_ALLOW_LOCALSTORAGE:', window.__SSG_ALLOW_LOCALSTORAGE);

        // Check localStorage directly
        console.log('\n2. LocalStorage check:');
        const localStorageConfig = localStorage.getItem('author_config');
        console.log('   localStorage author_config:', localStorageConfig ? 'exists' : 'null');
        if (localStorageConfig) {
            try {
                const parsed = JSON.parse(localStorageConfig);
                console.log('   localStorage config id/title:', parsed.id, parsed.title);
            } catch (e) {
                console.log('   localStorage config invalid JSON');
            }
        }

        // Check unified storage
        console.log('\n3. Unified Storage check:');
        const { loadSetting } = await import('./js/unified-storage.js');
        const unifiedConfig = await loadSetting('author_config');
        console.log('   Unified storage author_config:', unifiedConfig ? 'exists' : 'null');
        if (unifiedConfig) {
            console.log('   Unified config id/title:', unifiedConfig.id, unifiedConfig.title);
        }

        // Check IndexedDB directly
        console.log('\n4. Direct IndexedDB check:');
        if (window.debugUnifiedStorageSettings) {
            await window.debugUnifiedStorageSettings();
        } else {
            console.log('   Debug helper not available');
        }

        // Test save and load
        console.log('\n5. Test save/load cycle:');
        const testConfig = {
            id: 'debug-test-' + Date.now(),
            title: 'Debug Test Config',
            version: '1.0'
        };

        const { saveSetting } = await import('./js/unified-storage.js');
        console.log('   Saving test config...');
        await saveSetting('debug_test', testConfig);

        console.log('   Loading test config...');
        const loadedTest = await loadSetting('debug_test');
        console.log('   Test load result:', loadedTest ? 'success' : 'failed');

        // Clean up test
        const { clearSetting } = await import('./js/unified-storage.js');
        await clearSetting('debug_test');

    } catch (error) {
        console.error('Debug failed:', error);
    }

    console.log('=== Debug Session Complete ===');
}

// Also add a simpler function to save a test config
async function saveTestAuthorConfig() {
    const testConfig = {
        id: 'test-config-' + Date.now(),
        title: 'Test Configuration',
        version: '1.0',
        description: 'Test configuration for debugging',
        starter: 'print("Hello from test config")',
        files: {
            '/main.py': 'print("Hello from test config")'
        }
    };

    console.log('Saving test author config:', testConfig);
    const { saveSetting } = await import('./js/unified-storage.js');
    await saveSetting('author_config', testConfig);
    console.log('Test config saved');

    // Verify
    const { loadSetting } = await import('./js/unified-storage.js');
    const loaded = await loadSetting('author_config');
    console.log('Verification load:', loaded ? 'success' : 'failed');

    return testConfig;
}

// Export for console use
window.debugAuthorConfig = debugAuthorConfig;
window.saveTestAuthorConfig = saveTestAuthorConfig;

console.log('Debug functions loaded. Run debugAuthorConfig() or saveTestAuthorConfig() in console.');
