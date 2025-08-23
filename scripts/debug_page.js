const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForTimeout(1000);
  const fmList = await page.evaluate(()=>{
    try{ return { hasFM: !!window.FileManager, fmList: window.FileManager ? window.FileManager.list() : null, hasBackend: !!window.__ssg_vfs_backend, TabManager: !!window.TabManager } }catch(e){ return 'err:'+String(e) }
  });
  const filesHost = await page.evaluate(()=>{
    const el = document.getElementById('files-list')
    return { text: el ? el.textContent : null, html: el ? el.innerHTML : null }
  })
  console.log('FileManager/list diagnostics ->', fmList);
  console.log('#files-list ->', filesHost);
  const btns = await page.evaluate(()=> Array.from(document.querySelectorAll('#files-list button')).map(b=>b.textContent))
  console.log('#files-list buttons ->', btns)
  await browser.close();
})();
