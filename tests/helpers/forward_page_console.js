// Test-only helper: forward browser page console and page errors to the test runner's stdout.
// Usage:
// const { attachPageConsole } = require('./helpers/forward_page_console')
// const forward = attachPageConsole(page, { prefix: '[PAGE]', filter: msg => true })
// ... when done: forward.detach()

function defaultFilter(msg) {
  // ignore some noisy internal messages by default
  const text = msg.text ? msg.text() : ''
  if (!text) return true
  if (text.includes('Execution context was destroyed')) return false
  return true
}

function formatLocation(loc){
  if (!loc) return ''
  if (loc.url) return ` (${loc.url}:${loc.lineNumber || 0}:${loc.columnNumber || 0})`
  return ''
}

function attachPageConsole(page, opts = {}){
  const prefix = opts.prefix || '[PAGE]'
  const filter = typeof opts.filter === 'function' ? opts.filter : defaultFilter

  const onConsole = msg => {
    try{
      if (!filter(msg)) return
      const type = msg.type()
      const text = msg.text()
      const loc = formatLocation(msg.location ? msg.location() : null)
      // Use console.log so Playwright captures it with the test runner
      console.log(`${prefix} ${type}${loc}: ${text}`)
    }catch(e){
      console.log(`${prefix} console-forward error:`, e)
    }
  }

  const onPageError = err => {
    try{
      console.error(`${prefix} pageerror: ${err && err.message ? err.message : String(err)}`)
    }catch(e){
      console.error(`${prefix} pageerror forward failed`, e)
    }
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  return {
    detach(){
      try{ page.removeListener('console', onConsole) }catch(_e){}
      try{ page.removeListener('pageerror', onPageError) }catch(_e){}
    }
  }
}

module.exports = { attachPageConsole }
