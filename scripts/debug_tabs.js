const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch({headless:true});
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForTimeout(800);
  // create file via FileManager
  await page.evaluate(()=>{
    if(window.FileManager) window.FileManager.write('testfile.py', '# test file')
  })
  await page.waitForTimeout(200);
  // call renderFilesList to update DOM
  await page.evaluate(()=>{ try{ if(typeof renderFilesList === 'function') renderFilesList() }catch(e){} })
  await page.waitForTimeout(200);
  const filesHtml = await page.evaluate(()=> document.getElementById('files-list').innerHTML )
  console.log('#files-list html: ', filesHtml)
  // click the first Open button
  const open = await page.$('#files-list button')
  if(open){ await open.click(); await page.waitForTimeout(200); }
  const tabLabels = await page.$$eval('.tab .tab-label', els=>els.map(e=>e.textContent))
  console.log('tab labels after open:', tabLabels)
  // show openTabs internal via window.TabManager.list if available
  const openTabs = await page.evaluate(()=> window.TabManager ? (typeof window.TabManager.list === 'function' ? window.TabManager.list() : null) : null)
  console.log('TabManager.list ->', openTabs)
  await browser.close();
})();
