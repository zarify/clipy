const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForSelector('#editor-host');

  // write two files into FileManager
  await page.evaluate(async ()=>{
    try{ if(window.FileManager) await window.FileManager.write('/main.py', 'print(1)') }catch(e){}
    try{ if(window.FileManager) await window.FileManager.write('/foo.txt', 'hello snap') }catch(e){}
  })

  // save snapshot
  await page.click('#save-snapshot')
  await page.waitForTimeout(300)

  // open history modal and restore the first snapshot
  await page.click('#history')
  await page.waitForSelector('#snapshot-list')
  // click first restore button
  await page.evaluate(()=>{ const btn = document.querySelector('#snapshot-list .snapshot-item button'); if(btn) btn.click() })
  await page.waitForTimeout(500)

  // check tabs: only main.py should be open
  const tabs = await page.evaluate(()=> Array.from(document.querySelectorAll('#tabs-left .tab-label')).map(n=>n.textContent))
  console.log('tabs after restore:', tabs)
  // check that files-list no longer exists
  const filesListExists = await page.evaluate(()=> !!document.getElementById('files-list'))
  console.log('filesListExists:', filesListExists)

  await browser.close()
})();
