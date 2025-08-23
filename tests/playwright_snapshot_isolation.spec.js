const { test, expect } = require('./fixtures')

// Verify snapshot isolation: files present in one snapshot must not leak into another.
// Steps:
// 1. Create /iso.txt with content 'from-A' and save snapshot A.
// 2. Delete /iso.txt and save snapshot B (no iso.txt).
// 3. Restore snapshot A -> expect /iso.txt exists with 'from-A'.
// 4. Modify /iso.txt locally -> change content.
// 5. Restore snapshot B -> expect /iso.txt is absent.
// 6. Restore snapshot A again -> expect /iso.txt restored to 'from-A'.

test('snapshot isolation: files from one snapshot do not persist into another', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Ensure clean state
  await page.evaluate(() => {
    try { localStorage.removeItem('snapshots') } catch (_e) { }
    try { localStorage.removeItem('ssg_files_v1') } catch (_e) { }
    try { window.__ssg_last_snapshot_restore = 0 } catch (_e) { }
  })

  // Create file /iso.txt and save snapshot A
  await page.evaluate(async () => {
    try { if (window.FileManager) await window.FileManager.write('/iso.txt', 'from-A') } catch (_e) { }
  })
  await page.click('#save-snapshot')
  // wait for snapshot to persist
  await page.waitForFunction(() => Boolean(localStorage.getItem('snapshots')), { timeout: 2000 })

  // Delete /iso.txt and save snapshot B
  await page.evaluate(async () => {
    try { if (window.FileManager) await window.FileManager.delete('/iso.txt') } catch (_e) { }
  })
  await page.click('#save-snapshot')
  await page.waitForFunction(() => Boolean(localStorage.getItem('snapshots')), { timeout: 2000 })

  // Restore snapshot A (first saved)
  await page.click('#history')
  await page.waitForSelector('#snapshot-list')
  await page.evaluate(() => { const btns = Array.from(document.querySelectorAll('#snapshot-list .snapshot-item button')); if (btns && btns[0]) btns[0].click() })
  await page.waitForFunction(() => Boolean(window.__ssg_last_snapshot_restore), { timeout: 2000 })

  // Assert file exists and has content 'from-A'
  const valA = await page.evaluate(async () => {
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') return await window.__ssg_vfs_backend.read('/iso.txt') } catch (_e) { }
    try { const raw = localStorage.getItem('ssg_files_v1'); if (raw) { const map = JSON.parse(raw); if ('/iso.txt' in map) return map['/iso.txt'] } } catch (_e) { }
    try { if (window.FileManager) return window.FileManager.read('/iso.txt') } catch (_e) { }
    return null
  })
  expect(valA).toBe('from-A')

  // Modify file locally
  await page.evaluate(async () => { try { if (window.FileManager) await window.FileManager.write('/iso.txt', 'changed-locally') } catch (_e) { } })

  // Restore snapshot B (second saved)
  await page.click('#history')
  await page.waitForSelector('#snapshot-list')
  await page.evaluate(() => { const btns = Array.from(document.querySelectorAll('#snapshot-list .snapshot-item button')); if (btns && btns[1]) btns[1].click() })
  await page.waitForFunction(() => Boolean(window.__ssg_last_snapshot_restore), { timeout: 2000 })

  // Assert file is absent
  const valB = await page.evaluate(async () => {
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') return await window.__ssg_vfs_backend.read('/iso.txt') } catch (_e) { }
    try { const raw = localStorage.getItem('ssg_files_v1'); if (!raw) return null; const map = JSON.parse(raw); return ('/iso.txt' in map) ? map['/iso.txt'] : null } catch (_e) { }
    try { if (window.FileManager) return window.FileManager.read('/iso.txt') } catch (_e) { }
    return null
  })
  expect(valB).toBeNull()

  // Restore snapshot A again
  await page.click('#history')
  await page.waitForSelector('#snapshot-list')
  await page.evaluate(() => { const btns = Array.from(document.querySelectorAll('#snapshot-list .snapshot-item button')); if (btns && btns[0]) btns[0].click() })
  await page.waitForFunction(() => Boolean(window.__ssg_last_snapshot_restore), { timeout: 2000 })

  const valA2 = await page.evaluate(async () => {
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') return await window.__ssg_vfs_backend.read('/iso.txt') } catch (_e) { }
    try { const raw = localStorage.getItem('ssg_files_v1'); if (raw) { const map = JSON.parse(raw); if ('/iso.txt' in map) return map['/iso.txt'] } } catch (_e) { }
    try { if (window.FileManager) return window.FileManager.read('/iso.txt') } catch (_e) { }
    return null
  })
  expect(valA2).toBe('from-A')
})
