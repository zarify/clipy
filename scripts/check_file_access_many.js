const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForSelector('#editor-host');

  const iterations = 8;
  for(let i=1;i<=iterations;i++){
    const value = `hello-${i}`;
    const stamp = new Date().toISOString();
    console.log(`\n--- run ${i} @ ${stamp} ---`);
    // write to backend/localstorage
    await page.evaluate((v)=>{
      try{ if(window.FileManager) window.FileManager.write('/foo.txt', v) }catch(e){}
      try{ if(window.__ssg_vfs_backend) window.__ssg_vfs_backend.write('/foo.txt', v) }catch(e){}
    }, value);

    // show whether runtime FS exists and list files
    const pre = await page.evaluate(()=>{
      const fs = window.__ssg_runtime_fs
      const backend = window.__ssg_vfs_backend
      const info = { hasFS: !!fs, hasBackend: !!backend }
      try{ if(fs && typeof fs._listFiles === 'function'){ info.fsList = fs._listFiles() } else if(fs && typeof fs.readdir === 'function'){ info.fsList = fs.readdir('/') } }catch(e){ info.fsListErr = String(e) }
      return info
    })
    console.log('pre-run FS/backend:', pre)

    // ensure file visible in runtime FS if possible
    await page.evaluate(async (v)=>{
      try{
        if(window.__ssg_runtime_fs && typeof window.__ssg_runtime_fs.writeFile === 'function'){
          try{ if(typeof markExpectedWrite === 'function') markExpectedWrite('/foo.txt', v) }catch(_e){}
          try{ window.__ssg_suppress_notifier = true }catch(_e){}
          try{ window.__ssg_runtime_fs.writeFile('/foo.txt', v) }catch(_e){}
          try{ window.__ssg_suppress_notifier = false }catch(_e){}
          return
        }
      }catch(e){}
      try{ if(window.__ssg_vfs_backend && window.__ssg_runtime_fs && typeof window.__ssg_vfs_backend.mountToEmscripten === 'function'){ try{ window.__ssg_suppress_notifier = true }catch(_e){}; await window.__ssg_vfs_backend.mountToEmscripten(window.__ssg_runtime_fs); try{ window.__ssg_suppress_notifier = false }catch(_e){} }catch(e){}
    }, value)

    // install test program into editor and storage
    const userCode = 'with open("foo.txt") as f:\n    data = f.read()\n    print(f"File contents: {data}")'
    await page.evaluate((code)=>{
      try{ if(window.FileManager) window.FileManager.write('/main.py', code) }catch(e){}
      try{ if(window.__ssg_vfs_backend) window.__ssg_vfs_backend.write('/main.py', code) }catch(e){}
      try{ if(window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py') }catch(e){}
      try{ if(window.cm) window.cm.setValue(code); else document.getElementById('code').value = code }catch(e){}
    }, userCode)

    // run
    await page.click('#run')
    await page.waitForTimeout(1400)

    // capture terminal and post-run FS
    const res = await page.evaluate(()=>{
      const term = document.getElementById('terminal-output')?.textContent || ''
      const fs = window.__ssg_runtime_fs
      const info = { term }
      try{ if(fs && typeof fs._listFiles === 'function'){ info.fsList = fs._listFiles() } else if(fs && typeof fs.readdir === 'function'){ info.fsList = fs.readdir('/') } }catch(e){ info.fsListErr = String(e) }
      return info
    })
    console.log('terminal snippet:', res.term.split('\n').slice(-10).join('\n'))
    console.log('post-run FS:', res.fsList || res.fsListErr)
    const ok = /File contents: "+?hello-"+?/.test(res.term) || res.term.includes(value)
    const hasErr44 = res.term.includes('OSError: 44')
    console.log('saw file content?', ok, 'saw OSError:44?', hasErr44)
    await page.waitForTimeout(400)
  }

  await browser.close();
})();
