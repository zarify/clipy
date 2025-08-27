const { test, expect } = require('./fixtures')

// Note: Requires static server at http://localhost:8000

// Helper: open the playground and ensure editor is ready
async function openPage(page) {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')
}

// Return a timeout value that is longer when IndexedDB is unavailable
async function getTimeout(page, fast = 2000, slow = 8000) {
    try {
        const disabled = await page.evaluate(() => (typeof window.indexedDB === 'undefined' || !window.indexedDB))
        return disabled ? slow : fast
    } catch (e) {
        return fast
    }
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
        // Wait for autosave to complete (use a longer timeout if storage is disabled)
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: await getTimeout(page, 2000, 8000) })

        // Click run
        await page.click('#run')
        // Wait for host.get_input to enable the input
        await page.waitForFunction(() => {
            const b = document.getElementById('stdin-box')
            return b && !b.disabled
        }, { timeout: await getTimeout(page, 2000, 12000) })

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
        }, { timeout: await getTimeout(page, 2000, 8000) })
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
        }, { timeout: await getTimeout(page, 2000, 8000) })

        await page.click('#run')
        await page.waitForFunction(() => {
            const b = document.getElementById('stdin-box')
            return b && !b.disabled
        }, { timeout: await getTimeout(page, 2000, 12000) })

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
        }, { timeout: await getTimeout(page, 3000, 10000) })
        const enabledAfter = await page.$eval('#stdin-box', el => !el.disabled)
        expect(enabledAfter).toBeFalsy()
    })

    test('Walrus operator input: blank vs provided', async ({ page }) => {
        await openPage(page)

        // Program using walrus operator to capture input in condition
        await page.evaluate(() => {
            const src = `if line := input("what? "):\n    print(f"Your line was: {line}")\nelse:\n    print("no line!")`
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: await getTimeout(page, 2000, 8000) })

        // Scenario A: blank input -> expect 'no line!'
        await page.click('#run')
        await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: await getTimeout(page, 2000, 12000) })
        await page.evaluate(() => { const b = document.getElementById('stdin-box'); if (b) b.value = ''; const f = document.getElementById('terminal-input-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('no line!') !== -1
        }, { timeout: await getTimeout(page, 5000, 15000) })

        // Scenario B: provide a value
        await page.evaluate(() => {
            const src = `if line := input("what? "):\n    print(f"Your line was: {line}")\nelse:\n    print("no line!")`
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: await getTimeout(page, 2000, 8000) })

        await page.click('#run')
        await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: await getTimeout(page, 2000, 12000) })
        await page.type('#stdin-box', 'hello')
        await page.keyboard.press('Enter')
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('Your line was: hello') !== -1
        }, { timeout: 5000 })
    })

    test('Can submit a blank line and program accepts it', async ({ page }) => {
        await openPage(page)

        // Program: single input, then print OK
        await page.evaluate(() => {
            const src = `_ = input('>')\nprint('GOT:' + (_ or ''))`
            // fallback for different editor setups
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: 2000 })

        await page.click('#run')
        await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: 2000 })
        // Submit blank explicitly via form dispatch
        await page.evaluate(() => { const b = document.getElementById('stdin-box'); if (b) b.value = ''; const f = document.getElementById('terminal-input-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })

        // Expect the program to print GOT:
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('GOT:') !== -1
        }, { timeout: await getTimeout(page, 3000, 10000) })
    })

    test('Inspect transformed code for mixed-indentation input snippet', async ({ page }) => {
        await openPage(page)
        const src = `i = 10\nif i > 5:\n\tline = input("what? ")\n    print(f"Your line was: {line}")\nelse:\n    print("should not be reached")`
        // Ask the page to transform the code and return it for inspection
        const transformed = await page.evaluate((s) => {
            try {
                if (window.__ssg_transform) return window.__ssg_transform(s).code
            } catch (e) { return 'TRANSFORM_ERROR: ' + String(e) }
            return 'NO_TRANSFORM_AVAILABLE'
        }, src)
        // Make sure the transform replaced input() with await host.get_input
        expect(transformed).toContain('await host.get_input')
        // Print the transformed code into the terminal output so we can see it in logs
        await page.evaluate((t) => { try { const out = document.getElementById('terminal-output'); const div = document.createElement('div'); div.className = 'terminal-line term-runtime'; div.textContent = t; out.appendChild(div) } catch (_e) { } }, transformed)
    })

    test('Run transformed snippet and return raw error', async ({ page }) => {
        await openPage(page)
        const src = `i = 10\nif i > 5:\n    line = input("Line: ")\n    print("We got here!")\nelse:\n    print("should not be reached")`
        const transformed = await page.evaluate((s) => { return window.__ssg_transform ? window.__ssg_transform(s).code : 'NO_TRANSFORM' }, src)
        const result = await page.evaluate(async (t) => {
            try {
                if (!window.__ssg_run) return { ok: false, err: 'NO_RUN_HELPER' }
                const out = await window.__ssg_run(t)
                return { ok: true, out }
            } catch (e) {
                return { ok: false, err: String(e) }
            }
        }, transformed)
        // Append result to terminal for visibility
        await page.evaluate((r) => { const out = document.getElementById('terminal-output'); const d = document.createElement('div'); d.className = 'terminal-line term-runtime'; d.textContent = JSON.stringify(r); out.appendChild(d) }, result)
        // Fail the test if execution reported success (we expected an error for the snippet)
        expect(result.ok).toBeFalsy()
    })

    test('While-loop: blank first input ends program; single input then blank exits', async ({ page }) => {
        await openPage(page)

        // Program: read line, while line: print and ask again
        await page.evaluate(() => {
            const src = 'line = input("What? ")\nwhile line:\n    print(f"Line: {line}")\n    line = input("Now what? ")\nprint("OK done")'
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: await getTimeout(page, 2000, 8000) })

        // Scenario A: submit blank line at first prompt -> program should end with 'OK done'
        await page.click('#run')
        await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: await getTimeout(page, 2000, 12000) })
        // Ensure stdin box is focused and submit blank
        // Submit blank by dispatching the form submit event to ensure empty value is handled
        await page.evaluate(() => { const b = document.getElementById('stdin-box'); if (b) b.value = ''; const f = document.getElementById('terminal-input-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('OK done') !== -1
        }, { timeout: 5000 })

        // Scenario B: run again, submit 'hi' then blank, expect Line: hi then OK done
        await page.evaluate(() => {
            const src = 'line = input("What? ")\nwhile line:\n    print(f"Line: {line}")\n    line = input("Now what? ")\nprint("OK done")'
            if (window.cm) window.cm.setValue(src)
            else document.getElementById('code').value = src
        })
        // Wait for autosave
        await page.waitForFunction(() => {
            const el = document.getElementById('autosave-indicator')
            return el && el.textContent && el.textContent.indexOf('Saved') !== -1
        }, { timeout: 2000 })

        await page.click('#run')
        await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: 2000 })
        // Type 'hi' and submit
        await page.type('#stdin-box', 'hi')
        await page.press('#stdin-box', 'Enter')
        // Wait for second prompt to appear (Now what?) and be enabled
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('Line: hi') !== -1 && document.getElementById('stdin-box') && !document.getElementById('stdin-box').disabled
        }, { timeout: 2000 })
        // Ensure stdin box is focused and submit blank
        // Submit blank by dispatching the form submit event to ensure empty value is handled
        await page.evaluate(() => { const b = document.getElementById('stdin-box'); if (b) b.value = ''; const f = document.getElementById('terminal-input-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })
        // Wait for OK done and the Line output present
        await page.waitForFunction(() => {
            const t = document.getElementById('terminal-output')
            return t && t.textContent && t.textContent.indexOf('Line: hi') !== -1 && t.textContent.indexOf('OK done') !== -1
        }, { timeout: 5000 })
    })
})
