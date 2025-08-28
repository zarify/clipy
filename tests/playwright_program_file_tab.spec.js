const { test, expect } = require('./fixtures')

test('program creates file and UI opens a tab for it', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  const code = `with open("bar.txt", "w") as f:\n    f.write("this is bar\\n")\nprint("OK")\n`

  // Persist program in backend and set editor value
  await page.evaluate(async (src) => {
    try { if (window.FileManager && typeof window.FileManager.write === 'function') await window.FileManager.write('/main.py', src) } catch (e) { }
    try { if (window.cm && typeof window.cm.setValue === 'function') window.cm.setValue(src) } catch (e) { }
  }, code)

  // Run the program
  await page.click('#run')

  // Wait for program to emit OK
  await page.waitForFunction(() => document.getElementById('terminal-output') && document.getElementById('terminal-output').textContent.includes('OK'), { timeout: 5000 })

  // Allow VFS sync and prefer helper waitForFile if available
  const gotFile = await page.evaluate(async () => {
    try {
      if (typeof window.waitForFile === 'function') {
        const v = await window.waitForFile('/bar.txt', 4000).catch(() => null)
        return v != null
      }
    } catch (_) { }
    try { if (window.FileManager && typeof window.FileManager.list === 'function') { const l = window.FileManager.list(); if (l && l.includes('/bar.txt')) return true } } catch (_) { }
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') { const v = await window.__ssg_vfs_backend.read('/bar.txt'); return Boolean(v) } } catch (_) { }
    return false
  })

  expect(gotFile).toBeTruthy()

  // Wait for UI to open a tab for /bar.txt. Prefer deterministic global emitted when tab opens.
  await page.waitForFunction(() => {
    try { if (window.__ssg_last_tab_opened && window.__ssg_last_tab_opened.path) return window.__ssg_last_tab_opened.path === '/bar.txt' || window.__ssg_last_tab_opened.path === 'bar.txt' } catch (_) { }
    try { if (window.TabManager && typeof window.TabManager.list === 'function') return (window.TabManager.list() || []).some(p => p === '/bar.txt' || p === 'bar.txt') } catch (_) { }
    return false
  }, { timeout: 4000 })

  const tabs = await page.$$eval('#tabs-left .tab-label', els => els.map(e => e.textContent?.trim()))
  expect(tabs).toContain('bar.txt')
})
