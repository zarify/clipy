const { chromium, firefox, webkit } = require('playwright');

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:8000');
    await page.waitForSelector('#editor-host');

    // set walrus program
    await page.evaluate(() => {
        const src = `if line := input("what? "):\n    print(f"Your line was: {line}")\nelse:\n    print("no line!")`;
        if (window.cm) window.cm.setValue(src)
        else document.getElementById('code').value = src
    });
    // wait for autosave
    await page.waitForFunction(() => {
        const el = document.getElementById('autosave-indicator')
        return el && el.textContent && el.textContent.indexOf('Saved') !== -1
    }, { timeout: 2000 })

    await page.click('#run')
    await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: 2000 })

    // Submit blank
    await page.evaluate(() => { const b = document.getElementById('stdin-box'); if (b) b.value = ''; const f = document.getElementById('terminal-input-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })

    // wait a short while to let fallback logs populate
    await page.waitForTimeout(500)

    const logs = await page.evaluate(() => window.__ssg_fallback_logs || [])
    const terminal = await page.$eval('#terminal-output', el => el.textContent)
    console.log('FALLBACK_LOGS:', JSON.stringify(logs, null, 2))
    console.log('TERMINAL_TEXT:', terminal)

    await browser.close();
})();
