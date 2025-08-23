const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForSelector('#editor-host');

  const content = 'hi there\n'
  console.log('writing content ->', JSON.stringify(content))
  await page.evaluate(async (content)=>{
    try{ if(window.FileManager) await window.FileManager.write('/foo.txt', content) }catch(e){ console.log('fm write err', e) }
    try{ if(window.__ssg_vfs_backend) await window.__ssg_vfs_backend.write('/foo.txt', content) }catch(e){ }
    try{
      if(window.__ssg_runtime_fs && typeof window.__ssg_runtime_fs.writeFile === 'function'){
        try{ if(typeof markExpectedWrite === 'function') markExpectedWrite('/foo.txt', content) }catch(_e){}
        try{ window.__ssg_suppress_notifier = true }catch(_e){}
        try{ window.__ssg_runtime_fs.writeFile('/foo.txt', content) }catch(_e){}
        try{ window.__ssg_suppress_notifier = false }catch(_e){}
      }
    }catch(e){}
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.mountToEmscripten === 'function' && window.__ssg_runtime_fs){ try{ window.__ssg_suppress_notifier = true }catch(_e){}; await window.__ssg_vfs_backend.mountToEmscripten(window.__ssg_runtime_fs); try{ window.__ssg_suppress_notifier = false }catch(_e){} } }catch(e){}
  }, content)

  // prepare main.py
  const userCode = 'with open("foo.txt") as f:\n    data = f.read()\n    print(f"Length of data read: {len(data)}")\n    print(data)'
  await page.evaluate(async (code)=>{
    try{ if(window.FileManager) await window.FileManager.write('/main.py', code) }catch(e){}
    try{ if(window.__ssg_vfs_backend) await window.__ssg_vfs_backend.write('/main.py', code) }catch(e){}
    try{ if(window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py') }catch(e){}
    try{ if(window.cm) window.cm.setValue(code); else document.getElementById('code').value = code }catch(e){}
  }, userCode)

  // Click run
  await page.click('#run')
  await page.waitForTimeout(1200)

  // collect terminal and reads
  const res = await page.evaluate(async ()=>{
    const res = {}
    res.terminal = document.getElementById('terminal-output')?.textContent || ''
    try{ res.ls = localStorage.getItem('ssg_files_v1') }catch(e){ res.lsErr = String(e) }
    try{ res.fm = window.FileManager ? window.FileManager.read('/foo.txt') : null }catch(e){ res.fmErr = String(e) }
    try{ res.backend = window.__ssg_vfs_backend ? await window.__ssg_vfs_backend.read('/foo.txt') : null }catch(e){ res.backendErr = String(e) }
    try{ const fs = window.__ssg_runtime_fs; if(fs && typeof fs.readFile === 'function') res.fs_read = fs.readFile('/foo.txt') }catch(e){ res.fsErr = String(e) }
    return res
  })

  console.log('result:', res)
  await browser.close()
})();
