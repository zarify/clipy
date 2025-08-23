const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('http://localhost:8000', { waitUntil: 'load', timeout: 15000 });
        // wait for transform helper
        await page.waitForFunction(() => !!window.__ssg_transform, { timeout: 10000 });
        // small snippet that previously failed
        const src = `i = 10\nif i > 5:\n    line = input("Line: ")\n    print("We got here!")\nelse:\n    print("should not be reached")`;
        const transformed = await page.evaluate((s) => window.__ssg_transform(s).code, src);
        console.log('--- TRANSFORMED ---');
        console.log(transformed);

        // wait for runtime run helper
        const hasRun = await page.waitForFunction(() => !!window.__ssg_run, { timeout: 10000 }).catch(() => false);
        if (!hasRun) {
            console.error('no run helper available on the page');
            await browser.close();
            process.exit(2);
        }

        // try to run transformed code and capture result or error
        const result = await page.evaluate(async (t) => {
            try {
                const out = await window.__ssg_run(t);
                return { ok: true, out: out };
            } catch (e) {
                try {
                    // If the runtime error object has a stack or message, include it
                    return { ok: false, err: e && (e.stack || e.message || String(e)) };
                } catch (_e) { return { ok: false, err: String(e) } }
            }
        }, transformed);

        console.log('--- RUN RESULT ---');
        console.log(JSON.stringify(result, null, 2));
        await browser.close();
        process.exit(result.ok ? 0 : 1);
    } catch (e) {
        console.error('script error', e);
        try { await browser.close(); } catch (_e) { }
        process.exit(3);
    }
})();
