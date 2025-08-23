const { test, expect } = require('./fixtures')

// NOTE: These tests expect a local static server to be running at http://localhost:8000
// Start one with: python -m http.server 8000

test('page loads and VFS exposes main.py', async ({ page }) => {
  await page.goto('http://localhost:8000')
  // wait for runtime and UI to initialize
  await page.waitForSelector('#editor-host')

  // try reading main.py via the exposed backend or localStorage
  const mainContent = await page.evaluate(async ()=>{
    try{
      if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function'){
        return await window.__ssg_vfs_backend.read('/main.py')
      }
    }catch(e){}
    try{
      const raw = localStorage.getItem('ssg_files_v1')
      if(raw){ const m = JSON.parse(raw); return m['/main.py'] || m['main.py'] || null }
    }catch(e){}
    return null
  })
  expect(mainContent).not.toBeNull()
})
