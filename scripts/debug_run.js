const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForTimeout(500);
  // ensure main tab selected
  await page.evaluate(()=>{ if(window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py') })
  await page.waitForTimeout(100);
  // set editor
  await page.evaluate(()=>{ if(window.cm) window.cm.setValue('# runtime main\nprint(123)'); else document.getElementById('code').value = '# runtime main\nprint(123)'; })
  await page.waitForTimeout(900);
  // click run
  await page.click('#run')
  await page.waitForTimeout(1500);
  // dump storage and backend
  const dump = await page.evaluate(async ()=>{
    const out = {}
    try{ out.local_raw = localStorage.getItem('ssg_files_v1') }catch(e){ out.local_raw = 'err:'+e }
    try{ out.autosave = localStorage.getItem('autosave') }catch(e){ out.autosave = 'err:'+e }
    try{ out.fm_load = window.FileManager && window.FileManager._load? window.FileManager._load() : null }catch(e){ out.fm_load = 'err:'+e }
    try{ if(window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.read === 'function') out.backend_main = await window.__ssg_vfs_backend.read('/main.py') }catch(e){ out.backend_main = 'err:'+e }
    return out
  })
  console.log('dump:', dump)
  await browser.close();
})();
