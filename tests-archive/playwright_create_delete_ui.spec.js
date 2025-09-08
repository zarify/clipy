const { test, expect } = require('./fixtures')

// Requires a static server at http://localhost:8000

test('create a tab via UI input modal, then delete it via UI and verify FS changes', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Click the new file button which should open the accessible input modal
  await page.click('#tab-new')
  // Wait for input field to be visible in the input modal
  await page.waitForSelector('#input-modal[aria-hidden="false"] #input-modal-field')
  // Enter file name and confirm via UI
  await page.fill('#input-modal-field', 'uifile.py')
  await page.click('#input-modal-ok')

  // Wait for tab label to appear
  await page.waitForFunction(()=> Array.from(document.querySelectorAll('.tab .tab-label')).some(e=> e.textContent && e.textContent.includes('uifile.py')))

  // Verify file exists in backend or localStorage
  const exists = await page.evaluate(async ()=>{
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function'){ const v = await window.__ssg_vfs_backend.read('/uifile.py'); return v !== null && v !== undefined }
    }catch(_e){}
    try{ const raw = localStorage.getItem('ssg_files_v1'); if(!raw) return false; const map = JSON.parse(raw); return ('/uifile.py' in map) }
    catch(_e){}
    try{ if(window.FileManager){ return window.FileManager.read('/uifile.py') !== null && window.FileManager.read('/uifile.py') !== undefined } }catch(_e){}
    return false
  })
  expect(exists).toBeTruthy()

  // Click the close button for the created tab (this should trigger accessible confirm modal)
  await page.evaluate(()=>{
    const tabs = Array.from(document.querySelectorAll('.tab'))
    for(const t of tabs){ const lbl = t.querySelector('.tab-label'); if(lbl && lbl.textContent && lbl.textContent.includes('uifile.py')){ const btn = t.querySelector('.close'); if(btn) btn.click(); break } }
  })
  // Wait for confirm modal and confirm deletion via UI
  await page.waitForSelector('#confirm-modal[aria-hidden="false"]')
  await page.click('#confirm-yes')

  // Wait until the tab label no longer appears
  await page.waitForFunction(()=> !Array.from(document.querySelectorAll('.tab .tab-label')).some(e=> e.textContent && e.textContent.includes('uifile.py')) , { timeout: 2000 })

  // Verify file no longer exists
  const existsAfter = await page.evaluate(async ()=>{
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function'){ const v = await window.__ssg_vfs_backend.read('/uifile.py'); return v !== null && v !== undefined }
    }catch(_e){}
    try{ const raw = localStorage.getItem('ssg_files_v1'); if(!raw) return false; const map = JSON.parse(raw); return ('/uifile.py' in map) }
    catch(_e){}
    try{ if(window.FileManager){ return window.FileManager.read('/uifile.py') !== null && window.FileManager.read('/uifile.py') !== undefined } }catch(_e){}
    return false
  })
  expect(existsAfter).toBeFalsy()
})
