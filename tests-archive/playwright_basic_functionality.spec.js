import { test, expect } from '@playwright/test';

test.describe('MicroPython Basic Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000');
        await page.waitForSelector('#run');
        await page.click('#tab-btn-terminal');
        await page.waitForTimeout(1000);
    });

    test('should run simple Python code', async ({ page }) => {
        // Set simple test code
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue('print("Hello from MicroPython!")');
            }
        });

        // Run the code
        await page.click('#run');

        // Should see output
        await expect(page.locator('#terminal-output')).toContainText('Hello from MicroPython!', { timeout: 5000 });
    });

    test('should interrupt infinite loop', async ({ page }) => {
        // Set infinite loop code
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue(`
print("Starting infinite loop...")
count = 0
while True:
    count += 1
    if count % 100000 == 0:
        print(f"Count: {count}")
        `);
            }
        });

        // Start execution
        await page.click('#run');

        // Wait for stop button to appear
        await page.waitForSelector('#stop', { state: 'visible' });

        // Let it run briefly
        await page.waitForTimeout(2000);

        // Stop execution
        await page.click('#stop');

        // Should stop and show KeyboardInterrupt
        await expect(page.locator('#terminal-output')).toContainText('KeyboardInterrupt', { timeout: 5000 });
    });

    test('should handle time.sleep() and interrupt', async ({ page }) => {
        // Set sleep loop code
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue(`
import time
print("Starting sleep loop...")
for i in range(10):
    print(f"Iteration {i}")
    time.sleep(1)
print("Loop completed")
        `);
            }
        });

        // Start execution
        await page.click('#run');

        // Wait for execution to start
        await page.waitForSelector('#stop', { state: 'visible' });
        await expect(page.locator('#terminal-output')).toContainText('Starting sleep loop...', { timeout: 3000 });

        // Let it run for a bit then interrupt
        await page.waitForTimeout(2500);
        await page.click('#stop');

        // Should interrupt successfully
        await expect(page.locator('#terminal-output')).toContainText('KeyboardInterrupt', { timeout: 5000 });
    });

    test('should recover after interrupt', async ({ page }) => {
        // First: run and interrupt infinite loop
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue(`
while True:
    pass
        `);
            }
        });

        await page.click('#run');
        await page.waitForSelector('#stop', { state: 'visible' });
        await page.waitForTimeout(1000);
        await page.click('#stop');

        await expect(page.locator('#terminal-output')).toContainText('KeyboardInterrupt', { timeout: 5000 });

        // Clear terminal
        await page.evaluate(() => {
            const terminal = document.querySelector('#terminal-output');
            if (terminal) terminal.innerHTML = '';
        });

        // Second: run normal code - should work
        await page.evaluate(() => {
            const editorElement = document.querySelector('.CodeMirror');
            if (editorElement && editorElement.CodeMirror) {
                editorElement.CodeMirror.setValue('print("Recovery successful!")');
            }
        });

        await page.click('#run');
        await expect(page.locator('#terminal-output')).toContainText('Recovery successful!', { timeout: 5000 });
    });
});
