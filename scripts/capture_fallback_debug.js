const { firefox } = require('playwright');

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE_CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));

    await page.goto('http://localhost:8000');
    await page.waitForSelector('#editor-host');

    const src = `if True:\n    line = input("What? ")\n    print(line)\nelse:\n    print("Never get here")`;
    await page.evaluate((s) => {
        if (window.cm) window.cm.setValue(s)
        else document.getElementById('code').value = s
    }, src);

    // wait for autosave
    await page.waitForFunction(() => {
        const el = document.getElementById('autosave-indicator')
        return el && el.textContent && el.textContent.indexOf('Saved') !== -1
    }, { timeout: 2000 })

    await page.click('#run')

    // wait up to 5s for stdin to enable; if not, we'll capture diagnostics
    let enabled = false
    try {
        await page.waitForFunction(() => { const b = document.getElementById('stdin-box'); return b && !b.disabled }, { timeout: 5000 })
        enabled = true
    } catch (e) { enabled = false }

    // Submit blank if enabled
    if (enabled) {
        await page.evaluate(() => { const b = document.getElementById('stdin-box'); if (b) b.value = ''; const f = document.getElementById('terminal-input-form'); if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })
    } else {
        console.log('stdin not enabled within timeout')
    }

    // allow a bit of time for fallback processing
    await page.waitForTimeout(800)

    const diagnostics = await page.evaluate(() => {
        return {
            terminal: document.getElementById('terminal-output') ? document.getElementById('terminal-output').textContent : null,
            fallbackLogs: window.__ssg_fallback_logs || null,
            pendingInput: window.__ssg_pending_input || null,
            transform: (typeof window.__ssg_transform === 'function') ? (window.__ssg_transform(document.getElementById('code')?.value || '') || null) : null,
            hasRunHelper: !!window.__ssg_run,
            vfsReady: !!window.__ssg_vfs_ready,
            memKeys: (window.mem) ? Object.keys(window.mem || {}) : null,
            runtimeGlobal: !!window.__ssg_runtime,
            runtimeFs: !!window.__ssg_runtime_fs
        }
    })

    console.log('DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2))

    await browser.close();
})();
