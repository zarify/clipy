const { test, expect } = require('./fixtures')

// Note: Requires static server at http://localhost:8000

test('run: edits to main.py are persisted and visible to VFS', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Open main.py tab (should already be open)
  await page.evaluate(()=>{
    // ensure main tab is selected
    if(window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py')
  })
  await page.waitForTimeout(200)

  // edit main.py in editor
  await page.evaluate(()=>{
    if(window.cm) window.cm.setValue('# runtime main\nprint(123)')
    else document.getElementById('code').value = '# runtime main\nprint(123)'
  })
  // wait autosave
  await page.waitForTimeout(900)

  // Click run
  await page.click('#run')
  // wait a bit for runtime to initialize and run
  await page.waitForTimeout(1200)

  // After run, main.py should be persisted in backend
  const main = await page.evaluate(async ()=>{
    try{ if(window.__ssg_vfs_backend) return await window.__ssg_vfs_backend.read('/main.py') }catch(e){}
    try{ const raw = localStorage.getItem('ssg_files_v1'); return raw && JSON.parse(raw)['/main.py'] }catch(e){}
    return null
  })
  expect(main).toContain('print(123)')
})
