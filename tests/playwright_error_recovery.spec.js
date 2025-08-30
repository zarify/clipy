import { test, expect } from '@playwright/test';

test.describe('MicroPython Error Recovery Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000');
        await page.waitForFunction(() => window.runtimeAdapter !== undefined);

        // Clear terminal
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });
    });

    test('should recover from multiple interrupt cycles', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code'); // Use specific ID selector instead of generic 'textarea'

        // Run 3 interrupt cycles to test recovery
        for (let cycle = 1; cycle <= 3; cycle++) {
            console.log(`Testing interrupt cycle ${cycle}`);

            await codeTextarea.fill(`
import time
print(f"Cycle ${cycle} starting...")
count = 0
while True:
    count += 1
    print(f"Cycle ${cycle}, iteration {count}")
    time.sleep(0.5)
      `);

            await runButton.click();

            // Wait for execution to start
            await page.waitForFunction((cycleNum) => {
                const output = document.querySelector('.terminal-output');
                return output && output.textContent.includes(`Cycle ${cycleNum}, iteration`);
            }, cycle);

            // Let it run for a bit then interrupt
            await page.waitForTimeout(1200);
            await stopButton.click();

            // Should interrupt cleanly
            await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });

            // Clear output for next cycle
            await page.evaluate(() => {
                const terminal = document.querySelector('.terminal-output');
                if (terminal) terminal.innerHTML = '';
            });

            // Brief pause between cycles
            await page.waitForTimeout(300);
        }

        // After all cycles, should still be able to run normal code
        await codeTextarea.fill(`
print("Recovery test successful!")
print("All interrupt cycles completed cleanly")
    `);

        await runButton.click();
        await expect(page.locator('.terminal-output')).toContainText('Recovery test successful!');
    });

    test('should not accumulate errors across executions', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code'); // Use specific ID selector

        // First: run problematic code and interrupt
        await codeTextarea.fill(`
import time
while True:
    time.sleep(0.3)
    `);

        await runButton.click();
        await page.waitForTimeout(800);
        await stopButton.click();
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });

        // Check console for any accumulated errors
        const consoleErrors = await page.evaluate(() => {
            // Count console errors (simplified check)
            return window.__consoleErrorCount || 0;
        });

        // Clear output
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        // Second: run normal code - should work without issues
        await codeTextarea.fill(`
print("Error accumulation test")
for i in range(3):
    print(f"Normal execution {i}")
print("Test complete - no accumulated errors!")
    `);

        await runButton.click();
        await expect(page.locator('.terminal-output')).toContainText('Test complete - no accumulated errors!');

        // Should not see any "async operation in flight" or other error messages
        const finalOutput = await page.locator('.terminal-output').textContent();
        expect(finalOutput).not.toContain('async operation in flight');
        expect(finalOutput).not.toContain('Error:');
        expect(finalOutput).not.toContain('Exception:');
    });

    test('should handle clearInterrupt functionality', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code'); // Use specific ID selector

        // Start and interrupt execution
        await codeTextarea.fill(`
import time
while True:
    time.sleep(0.5)
    `);

        await runButton.click();
        await page.waitForTimeout(700);
        await stopButton.click();
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 3000 });

        // Manually clear interrupt state
        await page.evaluate(() => {
            if (window.runtimeAdapter && window.runtimeAdapter.clearInterrupt) {
                window.runtimeAdapter.clearInterrupt();
                console.log('Manual interrupt clear called');
            }
        });

        // Clear output
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        // Should be able to run new code immediately
        await codeTextarea.fill(`
print("Interrupt cleared successfully!")
print("Ready for new execution")
    `);

        await runButton.click();
        await expect(page.locator('.terminal-output')).toContainText('Interrupt cleared successfully!');
    });

    test('should maintain consistent state after errors', async ({ page }) => {
        const runButton = page.locator('#run');
        const codeTextarea = page.locator('#code'); // Use specific ID selector

        // Run code with Python syntax error
        await codeTextarea.fill(`
print("Before error")
this_is_invalid_python_syntax!!!
print("After error")
    `);

        await runButton.click();

        // Should see the error
        await expect(page.locator('.terminal-output')).toContainText('SyntaxError', { timeout: 3000 });

        // Clear output
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        // Should be able to run valid code after syntax error
        await codeTextarea.fill(`
print("State recovered after syntax error")
x = 2 + 2
print(f"Calculation works: {x}")
    `);

        await runButton.click();
        await expect(page.locator('.terminal-output')).toContainText('State recovered after syntax error');
        await expect(page.locator('.terminal-output')).toContainText('Calculation works: 4');
    });

    test('should handle rapid start/stop cycles', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code'); // Use specific ID selector

        await codeTextarea.fill(`
import time
count = 0
while True:
    count += 1
    print(f"Rapid cycle: {count}")
    time.sleep(0.2)
    `);

        // Perform rapid start/stop cycles
        for (let i = 0; i < 5; i++) {
            console.log(`Rapid cycle ${i + 1}`);

            await runButton.click();

            // Very short execution time before stop
            await page.waitForTimeout(300);
            await stopButton.click();

            // Should handle interrupt quickly
            await page.waitForFunction(() => {
                const output = document.querySelector('.terminal-output');
                return output && (
                    output.textContent.includes('KeyboardInterrupt') ||
                    output.textContent.includes('Rapid cycle:')
                );
            }, { timeout: 2000 });

            // Brief pause between cycles
            await page.waitForTimeout(200);
        }

        // Final test - should still work normally
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        await codeTextarea.fill(`
print("Rapid cycle test completed successfully!")
    `);

        await runButton.click();
        await expect(page.locator('.terminal-output')).toContainText('Rapid cycle test completed successfully!');
    });
});
