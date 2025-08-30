import { test, expect } from '@playwright/test';

test.describe('MicroPython Interrupt and Yielding Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('http://localhost:8000');

        // Wait for the page to load and CodeMirror to initialize
        await page.waitForSelector('#run');

        // Switch to terminal tab to see output
        await page.click('#tab-btn-terminal');
        await page.waitForSelector('#terminal-output');

        // Wait a bit for MicroPython to load
        await page.waitForTimeout(2000);
    });

    test('should detect asyncify interrupt capabilities', async ({ page }) => {
        // Set some simple code to verify the runtime
        await page.evaluate(() => {
            // Access CodeMirror instance and set code
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue('print("Testing runtime...")');
            }
        });

        // Run the code
        await page.click('#run');

        // Should see output in terminal
        await expect(page.locator('#terminal-output')).toContainText('Testing runtime...', { timeout: 5000 });

        // Check for runtime capabilities in console
        const runtimeCapabilities = await page.evaluate(() => {
            console.log('Checking runtime adapter:', window.runtimeAdapter);
            if (window.runtimeAdapter) {
                const capabilities = {
                    hasInterrupt: typeof window.runtimeAdapter.interruptExecution === 'function',
                    hasYielding: typeof window.runtimeAdapter.setYielding === 'function',
                    hasClear: typeof window.runtimeAdapter.clearInterrupt === 'function',
                    hasYieldingSupport: window.runtimeAdapter.hasYieldingSupport,
                    interruptExecution: window.runtimeAdapter.interruptExecution,
                    setYielding: window.runtimeAdapter.setYielding,
                    clearInterrupt: window.runtimeAdapter.clearInterrupt
                };
                console.log('Runtime capabilities:', capabilities);
                return capabilities;
            }
            console.log('No runtime adapter found');
            return { available: false };
        });

        // Should have asyncify capabilities
        console.log('Test result:', runtimeCapabilities);
        if (!runtimeCapabilities.hasInterrupt) {
            throw new Error(`Expected hasInterrupt to be true, got: ${JSON.stringify(runtimeCapabilities, null, 2)}`);
        }
        expect(runtimeCapabilities.hasInterrupt).toBe(true);
    });

    test('should interrupt time.sleep() loops without browser freeze', async ({ page }) => {
        // Set code with time.sleep loop
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue(`
import time
print("Starting sleep loop...")
count = 0
while True:
    count += 1
    print(f"Sleep iteration: {count}")
    time.sleep(1.0)
        `);
            }
        });

        // Start execution
        await page.click('#run');

        // Wait for execution to start and show stop button
        await page.waitForSelector('#stop', { state: 'visible' });

        // Wait for a few iterations to start
        await expect(page.locator('#terminal-output')).toContainText('Sleep iteration:', { timeout: 8000 });

        // Interrupt after 3 seconds
        await page.waitForTimeout(3000);
        await page.click('#stop');

        // Should see KeyboardInterrupt within reasonable time
        await expect(page.locator('#terminal-output')).toContainText('KeyboardInterrupt', { timeout: 5000 });

        // Run button should be enabled again
        await expect(page.locator('#run')).toBeEnabled();
    });

    test('should interrupt tight computation loops', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');

        // Set infinite computation code
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue(`
print("Starting computation test...")
count = 0
while True:
    count += 1
    if count % 50000 == 0:
        print(f"Count: {count}")
                `);
            }
        });

        await runButton.click();

        // Wait for computation to start
        await page.waitForFunction(() => {
            const output = document.querySelector('.terminal-output');
            return output && output.textContent.includes('Count:');
        });

        // Interrupt quickly
        await page.waitForTimeout(1000);
        await stopButton.click();

        // Should interrupt successfully
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });
    });

    test('should handle mixed computation and sleep loops', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code');

        await codeTextarea.fill(`
import time
print("Starting mixed test...")
count = 0
while True:
    count += 1
    print(f"Mixed iteration: {count}")
    
    # Computation phase
    for i in range(50000):
        x = i * 2
    
    # Sleep phase
    time.sleep(0.5)
    `);

        await runButton.click();

        // Wait for multiple iterations
        await page.waitForFunction(() => {
            const output = document.querySelector('.terminal-output');
            return output && output.textContent.includes('Mixed iteration: 2');
        });

        await stopButton.click();

        // Should interrupt regardless of which phase it's in
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });
    });

    test('should recover cleanly after interrupt', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code');

        // First execution with interrupt
        await codeTextarea.fill(`
import time
while True:
    print("First execution...")
    time.sleep(1)
    `);

        await runButton.click();
        await page.waitForTimeout(1500);
        await stopButton.click();

        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });

        // Clear output
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        // Second execution should work normally
        await codeTextarea.fill(`
print("Second execution works!")
print("Recovery successful!")
    `);

        await runButton.click();

        await expect(page.locator('.terminal-output')).toContainText('Second execution works!');
        await expect(page.locator('.terminal-output')).toContainText('Recovery successful!');
    });

    test('should not cause "async operation in flight" errors', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code');

        // Run multiple interrupt cycles
        for (let i = 0; i < 3; i++) {
            await codeTextarea.fill(`
import time
print("Cycle ${i + 1} starting...")
while True:
    time.sleep(0.3)
    print("Still running...")
      `);

            await runButton.click();
            await page.waitForTimeout(800);
            await stopButton.click();

            await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });

            // Should not see "async operation in flight" error
            const output = await page.locator('.terminal-output').textContent();
            expect(output).not.toContain('async operation in flight');

            // Clear for next cycle
            await page.evaluate(() => {
                const terminal = document.querySelector('.terminal-output');
                if (terminal) terminal.innerHTML = '';
            });

            // Short delay between cycles
            await page.waitForTimeout(500);
        }
    });

    test('should maintain browser responsiveness during execution', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code');

        await codeTextarea.fill(`
import time
count = 0
while True:
    count += 1
    if count % 5 == 0:
        print(f"Responsive test: {count}")
    time.sleep(0.2)
    `);

        await runButton.click();

        // Wait for execution to start
        await page.waitForFunction(() => {
            const output = document.querySelector('.terminal-output');
            return output && output.textContent.includes('Responsive test:');
        });

        // Test browser responsiveness by interacting with UI elements
        // These should work without delay even during execution
        await expect(stopButton).toBeEnabled();
        await expect(codeTextarea).toBeEditable();

        // Should be able to hover and click elements
        await stopButton.hover();
        // Since textarea is off-screen, interact programmatically instead of clicking
        await page.evaluate(() => {
            const textarea = document.getElementById('code');
            if (textarea) textarea.focus();
        });

        // Stop execution
        await stopButton.click();
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });
    });

    test('should handle yielding configuration', async ({ page }) => {
        // Test yielding enable/disable functionality
        const yieldingStatus = await page.evaluate(async () => {
            // Test initial state
            if (!window.runtimeAdapter) return 'Runtime not available';

            const results = [];

            // Check if yielding functions exist
            if (typeof window.runtimeAdapter.setYielding === 'function') {
                results.push('setYielding available');

                // Test enabling/disabling
                window.runtimeAdapter.setYielding(false);
                results.push('yielding disabled');

                window.runtimeAdapter.setYielding(true);
                results.push('yielding enabled');
            }

            return results.join(', ');
        });

        expect(yieldingStatus).toContain('setYielding available');
        expect(yieldingStatus).toContain('yielding enabled');
    });

    test('should interrupt nested function calls with sleep', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code');

        await codeTextarea.fill(`
import time

def nested_sleep_function(depth):
    print(f"Nested call depth: {depth}")
    time.sleep(0.5)
    if depth > 0:
        nested_sleep_function(depth - 1)
    time.sleep(0.5)

print("Starting nested function test...")
while True:
    nested_sleep_function(3)
    print("Completed nested calls")
    `);

        await runButton.click();

        // Wait for nested calls to start
        await page.waitForFunction(() => {
            const output = document.querySelector('.terminal-output');
            return output && output.textContent.includes('Nested call depth:');
        });

        await page.waitForTimeout(1000);
        await stopButton.click();

        // Should interrupt even in nested calls
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });
    });
});
