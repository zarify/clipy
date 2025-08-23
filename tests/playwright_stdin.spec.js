const { test, expect } = require('./fixtures')

// Note: Requires static server at http://localhost:8000

// Helper: open the playground and ensure editor is ready
async function openPage(page) {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')
}

test.describe('stdin inline prompt behavior', () => {
    test('Should not be able to enter text on page load', async ({ page }) => {
        await openPage(page)
        // Ensure the terminal input exists and is disabled
        const isDisabled = await page.$eval('#stdin-box', el => el.disabled)
        expect(isDisabled).toBeTruthy()
    })

    test('Stdin focused and usable when program requests input', async ({ page }) => {
        await openPage(page)

        // Put a simple program into main.py that asks for a name and prints a greeting
        await page.evaluate(() => {
            const src = `name = input('Your name:')\nprint('Hello ' + name)`
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave to complete
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: 2000 })

        // Click run
        await page.click('#run')
        // Wait for host.get_input to enable the input
        await page.waitForFunction(() => {
            const b = document.getElementById('stdin-box')
            return b && !b.disabled
        }, { timeout: 2000 })

        // The stdin box should be enabled and focused
        const enabled = await page.$eval('#stdin-box', el => !el.disabled)
        expect(enabled).toBeTruthy()
        const isFocused = await page.evaluate(() => document.activeElement === document.getElementById('stdin-box'))
        expect(isFocused).toBeTruthy()

        // Type a name and submit via Enter
        await page.type('#stdin-box', 'Alice')
        await page.keyboard.press('Enter')

        // Wait until terminal prints the greeting
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('Hello Alice') !== -1
        }, { timeout: 2000 })
        const terminalText = await page.$eval('#terminal-output', el => el.textContent)
        expect(terminalText).toContain('Hello Alice')
    })

    test('Should not be able to enter text after program finishes', async ({ page }) => {
        await openPage(page)

        // Reuse the same program that asks for name
        await page.evaluate(() => {
            const src = `name = input('Your name:')\nprint('Bye ' + name)`
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: 2000 })

        await page.click('#run')
        await page.waitForFunction(() => {
            const b = document.getElementById('stdin-box')
            return b && !b.disabled
        }, { timeout: 2000 })

        // ensure input is enabled now
        const enabledNow = await page.$eval('#stdin-box', el => !el.disabled)
        expect(enabledNow).toBeTruthy()

        // Submit input
        await page.type('#stdin-box', 'Bob')
        await page.keyboard.press('Enter')

        // Wait for terminal to show the bye message and run to finish
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('Bye Bob') !== -1
        }, { timeout: 3000 })
        const enabledAfter = await page.$eval('#stdin-box', el => !el.disabled)
        expect(enabledAfter).toBeFalsy()
    })
})
