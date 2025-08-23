const { test, expect } = require('./fixtures')

// Requires a static server at http://localhost:8000

test('tabs: create, open, edit, autosave and delete', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Create a new file via the + button
  await page.click('#tab-new')
  // Prompt will appear; Playwright cannot interact with browser prompt by default,
  // so use the create file flow by invoking FileManager directly
  await page.evaluate(()=>{
    // create a file programmatically for test
    const name = 'testfile.py'
    if(window.FileManager){ window.FileManager.write(name, '# test file') }
    else if(window.__ssg_vfs_backend){ window.__ssg_vfs_backend.write('/testfile.py','# test file') }
  })

  // Open the file via files list
  // Open the file via TabManager directly (files panel removed)
  await page.evaluate(()=>{ if(window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('/testfile.py') })

  // Verify tab exists and editor contains file content
  await page.waitForSelector('.tab .tab-label')
  const tabLabels = await page.$$eval('.tab .tab-label', els=>els.map(e=>e.textContent))
  expect(tabLabels.some(t => t.includes('testfile.py'))).toBeTruthy()

  // Edit the file via CodeMirror: set editor value directly
  await page.evaluate(()=>{
    if(window.cm) window.cm.setValue('# edited test file')
    else document.getElementById('code').value = '# edited test file'
  })
  // wait for autosave debounce
  await page.waitForTimeout(900)

  // Confirm file saved to VFS/localStorage
  const saved = await page.evaluate(async ()=>{
    if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') return await window.__ssg_vfs_backend.read('/testfile.py')
    try{ const raw = localStorage.getItem('ssg_files_v1'); return raw && JSON.parse(raw)['/testfile.py'] }catch(e){}
    return null
  })
  expect(saved).toContain('edited')

  // Delete the backend file and force-close the tab via TabManager (no prompts)
  await page.evaluate(async ()=>{
    try{ if(window.__ssg_vfs_backend) await window.__ssg_vfs_backend.delete('/testfile.py') }catch(e){}
    try{ if(window.FileManager) await window.FileManager.delete('testfile.py') }catch(e){}
    try{ if(window.TabManager && typeof window.TabManager.forceClose === 'function') window.TabManager.forceClose('/testfile.py') }catch(e){}
  })
  await page.waitForTimeout(200)
  // Wait until the tab label no longer appears (handle async updates)
  await page.waitForFunction(()=> !Array.from(document.querySelectorAll('.tab .tab-label')).some(e=> e.textContent && e.textContent.includes('testfile.py')), { timeout: 2000 })
  const savedAfter = await page.evaluate(async ()=>{ try{ if(window.__ssg_vfs_backend) return await window.__ssg_vfs_backend.read('/testfile.py') }catch(e){} try{ const raw = localStorage.getItem('ssg_files_v1'); return raw && JSON.parse(raw)['/testfile.py'] }catch(e){} return null })
  // backend.read may return null or undefined depending on implementation; accept both as deleted
  expect(savedAfter == null).toBeTruthy()
})

