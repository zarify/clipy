import { test, expect } from '@playwright/test';

test.describe('Debug App Loading', () => {
    test('check what elements are available', async ({ page }) => {
        console.log('🔍 Checking app loading status...');

        // Navigate to the app
        await page.goto('/');

        // Wait longer for app to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000); // Give extra time

        // Check what's actually on the page
        const pageContent = await page.evaluate(() => {
            return {
                title: document.title,
                hasCodeMirror: !!document.querySelector('.CodeMirror'),
                hasTerminal: !!document.querySelector('#terminal-output'),
                hasRunButton: !!document.querySelector('#run'),
                hasRuntimeAdapter: !!window.runtimeAdapter,
                bodyClasses: document.body.className,
                allElementIds: Array.from(document.querySelectorAll('[id]')).map(el => el.id),
                scripts: Array.from(document.querySelectorAll('script')).map(s => s.src).filter(s => s)
            };
        });

        console.log('📊 Page Analysis:');
        console.log('Title:', pageContent.title);
        console.log('Has CodeMirror editor:', pageContent.hasCodeMirror);
        console.log('Has terminal:', pageContent.hasTerminal);
        console.log('Has run button:', pageContent.hasRunButton);
        console.log('Has runtime adapter:', pageContent.hasRuntimeAdapter);
        console.log('Body classes:', pageContent.bodyClasses);
        console.log('Element IDs found:', pageContent.allElementIds.slice(0, 20)); // First 20

        // Check for any errors in the console
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push({ type: msg.type(), text: msg.text() });
        });

        await page.waitForTimeout(2000);

        if (consoleMessages.length > 0) {
            console.log('📝 Console messages:');
            consoleMessages.forEach(msg => {
                console.log(`  ${msg.type}: ${msg.text}`);
            });
        }

        // Try to wait for CodeMirror to load
        try {
            await page.waitForSelector('.CodeMirror', { timeout: 10000 });
            console.log('✅ CodeMirror loaded successfully');

            // If CodeMirror loaded, try to set some code and run
            const testResult = await page.evaluate(() => {
                const editor = document.querySelector('.CodeMirror');
                if (editor && editor.CodeMirror) {
                    editor.CodeMirror.setValue('print("Hello from test")');
                    return { success: true, value: editor.CodeMirror.getValue() };
                }
                return { success: false };
            });

            console.log('📝 Test code setting:', testResult);

            if (testResult.success) {
                console.log('▶️ Trying to run code...');
                await page.click('#run');

                // Wait a bit and check terminal
                await page.waitForTimeout(3000);

                const terminalOutput = await page.textContent('#terminal-output');
                console.log('🖥️ Terminal output:', terminalOutput);
            }

        } catch (e) {
            console.log('❌ CodeMirror failed to load:', e.message);

            // Check what went wrong
            const errorDetails = await page.evaluate(() => {
                return {
                    codeMirrorScript: !!window.CodeMirror,
                    hasTextarea: !!document.querySelector('#code'),
                    editorHost: !!document.querySelector('#editor-host'),
                    anyErrors: window.onerror || 'none'
                };
            });

            console.log('🔧 Error details:', errorDetails);
        }
    });
});