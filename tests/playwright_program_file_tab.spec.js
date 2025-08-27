const { test, expect } = require('./fixtures')

test('program creates file and UI opens a tab for it', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  const code = `with open("bar.txt", "w") as f:\n    f.write("this is bar\\n")\nprint("OK")\n`

  // Write program into persistent FileManager as /main.py and update the editor
  await page.evaluate(async (src) => {
    try { if (window.FileManager && typeof window.FileManager.write === 'function') await window.FileManager.write('/main.py', src) } catch (e) { }
    try { if (window.cm && typeof window.cm.setValue === 'function') window.cm.setValue(src) } catch (e) { }
  }, code)

  // Run the program
  await page.click('#run')

  // Wait for program output to indicate it ran
  // Wait for a deterministic run-complete signal set by the app, or for the terminal to show 'OK' as a fallback
  await page.waitForFunction(() => {
    try {
      if (window.__ssg_last_run) return true
    } catch (_e) { }
    try {
      const t = document.getElementById('terminal-output')
      return Boolean(t && t.textContent && t.textContent.includes('OK'))
    } catch (_e) { }
    return false
  }, { timeout: 7000 })

  // Force a backend sync from the runtime FS if possible, then reload backend files
  await page.evaluate(async () => {
    try {
      const backend = window.__ssg_vfs_backend
      const fs = window.__ssg_runtime_fs
      if (backend && fs && typeof backend.syncFromEmscripten === 'function') {
        await backend.syncFromEmscripten(fs)
        try { if (typeof reloadFilesFromBackend === 'function') await reloadFilesFromBackend(backend) } catch (_e) { }
      }
    } catch (_e) { }
  })

  // Poll for backend or FileManager to show the created file (allow small delay for VFS sync)
  const gotFile = await page.waitForFunction(async () => {
    try {
      if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') {
        const v = await window.__ssg_vfs_backend.read('/bar.txt')
        if (v) return true
      }
    } catch (_e) { }
    try { if (window.FileManager && typeof window.FileManager.list === 'function') { const l = window.FileManager.list(); if (l && l.includes('/bar.txt')) return true } } catch (_e) { }
    return false
  }, { timeout: 2000 })

  // allow slightly more time for VFS sync in CI
  await new Promise(r => setTimeout(r, 150))

  expect(gotFile).toBeTruthy()

  // Finally assert that the UI opened a tab labeled 'bar.txt'
  const tabs = await page.$$eval('#tabs-left .tab-label', els => els.map(e => e.textContent))
  if (!tabs.includes('bar.txt')) {
    const debug = await page.evaluate(() => {
      const memKeys = Object.keys(window.mem || {})
      let mapKeys = []
      try { mapKeys = Object.keys(JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')) } catch (_e) { }
      const term = document.getElementById('terminal-output') ? document.getElementById('terminal-output').textContent : null
      const runtimeFs = window.__ssg_runtime_fs
      let runtimeRead = null
      try {
        if (runtimeFs) {
          const attempts = ['/bar.txt', 'bar.txt']
          for (const p of attempts) {
            try {
              if (typeof runtimeFs.readFile === 'function') {
                const v = runtimeFs.readFile(p)
                if (v) { runtimeRead = (typeof v === 'string') ? v : (new TextDecoder().decode(v)); break }
              } else if (typeof runtimeFs.readFileSync === 'function') {
                const v = runtimeFs.readFileSync(p)
                if (v) { runtimeRead = (typeof v === 'string') ? v : (new TextDecoder().decode(v)); break }
              }
            } catch (_e) { }
          }
        }
      } catch (_e) { }
      return { memKeys, mapKeys, pendingTabs: window.__ssg_pending_tabs || [], tabList: (window.TabManager && window.TabManager.list ? window.TabManager.list() : null), terminal: term, runtimeRead }
    })
    throw new Error('Tab missing; debug: ' + JSON.stringify(debug))
  }
})
