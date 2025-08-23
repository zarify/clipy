const { firefox } = require('playwright');
(async ()=>{
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForTimeout(400);
  const info = await page.evaluate(()=>{
    const f = window.FileManager
    if(!f) return null
    const keys = Object.keys(f)
    const hasLoad = typeof f._load === 'function'
    const proto = Object.getPrototypeOf(f)
    return { keys, hasLoad, protoKeys: proto ? Object.getOwnPropertyNames(proto) : null, list: typeof f.list === 'function' ? f.list() : null }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})();
