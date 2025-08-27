const { test, expect } = require('./fixtures')

// Restore a snapshot and run /main.py to ensure the interpreter FS is populated
test('restore snapshot then run main.py and observe output', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Prepare files and save a snapshot with a known output
  await page.evaluate(async () => {
    try { if (window.FileManager) await window.FileManager.write('/main.py', 'print("SNAPSHOT-RUN-OK")') } catch (e) { }
    try { if (window.FileManager) await window.FileManager.write('/helper.txt', 'snapshot-helper') } catch (e) { }
  })
  await page.click('#save-snapshot')
  // wait for snapshot to be stored (autosave writes to localStorage)
  await page.waitForFunction(() => {
    if (!window.Config) return false
    const configKey = window.Config.getConfigKey()
    return Boolean(localStorage.getItem(configKey))
  }, { timeout: 2000 })

  // Clear current backend/mem to simulate fresh state
  await page.evaluate(async () => {
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.list === 'function') { const names = await window.__ssg_vfs_backend.list(); for (const n of names) await window.__ssg_vfs_backend.delete(n) } } catch (e) { }
    try { if (window.FileManager && typeof window.FileManager.list === 'function') { const names = window.FileManager.list(); for (const n of names) await window.FileManager.delete(n) } } catch (e) { }
  })

  // Restore snapshot via UI
  await page.click('#history')
  await page.waitForSelector('#snapshot-list')
  await page.evaluate(() => { const btn = document.querySelector('#snapshot-list .snapshot-item button'); if (btn) btn.click() })
  // wait for snapshot restore to finish (signaled by global flag)
  await page.waitForFunction(() => Boolean(window.__ssg_last_snapshot_restore), { timeout: 2000 })

  // Now run the program
  await page.click('#run')

  // Wait for terminal to include the marker
  await page.waitForFunction(() => document.getElementById('terminal-output') && document.getElementById('terminal-output').textContent.includes('SNAPSHOT-RUN-OK'), { timeout: 3000 })
  const out = await page.$eval('#terminal-output', el => el.textContent)
  expect(out).toContain('SNAPSHOT-RUN-OK')
})
