const pw = require('playwright');
(async () => {
    const browser = await pw['firefox'].launch({ headless: false });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', async (msg) => {
        const args = msg.args ? await Promise.all(msg.args().map(a => a.jsonValue().catch(() => String(a)))) : [];
        logs.push({ type: 'console', level: msg.type(), text: msg.text(), args });
        console.log('[PAGE]', msg.type(), msg.text(), args.length ? JSON.stringify(args) : '');
    });
    page.on('pageerror', (err) => { logs.push({ type: 'pageerror', message: err && err.message }); console.log('[PAGEERROR]', err && err.message); });
    page.on('requestfailed', (req) => { const f = req.failure(); logs.push({ type: 'requestfailed', url: req.url(), reason: f && f.errorText }); console.log('[REQUESTFAILED]', req.url(), f && f.errorText); });
    page.on('close', () => { logs.push({ type: 'close' }); console.log('[PAGE] closed'); });

    console.log('navigating...');
    await page.goto('http://localhost:8000/tests/runner_stub.html');
    console.log('navigated');
    // wait 10s to capture activity
    await new Promise(r => setTimeout(r, 10000));
    console.log('done waiting, logs:');
    console.log(JSON.stringify(logs, null, 2));
    await browser.close();
})();
