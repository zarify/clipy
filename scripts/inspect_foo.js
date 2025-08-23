const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForSelector('#editor-host');
  const info = await page.evaluate(async ()=>{
    const out = {}
    try{ out.fileManager = window.FileManager ? window.FileManager.read('/foo.txt') : null }catch(e){ out.fileManagerErr = String(e) }
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') out.backend = await window.__ssg_vfs_backend.read('/foo.txt') }catch(e){ out.backendErr = String(e) }
    try{
      const fs = window.__ssg_runtime_fs
      if(fs){
        // try various read APIs
        if(typeof fs.readFile === 'function'){
          try{ out.fs_readFile = fs.readFile('/foo.txt') }catch(e){ out.fs_readFileErr = String(e) }
        }
        if(typeof fs.readFileSync === 'function'){
          try{ out.fs_readFileSync = fs.readFileSync('/foo.txt') }catch(e){ out.fs_readFileSyncErr = String(e) }
        }
        if(typeof fs.readFileText === 'function'){
          try{ out.fs_readFileText = fs.readFileText('/foo.txt') }catch(e){ out.fs_readFileTextErr = String(e) }
        }
        if(typeof fs.writeFile === 'function'){
          try{ out.fs_canWrite = true }catch(e){ out.fs_canWrite = false }
        }
      } else out.fs = null
    }catch(e){ out.fsErr = String(e) }
    return out
  })
  console.log('inspection:', info)
  await browser.close()
})()
