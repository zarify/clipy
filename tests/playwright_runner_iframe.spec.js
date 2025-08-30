const { test, expect } = require('./fixtures')

// This spec opens a page with an iframe that loads /tests/runner.html
// The iframe will import the vendored loader; we intercept messages
// and respond to stdinRequest messages with queued values, then assert
// the final testResult contains expected echoed inputs.

async function openRunnerPage(page) {
    await page.goto('http://localhost:8000/tests/runner.html')
}

test('iframe runner handles multiple stdin prompts', async ({ page }) => {
    // Extend timeout for debugging
    test.setTimeout(60000)

    // Capture console and page errors as early as possible (before navigation)
    const pageLogs = []
    page.on('console', async (msg) => {
        try {
            // Try to extract structured arguments when possible
            const args = msg.args && msg.args() ? msg.args() : []
            const vals = []
            for (const a of args) {
                try { vals.push(await a.jsonValue()) } catch (_e) { try { vals.push(String(a)) } catch (_e2) { vals.push('<unserializable>') } }
            }
            pageLogs.push({ t: 'console', level: msg.type(), text: msg.text(), args: vals })
            console.log('[PAGE]', msg.type(), msg.text(), vals.length ? JSON.stringify(vals) : '')
        } catch (_) { }
    })
    page.on('pageerror', (err) => { try { pageLogs.push({ t: 'pageerror', message: err && err.message }); console.log('[PAGEERROR]', err && err.message) } catch (_) { } })
    page.on('requestfailed', (req) => { try { const f = req.failure(); pageLogs.push({ t: 'requestfailed', url: req.url(), reason: f && f.errorText }); console.log('[REQUESTFAILED]', req.url(), f && f.errorText) } catch (_) { } })
    page.on('close', () => { try { console.log('[PAGE] closed') } catch (_) { } })

    // Expose handler before navigation and install an init script that
    // forwards window.postMessage events to the exposed Node function so
    // we don't miss early runner posts.
    const results = { resolved: false, value: null }
    const q = []
    await page.exposeFunction('__node_handle_runner_message', async (m) => {
        try {
            console.log('[NODE] got message', JSON.stringify(m && m.type ? { type: m.type, name: m.name, idx: m.idx } : m))
            if (!m || typeof m !== 'object') return
            if (m.type === 'stdinRequest') {
                const v = (q.length ? q.shift() : '') || ''
                await page.evaluate((val) => { window.postMessage({ type: 'stdinResponse', value: String(val) }, '*') }, v)
            }
            if (m.type === 'ready') {
                await page.evaluate((test) => { window.postMessage({ type: 'runTest', test }, '*') }, { id: 't1', main: "for i in range(10):\n    word = input()\n    print(word)", stdin: q })
            }
            if (m.type === 'testResult') {
                results.resolved = true
                results.value = m
            }
        } catch (e) { console.log('exposed handler error', String(e)) }
    })

    await page.addInitScript(() => {
        window.addEventListener('message', (ev) => {
            try { window.__node_handle_runner_message && window.__node_handle_runner_message(ev.data || {}) } catch (e) { console.error('forward failed', e) }
        })
    })

    // Navigate directly to the lightweight stub runner so we can test
    // messaging/stdio behavior without loading the real wasm runtime.
    await page.goto('http://localhost:8000/tests/runner_stub.html')
    // Wait a short moment for the stub to post 'loaded'
    await page.waitForTimeout(200)

    // Prepare 10 inputs and populate the queue for the exposed handler
    const inputs = []
    for (let i = 0; i < 10; i++) inputs.push('w' + i)
    for (const s of inputs) q.push(s)

    // Install a short message-forwarder in the page that calls the exposed
    // Node function. This doesn't create a long-lived evaluate promise.
    await page.evaluate(() => {
        window.addEventListener('message', (ev) => {
            try { window.__node_handle_runner_message && window.__node_handle_runner_message(ev.data || {}) } catch (e) { console.error('forward failed', e) }
        })
    })

    // Wait for the testResult to be populated by the exposed handler (poll)
    const start = Date.now()
    while (!results.resolved && (Date.now() - start) < 20000) {
        await new Promise(r => setTimeout(r, 100))
    }
    const result = results.value

    expect(result).toBeTruthy()
    expect(result.passed).toBeTruthy()
    for (let i = 0; i < 10; i++) expect(result.stdout).toContain('w' + i)
})
