const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.type(), msg.text()));
  await page.goto('http://localhost:8000');
  await page.waitForSelector('#editor-host');
  const code = `with open("bar.txt", "w") as f:\n    f.write("this is bar\\n")\nprint("OK")\n`;
  await page.evaluate(async (src)=>{
    try{ if(window.FileManager && typeof window.FileManager.write === 'function') await window.FileManager.write('/main.py', src) }catch(e){ console.error(e) }
    try{ if(window.cm && typeof window.cm.setValue === 'function') window.cm.setValue(src) }catch(e){}
  }, code)
  console.log('Starting run...')
  await page.click('#run')
  // wait for OK in terminal
  await page.waitForFunction(()=> document.getElementById('terminal-output') && document.getElementById('terminal-output').textContent.includes('OK'), { timeout: 5000 })
  console.log('Program ran; dumping state:')
  const debug = await page.evaluate(()=>{
    const memKeys = Object.keys(window.mem || {})
    let mapKeys = []
    try{ mapKeys = Object.keys(JSON.parse(localStorage.getItem('ssg_files_v1')||'{}')) }catch(_e){}
    const pending = window.__ssg_pending_tabs || []
    const tabList = (window.TabManager && window.TabManager.list ? window.TabManager.list() : null)
    const labels = Array.from(document.querySelectorAll('#tabs-left .tab-label')).map(e=>e.textContent)
    const term = document.getElementById('terminal-output') ? document.getElementById('terminal-output').textContent : null
    return { memKeys, mapKeys, pending, tabList, labels, term }
  })
  console.log('DEBUG:', JSON.stringify(debug, null, 2))
  await browser.close();
})();
