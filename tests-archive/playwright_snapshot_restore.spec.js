const { test, expect } = require('./fixtures')

// Snapshot restore should write all files into backend and open only main.py
test('snapshot restore populates FS and focuses main.py', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Prepare files and save a snapshot
  await page.evaluate(async () => {
    try { if (window.FileManager) await window.FileManager.write('/main.py', 'print("from main")') } catch (e) { }
    try { if (window.FileManager) await window.FileManager.write('/foo.txt', 'snapshot-file') } catch (e) { }
  })
  // Trigger save and wait for the test-visible signal that save completed
  await page.click('#save-snapshot')
  await page.waitForFunction(() => Boolean(window.__ssg_snapshot_saved), { timeout: 15000 })

  // wait for snapshot persistence. Some browsers may not set deterministic
  // globals consistently; open the history modal and wait for at least one
  // `.snapshot-item` to appear.
  await page.click('#history')
  // Wait longer for the modal and snapshot list to populate on slower CI
  await page.waitForSelector('#snapshot-modal', { state: 'visible', timeout: 15000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('#snapshot-list')
    if (!el) return false
    const txt = (el.textContent || '').toLowerCase()
    if (txt.indexOf('(loading)') !== -1) return false
    return el.querySelectorAll('.snapshot-item').length > 0
  }, { timeout: 15000 })

  // Clear current backend/mem to simulate fresh state
  await page.evaluate(async () => {
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.delete === 'function') { const names = await window.__ssg_vfs_backend.list(); for (const n of names) await window.__ssg_vfs_backend.delete(n) } } catch (e) { }
    try { if (window.FileManager && typeof window.FileManager.list === 'function') { const names = window.FileManager.list(); for (const n of names) await window.FileManager.delete(n) } } catch (e) { }
  })

  // Restore snapshot via UI
  // Ensure the snapshot modal is open (don't click history if it's already open)
  const modalOpen = await page.evaluate(() => {
    const m = document.querySelector('#snapshot-modal')
    return !!(m && m.getAttribute('aria-hidden') === 'false')
  })
  if (!modalOpen) {
    try {
      await page.click('#history')
    } catch (e) {
      await page.locator('#history').click({ force: true })
    }
    await page.waitForSelector('#snapshot-modal', { state: 'visible', timeout: 10000 })
  }

  await page.waitForSelector('#snapshot-list')
  // Click the first snapshot's load/restore button; prefer an explicit
  // load button selector (aria-label or class) to avoid hitting delete.
  const restoreBtn = page.locator('#snapshot-list .snapshot-item button[aria-label="Load snapshot"]').first()
  // Fallback if aria-label isn't present
  const restoreBtnExists = await restoreBtn.count()
  const finalRestore = restoreBtnExists ? restoreBtn : page.locator('#snapshot-list .snapshot-item .snapshot-load-btn').first()
  try {
    await finalRestore.click()
  } catch (e) {
    await finalRestore.click({ force: true })
  }

  // wait for snapshot restore to finish (signaled by global flag)
  await page.waitForFunction(() => Boolean(window.__ssg_last_snapshot_restore), { timeout: 15000 })

  // Prefer the helper waitForFile if available to ensure foo.txt exists after restore
  const fooVal = await page.evaluate(async () => {
    try { if (typeof window.waitForFile === 'function') return await window.waitForFile('/foo.txt', 10000) } catch (_e) { }
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') return await window.__ssg_vfs_backend.read('/foo.txt') } catch (_e) { }
    try { if (window.FileManager && typeof window.FileManager.read === 'function') return window.FileManager.read('/foo.txt') } catch (_e) { }
    return null
  })
  expect(fooVal).toBe('snapshot-file')

  // Assert that main.py tab is present and focused. Prefer TabManager signals if available.
  await page.waitForFunction(() => {
    try { if (window.TabManager && typeof window.TabManager.list === 'function') return (window.TabManager.list() || []).some(p => p === '/main.py' || p === 'main.py') } catch (_) { }
    const tabs = Array.from(document.querySelectorAll('#tabs-left .tab-label')).map(n => n.textContent && n.textContent.trim())
    return tabs.includes('main.py')
  }, { timeout: 8000 })

  const active = await page.evaluate(() => {
    try { if (window.TabManager && typeof window.TabManager.getActive === 'function') return window.TabManager.getActive() } catch (_e) { }
    try { const el = document.querySelector('#tabs-left .tab.active .tab-label'); return el ? el.textContent && el.textContent.trim() : null } catch (_e) { }
    return null
  })
  expect(active === '/main.py' || active === 'main.py' || active === 'main.py').toBeTruthy()
})
