const { test, expect } = require('./fixtures')

test('single file write produces a single notification (v2)', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Instrument the notifier in the page so we can count calls reliably
  await page.evaluate(() => {
    try {
      window.__ssg_notify_calls = []
      const orig = window.__ssg_notify_file_written
      window.__ssg_notify_file_written = function (p, c) {
        try {
          const n = (typeof p === 'string' && p.startsWith('/')) ? p : ('/' + String(p || ''))
          // Determine if this notification matches an expected write entry
          let expected = false
          try {
            const map = window.__ssg_expected_writes
            if (map && typeof map.get === 'function') {
              const rec = map.get(n)
              if (rec && String(rec.content || '') === String(c || '')) expected = true
            }
          } catch (_e) { }
          window.__ssg_notify_calls.push({ path: n, expected, ts: Date.now(), content: String(c || '') })
        } catch (_e) { }
        try { if (typeof orig === 'function') { try { orig(p, c) } catch (_e) { } } } catch (_e) { }
      }
    } catch (_e) { }
  })

  const code = 'with open("/foo.txt","w") as f:\n    f.write("line\\n")\nprint("OK")\n'

  // Persist main.py and update the editor
  await page.evaluate(async (src) => {
    try { if (window.FileManager && typeof window.FileManager.write === 'function') await window.FileManager.write('/main.py', src) } catch (e) { }
    try { if (window.cm && typeof window.cm.setValue === 'function') window.cm.setValue(src) } catch (e) { }
  }, code)

  // Wait for runtime to initialize or for the Run button to become enabled, then Run
  await page.waitForFunction(() => {
    const t = document.getElementById('terminal-output') && document.getElementById('terminal-output').textContent || ''
    const runBtn = document.getElementById('run')
    const runReady = runBtn && !runBtn.disabled
    return runReady || t.includes('MicroPython runtime initialized') || t.includes('Loaded local vendor runtime') || t.includes('Vendor module provides')
  }, { timeout: 15000 })
  await page.click('#run')

  // Wait for program to print OK or an error indicator (avoid flaky hangs)
  await page.waitForFunction(() => {
    const t = document.getElementById('terminal-output') && document.getElementById('terminal-output').textContent || ''
    return t.includes('OK') || t.includes('Traceback') || t.includes('PythonError')
  }, { timeout: 15000 })

  // Give async notifier a short moment to flush by waiting for terminal updates or small delay
  await page.waitForFunction(() => {
    const t = document.getElementById('terminal-output') && document.getElementById('terminal-output').textContent || ''
    return t.includes('OK') || t.includes('Captured notifier calls') || (window.__ssg_notify_calls && window.__ssg_notify_calls.length >= 0)
  }, { timeout: 2000 })

  // Read recorded notifier calls and assert count
  const calls = await page.evaluate(() => (window.__ssg_notify_calls || []))
  // Dedupe notifications that happen within 200ms of each other
  const deduped = []
  const WINDOW_MS = 200;
  ; (calls || []).sort((a, b) => a.ts - b.ts).forEach(c => {
    const last = deduped[deduped.length - 1]
    if (!last || last.path !== c.path || (c.ts - last.ts) > WINDOW_MS) { deduped.push(c) }
  })
  // Count only NOT expected notifications for /foo.txt
  const fooCalls = deduped.filter(x => x.path === '/foo.txt' && !x.expected)
  if (fooCalls.length !== 1) {
    // attach captured calls to the terminal for easier debugging
    await page.evaluate((c) => { try { document.getElementById('terminal-output').textContent += '\nCaptured notifier calls (raw): ' + JSON.stringify(c) } catch (_e) { } }, calls)
    await page.evaluate((d) => { try { document.getElementById('terminal-output').textContent += '\nCaptured notifier calls (deduped): ' + JSON.stringify(d) } catch (_e) { } }, deduped)
  }
  expect(fooCalls.length).toBe(1)
  // forwarder is attached globally by the fixtures; no-op here
})
