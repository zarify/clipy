import { test, expect } from '@playwright/test'

test('Simple traceback mapping verification', async ({ page }) => {
    console.log('🔍 Testing simple traceback mapping...')

    // Navigate to the app
    await page.goto('/')

    // Wait for app to load
    await page.waitForSelector('#editor')
    await page.waitForFunction(() => window.runtimeAdapter)

    // Set simple Python code that will error (same pattern as debug test)
    const code = `# Line 1
print(z)  # Line 2 - should error and show as line 1`

    await page.evaluate((code) => {
        const editor = document.querySelector('.CodeMirror');
        if (editor && editor.CodeMirror) {
            editor.CodeMirror.setValue(code);
        }
    }, code)

    // Click run button
    await page.click('#run')

    // Wait for execution to complete
    await page.waitForTimeout(3000)

    // Check terminal output
    const terminalContent = await page.evaluate(() => {
        const terminal = document.getElementById('terminal-output')
        return terminal ? terminal.textContent : 'NO TERMINAL'
    })

    console.log('📄 Terminal content:', terminalContent.slice(0, 200))

    // Check if correct line number appears (should be mapped from line ~23 to line 2)
    const hasCorrectLine = terminalContent.includes('line 2')
    const hasWrongLine = terminalContent.includes('line 24') || terminalContent.includes('line 23')

    console.log(`✅ Contains correct line 2: ${hasCorrectLine}`)
    console.log(`❌ Contains wrong line (23/24): ${hasWrongLine}`)

    // The error should show line 2, not the instrumented line
    expect(hasCorrectLine).toBe(true)
    expect(hasWrongLine).toBe(false)
})