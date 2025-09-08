const { test } = require('./fixtures')

test('traceback instrument', async ({ page }) => {
    await page.goto('http://localhost:8000')
    await page.waitForSelector('#editor-host')

    await page.evaluate(() => {
        if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py')
        const code = `def foo():\n    return 1\n\nfoo()\nbar()\n`
        if (window.cm) window.cm.setValue(code)
        else if (document.querySelector('.CodeMirror')?.CodeMirror) document.querySelector('.CodeMirror').CodeMirror.setValue(code)
        else document.getElementById('code').value = code
    })

    await page.click('#run')

    // wait for some terminal output or timeout
    await page.waitForTimeout(1000)

    const log = await page.evaluate(() => window.__ssg_terminal_event_log || [])
    console.log('TERMINAL EVENT LOG:')
    for (const e of log) console.log(JSON.stringify(e))

    const term = await page.evaluate(() => document.getElementById('terminal-output')?.innerText || '')
    console.log('\nTERMINAL SNAPSHOT:\n' + term)
})
