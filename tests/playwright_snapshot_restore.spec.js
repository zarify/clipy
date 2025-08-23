const { test, expect } = require('./fixtures')

// Snapshot restore should write all files into backend and open only main.py
test('snapshot restore populates FS and focuses main.py', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Prepare files and save a snapshot
  await page.evaluate(async ()=>{
    try{ if(window.FileManager) await window.FileManager.write('/main.py', 'print("from main")') }catch(e){}
    try{ if(window.FileManager) await window.FileManager.write('/foo.txt', 'snapshot-file') }catch(e){}
  })
  await page.click('#save-snapshot')
  // wait for snapshot to persist
  await page.waitForFunction(() => Boolean(localStorage.getItem('snapshots')), { timeout: 2000 })

  // Clear current backend/mem to simulate fresh state
  await page.evaluate(async ()=>{
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.delete === 'function'){ const names = await window.__ssg_vfs_backend.list(); for(const n of names) await window.__ssg_vfs_backend.delete(n) } }catch(e){}
    try{ if(window.FileManager && typeof window.FileManager.list === 'function'){ const names = window.FileManager.list(); for(const n of names) await window.FileManager.delete(n) } }catch(e){}
  })

  // Restore snapshot via UI
  await page.click('#history')
  await page.waitForSelector('#snapshot-list')
  await page.evaluate(()=>{ const btn = document.querySelector('#snapshot-list .snapshot-item button'); if(btn) btn.click() })
  // wait for snapshot restore to finish (signaled by global flag)
  await page.waitForFunction(()=> Boolean(window.__ssg_last_snapshot_restore), { timeout: 2000 })

  // Wait/poll for backend/mem contains foo.txt (restore is async)
  const backendFoo = await page.waitForFunction(async ()=>{
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') return await window.__ssg_vfs_backend.read('/foo.txt') }catch(e){}
    try{ if(window.FileManager && typeof window.FileManager.read === 'function') return window.FileManager.read('/foo.txt') }catch(e){}
    return null
  }, { timeout: 2000 })
  const val = await backendFoo.jsonValue()
  expect(val).toBe('snapshot-file')

  // Assert only main.py tab is open and focused
  const tabs = await page.$$eval('#tabs-left .tab-label', els=>els.map(e=>e.textContent))
  expect(tabs).toContain('main.py')
  const active = await page.$eval('#tabs-left .tab.active .tab-label', el => el.textContent)
  expect(active).toBe('main.py')
})
