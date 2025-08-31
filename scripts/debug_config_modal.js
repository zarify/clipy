const { firefox } = require('playwright');

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    const APP = 'http://localhost:8000';

    const authorCfg = {
        id: 'playwright-author-test',
        version: '2.5',
        title: 'Playwright Author Config',
        description: 'A config used to test author loading',
        starter: "print('starter-run')",
        instructions: '# Hello\n\nThis is a **markdown** instruction.\n\n```python\nprint(1)\n```',
        files: {
            '/main.py': "print('starter-run')",
            '/lib/util.py': "def helper():\n    return 42"
        }
    };

    console.log('Going to', APP);
    await page.goto(APP);
    await page.waitForSelector('#editor-host');
    // Set localStorage and reload
    // Instrument FileManager.write early so we capture writes during config load
    await page.evaluate(() => {
        try {
            window.__test_writes = []
            const fm = window.FileManager
            if (fm && typeof fm.write === 'function') {
                const orig = fm.write.bind(fm)
                fm.write = async function (p, content) {
                    try { window.__test_writes.push([p, String(content || '')]) } catch (_e) { }
                    try { return await orig(p, content) } catch (e) {
                        try { window.__test_writes.push([p, 'write-error:' + String(e && e.message ? e.message : e)]) } catch (_e) { }
                        throw e
                    }
                }
            }
        } catch (_e) { }
    })

    // Set localStorage and reload
    await page.evaluate((cfg) => {
        localStorage.setItem('author_config', JSON.stringify(cfg));
    }, authorCfg);
    await page.reload();
    await page.waitForSelector('#editor-host');

    // Click the header to open config modal
    const hasHeader = await page.$('.config-info');
    console.log('.config-info present?', !!hasHeader);
    if (hasHeader) await page.click('.config-info');

    // Wait briefly for modal
    await page.waitForTimeout(1000);

    const authorBtn = await page.$('.config-author-section button');
    console.log('.config-author-section button present?', !!authorBtn);

    const authorSectionHTML = await page.$eval('.config-author-section', el => el.innerHTML).catch(e => null);
    console.log('authorSectionHTML:', authorSectionHTML ? authorSectionHTML.slice(0, 800) : 'null');

    if (authorBtn) {
        // Instrument FileManager.write to capture attempted writes for debugging
        await page.evaluate(() => {
            try {
                window.__test_writes = []
                const fm = window.FileManager
                if (fm && typeof fm.write === 'function') {
                    const orig = fm.write.bind(fm)
                    fm.write = async function (p, content) {
                        try { window.__test_writes.push([p, String(content || '')]) } catch (_e) { }
                        try { return await orig(p, content) } catch (e) {
                            try { window.__test_writes.push([p, 'write-error:' + String(e && e.message ? e.message : e)]) } catch (_e) { }
                            throw e
                        }
                    }
                }
            } catch (_e) { }
        })
        console.log('Clicking the author load button...')
        await authorBtn.click()
        // wait for the app to apply the author config
        try {
            await page.waitForFunction(() => window.Config && window.Config.current && window.Config.current.id === 'playwright-author-test', { timeout: 3000 })
            console.log('Config applied')
        } catch (e) {
            console.log('Config not applied within timeout')
        }
        // give FileManager a moment to flush writes
        await page.waitForTimeout(300)
    }

    // dump any global FileManager or TabManager hints
    const fmInfo = await page.evaluate(async () => {
        const out = { hasFileManager: !!window.FileManager };
        try {
            out.fileManagerList = window.FileManager && window.FileManager.list ? window.FileManager.list() : null;
            if (out.fileManagerList && window.FileManager && typeof window.FileManager.read === 'function') {
                out.fileContents = {}
                for (const p of out.fileManagerList) {
                    try { out.fileContents[p] = await window.FileManager.read(p) } catch (e) { out.fileContents[p] = 'read-err' }
                }
            }
        } catch (e) { out.fileManagerList = 'err' }
        out.hasTabManager = !!window.TabManager;
        try { out.tabManagerFM = window.TabManager && window.TabManager.getFileManager ? !!window.TabManager.getFileManager() : null } catch (e) { out.tabManagerFM = 'err' }
        out.configCurrent = window.Config && window.Config.current ? window.Config.current.id + '@' + (window.Config.current.version || '') : null
        return out
    });
    console.log('fmInfo:', fmInfo);

    await browser.close();
})();
