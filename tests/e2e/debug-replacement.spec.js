import { test, expect } from '@playwright/test';

test.describe('Terminal Content Debug', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => window.runtimeAdapter !== null, { timeout: 15000 });
    });

    test('debug terminal replacement', async ({ page }) => {
        console.log('🔧 Debugging terminal replacement process...');

        await page.evaluate(() => {
            const terminal = document.querySelector('#terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        const testCode = 'print(undefined_variable)  # Simple error on line 1';

        await page.evaluate((code) => {
            const editor = document.querySelector('.CodeMirror');
            if (editor && editor.CodeMirror) {
                editor.CodeMirror.setValue(code);
            }
        }, testCode);

        await page.click('#run');

        await page.waitForFunction(() => {
            const terminal = document.querySelector('#terminal-output');
            return terminal && terminal.textContent.includes('NameError');
        }, { timeout: 10000 });

        // Let mapping complete
        await page.waitForTimeout(2000);

        const terminalHTML = await page.evaluate(() => {
            return document.querySelector('#terminal-output').innerHTML;
        });

        const terminalText = await page.evaluate(() => {
            return document.querySelector('#terminal-output').textContent;
        });

        const events = await page.evaluate(() => {
            return (window.__ssg_terminal_event_log || []).filter(event =>
                event.action && (
                    event.action.includes('replace') ||
                    event.action.includes('mapped') ||
                    event.action.includes('append')
                )
            );
        });

        console.log('🖥️ Terminal HTML length:', terminalHTML.length);
        console.log('📝 Terminal Text:', terminalText.slice(-500)); // Last 500 chars
        console.log('🔄 Replacement events:');
        events.forEach((event, i) => {
            console.log(`  ${i}: ${event.action} - ${JSON.stringify(event).slice(0, 200)}`);
        });

        // Check if we can see both versions
        const hasOriginalError = terminalText.includes('line 43') || terminalText.includes('line 22') || terminalText.includes('<stdin>');
        const hasMappedError = terminalText.includes('line 1');

        console.log('📊 Analysis:');
        console.log('  Has original error:', hasOriginalError);
        console.log('  Has mapped error:', hasMappedError);
        console.log('  Both present:', hasOriginalError && hasMappedError);

        if (hasOriginalError && hasMappedError) {
            console.log('🔍 ISSUE: Both original and mapped content are present - replacement not removing original');
        } else if (!hasMappedError) {
            console.log('🔍 ISSUE: Mapped content not added - replacement not working');
        } else if (!hasOriginalError) {
            console.log('✅ SUCCESS: Only mapped content present - replacement working correctly');
        }

        // Success if we have mapped content (even if original is also present for debugging)
        if (hasMappedError) {
            console.log('🎉 Mapping is producing correct line 1 result');
        }
    });
});