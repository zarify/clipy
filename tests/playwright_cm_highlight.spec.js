const { test, expect } = require('./fixtures')

test('CodeMirror: manual line highlight sticks', async ({ page }) => {
    // Open the app
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    // Ensure CodeMirror is available
    const hasCM = await page.evaluate(() => {
        const el = document.querySelector('.CodeMirror')
        return !!(el && (el.CodeMirror || window.cm))
    })
    expect(hasCM).toBeTruthy()

    // Populate editor and add an error-style class to a specific line
    await page.evaluate(() => {
        const el = document.querySelector('.CodeMirror')
        const cm = (el && el.CodeMirror) || window.cm
        if (!cm) throw new Error('CodeMirror instance not found')

        // Put a few lines so line 2 exists
        cm.setValue('line0\nline1\nline2\nline3\nline4')

        // Add error-style (background) to line index 2 (third line)
        try {
            cm.addLineClass(2, 'background', 'cm-error-line')
        } catch (e) {
            // Some environments only accept a line handle; try that fallback
            const h = cm.getLineHandle && cm.getLineHandle(2)
            if (h && cm.addLineClass) cm.addLineClass(h, 'background', 'cm-error-line')
        }

        // Force a refresh so DOM updates are applied
        if (typeof cm.refresh === 'function') cm.refresh()
    })

    // Wait for the DOM to reflect the class
    await page.waitForFunction(() => !!document.querySelector('.CodeMirror .cm-error-line'), { timeout: 2000 })

    // Read back and assert the class exists
    const present = await page.evaluate(() => !!document.querySelector('.CodeMirror .cm-error-line'))
    expect(present).toBeTruthy()

    // Wait a bit and re-check to ensure the class persists
    await page.waitForTimeout(300)
    const stillPresent = await page.evaluate(() => !!document.querySelector('.CodeMirror .cm-error-line'))
    expect(stillPresent).toBeTruthy()
})
