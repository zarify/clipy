import { test, expect } from '@playwright/test';

test.describe('Traceback Mapping Debug', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        await page.goto('/');

        // Wait for the app to load
        await page.waitForLoadState('networkidle');

        // Wait for MicroPython runtime to be ready with longer timeout
        await page.waitForFunction(() => window.runtimeAdapter !== null, { timeout: 15000 });

        // Enable debug logging for detailed trace
        await page.evaluate(() => {
            window.__ssg_debug_logs = true;
            window.__ssg_debug_reset = true;
        });
    });

    test('investigate traceback mapping bug', async ({ page }) => {
        console.log('🔬 Investigating traceback mapping bug...');

        // Set up comprehensive monitoring
        await page.evaluate(() => {
            window.__test_events = [];
            window.__ssg_terminal_event_log = [];

            const originalAppend = window.appendTerminal;
            window.appendTerminal = function (text, type) {
                window.__test_events.push({
                    action: 'append',
                    text: text,
                    type: type,
                    timestamp: Date.now()
                });
                return originalAppend.call(this, text, type);
            };
        });

        // Simple code that should error at line 22, but show as line 1
        const testCode = `# Line 1
# Line 2
# Line 3
# Line 4
# Line 5
# Line 6
# Line 7
# Line 8
# Line 9
# Line 10
# Line 11
# Line 12
# Line 13
# Line 14
# Line 15
# Line 16
# Line 17
# Line 18
# Line 19
# Line 20
# Line 21
print(z)  # Line 22 - should error here`;

        console.log('📝 Setting test code in editor...');

        // Set the code
        const codeSet = await page.evaluate((code) => {
            const editor = document.querySelector('.CodeMirror');
            if (editor && editor.CodeMirror) {
                editor.CodeMirror.setValue(code);
                return true;
            }
            return false;
        }, testCode);

        if (!codeSet) {
            console.log('❌ Failed to set code - looking for editor element...');
            const editorExists = await page.evaluate(() => {
                const editor = document.querySelector('.CodeMirror');
                return !!editor;
            });
            console.log('Editor element exists:', editorExists);
            throw new Error('Could not set code in editor');
        }

        console.log('✅ Code set successfully');

        // Verify the code is correct
        const actualCode = await page.evaluate(() => {
            const editor = document.querySelector('.CodeMirror');
            return editor && editor.CodeMirror ? editor.CodeMirror.getValue() : null;
        });

        const lines = actualCode.split('\n');
        console.log('📊 Code verification:');
        console.log(`  Total lines: ${lines.length}`);
        console.log(`  Last line: "${lines[lines.length - 1]}"`);

        const printZLine = lines.findIndex(line => line.trim().startsWith('print(z)'));
        console.log(`  print(z) is on line: ${printZLine + 1}`);

        console.log('▶️ Running the code...');

        // Run the code
        await page.click('#run');

        // Wait for execution to complete
        await page.waitForFunction(() => {
            return document.querySelector('#terminal-output')?.textContent?.includes('NameError') ||
                document.querySelector('#terminal-output')?.textContent?.includes('Traceback');
        }, { timeout: 10000 });

        // Get comprehensive results
        const terminalContent = await page.evaluate(() => {
            return document.querySelector('#terminal-output')?.textContent || '';
        });

        const events = await page.evaluate(() => window.__test_events || []);
        const terminalEvents = await page.evaluate(() => window.__ssg_terminal_event_log || []);

        const executionState = await page.evaluate(() => {
            return {
                lastMappedEvent: window.__ssg_last_mapped_event,
                suppressRaw: window.__ssg_suppress_raw_stderr_until,
                mappingInProgress: window.__ssg_mapping_in_progress,
                stderrBuffering: window.__ssg_stderr_buffering
            };
        });

        console.log('📊 ANALYSIS RESULTS:');
        console.log('='.repeat(50));

        console.log('\n🖥️ Terminal Output:');
        console.log(terminalContent);

        console.log('\n🎯 Line Number Analysis:');
        const lineMatch = terminalContent.match(/line (\d+)/);
        if (lineMatch) {
            const reportedLine = parseInt(lineMatch[1]);
            console.log(`  Reported line: ${reportedLine}`);
            console.log(`  Expected line: 22 (in source) → 1 (after mapping)`);
            console.log(`  Status: ${reportedLine === 1 ? '✅ WORKING' : '❌ BROKEN'}`);

            if (reportedLine !== 1) {
                console.log(`\n🐛 BUG ANALYSIS:`);
                console.log(`  The traceback shows line ${reportedLine} instead of line 1`);
                console.log(`  This suggests that:`);
                if (reportedLine === 22) {
                    console.log(`    - Header lines offset is not being applied`);
                    console.log(`    - Mapping logic is not running`);
                } else if (reportedLine > 22) {
                    console.log(`    - Additional lines are being prepended somewhere`);
                    console.log(`    - Code transformation may be adding extra content`);
                } else {
                    console.log(`    - Some other transformation is happening`);
                }
            }
        }

        console.log('\n🔧 Execution State:');
        console.log(JSON.stringify(executionState, null, 2));

        console.log('\n📋 Terminal Events (mapping related):');
        const mappingEvents = terminalEvents.filter(event =>
            event.action && (
                event.action.includes('mapping') ||
                event.action.includes('traceback') ||
                event.action.includes('direct_append') ||
                event.action.includes('buffer')
            )
        );

        mappingEvents.forEach((event, i) => {
            console.log(`  ${i}: ${JSON.stringify(event)}`);
        });

        console.log('\n🔍 Full Terminal Events:');
        terminalEvents.forEach((event, i) => {
            console.log(`  ${i}: ${JSON.stringify(event)}`);
        });

        // Success criteria: we collected the evidence
        console.log('\n🎉 Investigation complete - evidence collected for debugging');
    });
});