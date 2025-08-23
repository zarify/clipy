const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForSelector('#editor-host');
  const info = await page.evaluate(async ()=>{
    const out = {}
    try{ out.localStorage_raw = localStorage.getItem('ssg_files_v1') }catch(e){ out.localStorageErr = String(e) }
    try{ out.local_autosave = localStorage.getItem('autosave') }catch(e){ out.autosaveErr = String(e) }
    try{ if(window.FileManager && typeof window.FileManager.list === 'function') out.fileManager_list = window.FileManager.list() }catch(e){ out.fileManagerErr = String(e) }
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.list === 'function') out.backend_list = await window.__ssg_vfs_backend.list() }catch(e){ out.backendErr = String(e) }
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') out.backend_foo = await window.__ssg_vfs_backend.read('/foo.txt') }catch(e){ out.backend_fooErr = String(e) }
    try{ if(window.__ssg_runtime_fs && typeof window.__ssg_runtime_fs.readFile === 'function') out.runtime_foo = window.__ssg_runtime_fs.readFile('/foo.txt') }catch(e){ out.runtime_fooErr = String(e) }
    return out
  })
  console.log('vfs inspection:', info)
  await browser.close()
})()
