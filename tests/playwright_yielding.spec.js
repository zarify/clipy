import { test, expect } from '@playwright/test';

test.describe('MicroPython Yielding Behavior Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000');
        await page.waitForFunction(() => window.runtimeAdapter !== undefined);

        // Clear terminal
        await page.evaluate(() => {
            const terminal = document.querySelector('.terminal-output');
            if (terminal) terminal.innerHTML = '';
        });
    });

    test('should yield properly during time.sleep() calls', async ({ page }) => {
        const runButton = page.locator('#run');
        const codeTextarea = page.locator('#code');

        await codeTextarea.fill(`
import time
print("Testing yielding during sleep...")
for i in range(5):
    print(f"Before sleep {i}")
    time.sleep(1.0)
    print(f"After sleep {i}")
print("Yielding test complete!")
    `);

        const startTime = Date.now();
        await runButton.click();

        // Should complete in reasonable time (not freeze)
        await expect(page.locator('.terminal-output')).toContainText('Yielding test complete!', { timeout: 8000 });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should take approximately 5 seconds (5 * 1 second sleep)
        // but not much longer (which would indicate freezing)
        expect(duration).toBeGreaterThan(4000);
        expect(duration).toBeLessThan(8000);
    });

    test('should maintain UI responsiveness during yielding', async ({ page }) => {
        const runButton = page.locator('#run');
        const stopButton = page.locator('button:has-text("Stop")');
        const codeTextarea = page.locator('#code');

        await codeTextarea.fill(`
import time
print("Starting long-running yielding test...")
for i in range(10):
    print(f"Yielding iteration {i}")
    time.sleep(0.8)
print("Long test complete!")
    `);

        await runButton.click();

        // After starting, UI should remain responsive
        await page.waitForFunction(() => {
            const output = document.querySelector('.terminal-output');
            return output && output.textContent.includes('Yielding iteration 0');
        });

        // Test UI responsiveness during execution
        await expect(stopButton).toBeEnabled();
        await expect(codeTextarea).toBeEditable();

        // Should be able to modify textarea content while code runs
        // Since our textarea is off-screen, interact with it programmatically
        await page.evaluate(() => {
            const textarea = document.getElementById('code');
            if (textarea) {
                textarea.value = '# Modified during execution';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // Stop button should work immediately
        await stopButton.click();
        await expect(page.locator('.terminal-output')).toContainText('KeyboardInterrupt', { timeout: 2000 });
    });

    test('should handle rapid yielding operations', async ({ page }) => {
        const runButton = page.locator('#run');
        const codeTextarea = page.locator('#code');

        await codeTextarea.fill(`
import time
print("Testing rapid yielding...")
for i in range(20):
    print(f"Rapid yield {i}")
    time.sleep(0.1)  # Very short sleep
print("Rapid yielding complete!")
    `);

        const startTime = Date.now();
        await runButton.click();

        await expect(page.locator('.terminal-output')).toContainText('Rapid yielding complete!', { timeout: 5000 });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete in approximately 2 seconds (20 * 0.1)
        expect(duration).toBeGreaterThan(1500);
        expect(duration).toBeLessThan(4000);
    });

    test('should detect yielding capabilities correctly', async ({ page }) => {
        const capabilities = await page.evaluate(() => {
            if (!window.runtimeAdapter) return 'No runtime adapter';

            const caps = {
                hasYieldingSupport: window.runtimeAdapter.hasYieldingSupport,
                hasSetYielding: typeof window.runtimeAdapter.setYielding === 'function',
                hasInterruptExecution: typeof window.runtimeAdapter.interruptExecution === 'function',
                hasClearInterrupt: typeof window.runtimeAdapter.clearInterrupt === 'function'
            };

            return caps;
        });

        expect(capabilities.hasYieldingSupport).toBe(true);
        expect(capabilities.hasSetYielding).toBe(true);
        expect(capabilities.hasInterruptExecution).toBe(true);
        expect(capabilities.hasClearInterrupt).toBe(true);
    });

    test('should enable/disable yielding as expected', async ({ page }) => {
        const runButton = page.locator('#run');
        const codeTextarea = page.locator('#code');

        // Test with yielding disabled (should run fast but not interruptible)
        await page.evaluate(() => {
            if (window.runtimeAdapter && window.runtimeAdapter.setYielding) {
                window.runtimeAdapter.setYielding(false);
            }
        });

        await codeTextarea.fill(`
import time
print("Testing with yielding disabled...")
for i in range(3):
    print(f"No yield {i}")
    time.sleep(0.2)
print("No yielding test complete!")
    `);

        const startTime = Date.now();
        await runButton.click();

        await expect(page.locator('.terminal-output')).toContainText('No yielding test complete!', { timeout: 3000 });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should still complete (sleep might be handled differently)
        expect(duration).toBeLessThan(2000);

        // Re-enable yielding for other tests
        await page.evaluate(() => {
            if (window.runtimeAdapter && window.runtimeAdapter.setYielding) {
                window.runtimeAdapter.setYielding(true);
            }
        });
    });
});
