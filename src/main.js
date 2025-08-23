// Minimal scaffolding: MicroPython loader, CodeMirror placeholder, simple terminal, config loader
const configUrl = './config/sample.json'

async function loadConfig(){
  try{
    const res = await fetch(configUrl)
    return await res.json()
  }catch(e){
    return null
  }
}

function $(id){return document.getElementById(id)}

async function main(){
  const cfg = await loadConfig()
  $('instructions-content').textContent = cfg?.instructions || 'No instructions provided.'
  // Initialize CodeMirror editor in the host div, fallback to hidden textarea
  const textarea = $('code')
  const host = $('editor-host')
  textarea.value = cfg?.starter || '# write Python here'
  let cm = null
  if(window.CodeMirror){
    cm = window.CodeMirror(host, {
      value: textarea.value,
      mode: 'python',
      lineNumbers: true,
      indentUnit: 4,
      theme: 'default'
    })
    // Ctrl-Enter to run
    cm.setOption('extraKeys', { 'Ctrl-Enter': ()=> $('run').click() })
  }

  const appendTerminal = (text)=>{
    const out = $('terminal-output')
    out.textContent += '\n' + text
    out.scrollTop = out.scrollHeight
  }

  // Debug-only logger: controlled by `window.__ssg_debug_logs` (default: false)
  try{ window.__ssg_debug_logs = window.__ssg_debug_logs || false }catch(_e){}
  function appendTerminalDebug(text){ try{ if(window.__ssg_debug_logs) appendTerminal(text) }catch(_e){} }

  // Map and display tracebacks that originate in transformed code back to user source
  function mapTracebackAndShow(rawText, headerLines, userCode){
    if(!rawText) return
    const showRaw = !!$('show-raw-tb') && $('show-raw-tb').checked
    // Replace occurrences like: File "<stdin>", line N[, column C]
    const mapped = rawText.replace(/File \"([^\"]+)\", line (\d+)(?:, column (\d+))?/g, (m, fname, ln, col)=>{
      const mappedLn = Math.max(1, Number(ln) - headerLines)
      if(col) return `File "${fname}", line ${mappedLn}, column ${col}`
      return `File "${fname}", line ${mappedLn}`
    })
    if(showRaw){
      appendTerminal('[raw traceback]')
      appendTerminal(rawText)
    }

  // When there's no async backend to reload from, open tabs based on in-memory `mem` or localStorage mirror.
  function openTabsFromMem(){
    try{
      const names = Object.keys(mem || {})
      if(!names || !names.length) return
      if(window.TabManager && typeof window.TabManager.openTab === 'function'){
        const existing = (window.TabManager.list && window.TabManager.list()) || []
        for(const n0 of names){
          const n = (n0 && n0.startsWith('/')) ? n0 : ('/' + n0)
          if(n === MAIN_FILE) continue
          if(!existing.includes(n)){
            try{ window.TabManager.openTab(n) }catch(_e){}
          }
        }
      } else {
        try{ window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat(names.filter(n=> n !== MAIN_FILE)) }catch(_e){}
      }
    }catch(_e){}
  }
    appendTerminal('[mapped traceback]')
    appendTerminal(mapped)

    // Optionally show small source context for first mapped line
    const m = mapped.match(/line (\d+)/)
    if(m){
      const errLine = Math.max(1, Number(m[1]))
      const userLines = userCode.split('\n')
      const contextStart = Math.max(0, errLine-3)
      appendTerminal('--- source context (student code) ---')
      for(let i=contextStart;i<Math.min(userLines.length, errLine+2); i++){
        const prefix = (i+1===errLine)?'-> ':'   '
        appendTerminal(prefix + String(i+1).padStart(3,' ') + ': ' + userLines[i])
      }
    }
  }

  // runtimeAdapter will provide a run(code) -> Promise<string> API if a runtime is available
  let runtimeAdapter = null

  // VFS runtime references (populated during async VFS init)
  let backendRef = null
  let mem = null

  // Track expected writes we performed into the runtime FS so notifications that
  // are simply echoes of our own sync/mount operations can be suppressed.
  try{ window.__ssg_expected_writes = window.__ssg_expected_writes || new Map() }catch(_e){}
  function _normPath(p){ if(!p) return p; return p.startsWith('/') ? p : ('/' + p) }
  function markExpectedWrite(p, content){ try{ const n = _normPath(p); window.__ssg_expected_writes.set(n, { content: String(content||''), ts: Date.now() }) }catch(_e){} }
  function consumeExpectedWriteIfMatches(p, content, windowMs=3000){ try{ const n = _normPath(p); const rec = window.__ssg_expected_writes.get(n); if(!rec) return false; const now = Date.now(); if(now - rec.ts > windowMs){ window.__ssg_expected_writes.delete(n); return false } if(String(content||'') === String(rec.content||'')){ window.__ssg_expected_writes.delete(n); return true } return false }catch(_e){ return false } }

  // Name of the protected main program file (normalized)
  const MAIN_FILE = '/main.py'

  // --- Simple FileManager shim (localStorage-backed) ---
  // This is a temporary UI-facing API so you can create/edit/delete files
  // now; it will be replaced by the IndexedDB-backed VFS implementation later.
  // localStorage-backed simple FileManager (normalizes keys to '/path')
  let FileManager = {
    key: 'ssg_files_v1',
    _load(){ try{ return JSON.parse(localStorage.getItem(this.key)||'{}') }catch(e){ return {} } },
    _save(m){ localStorage.setItem(this.key, JSON.stringify(m)) },
    _norm(p){ if(!p) return p; return p.startsWith('/') ? p : ('/' + p) },
    list(){ return Object.keys(this._load()).sort() },
    read(path){ const m=this._load(); return m[this._norm(path)]||null },
    write(path, content){ const m=this._load(); m[this._norm(path)]=content; this._save(m); return Promise.resolve() },
    delete(path){ if(this._norm(path) === MAIN_FILE){ console.warn('Attempt to delete protected main file ignored:', path); return Promise.resolve() } const m=this._load(); delete m[this._norm(path)]; this._save(m); return Promise.resolve() }
  }

  // Expose the local FileManager immediately so tests and early scripts can access it.
  try{ window.FileManager = FileManager }catch(e){}

  // Provide a minimal TabManager stub so test code can call openTab early; it will be replaced later.
  try{ window.TabManager = window.TabManager || { openTab: (n)=>{}, closeTab: (n)=>{}, selectTab: (n)=>{}, getActive: ()=>null } }catch(e){}

  // Ensure MAIN_FILE exists with starter content (but don't overwrite existing)
  if(!FileManager.read(MAIN_FILE)){
    FileManager.write(MAIN_FILE, cfg?.starter || '# main program (auto-created)\n')
  }

  // Files panel has been removed from the UI. Keep a no-op shim so existing
  // call sites (tests, early code) that call renderFilesList() remain safe.
  function renderFilesList(){
    // Debug shim: the files panel UI was removed. Enable logging by setting
    // `window.__ssg_enable_fileslist_debug = true` in the console to see
    // call sites and stack traces for unexpected calls.
    try{
      if(window.__ssg_enable_fileslist_debug){
        // Use console.debug so it's easy to filter; include a short stack.
        console.debug('renderFilesList() called — files panel removed. Stack:', new Error().stack)
      }
    }catch(_e){}
  }

  // Accessible modal helpers: openModal / closeModal
  // - Saves/restores focus
  // - Traps Tab within the modal
  // - Closes on Escape
  function _getFocusable(container){
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(el=> el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement)
  }
  function openModal(m){
    try{
      if(!m) return
      // record previously focused element for restore
      m.__previousActive = document.activeElement
      m.setAttribute('aria-hidden','false')
      m.setAttribute('aria-modal','true')
      // ensure modal is focusable
      if(!m.hasAttribute('tabindex')) m.setAttribute('tabindex','-1')
      const focusables = _getFocusable(m)
      if(focusables.length) focusables[0].focus()
      else m.focus()

      // key handling: trap tab and close on ESC
      m.__keydownHandler = function(e){
        if(e.key === 'Escape'){
          e.stopPropagation(); e.preventDefault(); closeModal(m)
          return
        }
        if(e.key === 'Tab'){
          const focusList = _getFocusable(m)
          if(!focusList.length){ e.preventDefault(); return }
          const first = focusList[0], last = focusList[focusList.length-1]
          if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
          else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', m.__keydownHandler, true)
      // mark inert siblings by setting aria-hidden on main content to help screen readers
      try{ const main = document.querySelector('main'); if(main) main.setAttribute('aria-hidden','true'); }catch(_e){}
    }catch(_e){}
  }
  function closeModal(m){
    try{
      if(!m) return
      m.setAttribute('aria-hidden','true')
      m.removeAttribute('aria-modal')
      try{ document.removeEventListener('keydown', m.__keydownHandler, true) }catch(_e){}
      try{ if(m.__previousActive && typeof m.__previousActive.focus === 'function') m.__previousActive.focus() }catch(_e){}
      try{ const main = document.querySelector('main'); if(main) main.removeAttribute('aria-hidden'); }catch(_e){}
    }catch(_e){}
  }

  // Accessible input modal helper: returns string or null if cancelled
  function showInputModal(title, message, defaultValue){
    return new Promise((resolve)=>{
      try{
        const m = document.getElementById('input-modal')
        const t = document.getElementById('input-modal-title')
        const desc = document.getElementById('input-modal-desc')
        const field = document.getElementById('input-modal-field')
        const ok = document.getElementById('input-modal-ok')
        const cancel = document.getElementById('input-modal-cancel')
        
        if(!m || !t || !desc || !field || !ok || !cancel){
          const val = window.prompt(message || title || '')
          resolve(val)
          return
        }
        t.textContent = title || 'Input'
        desc.textContent = message || ''
        field.value = defaultValue || ''
  openModal(m)
        const onOk = ()=>{ cleanup(); resolve(field.value) }
        const onCancel = ()=>{ cleanup(); resolve(null) }
        function cleanup(){ try{ closeModal(m) }catch(_e){}; try{ ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel) }catch(_e){} }
        ok.addEventListener('click', onOk)
        cancel.addEventListener('click', onCancel)
        // allow Enter key within input to confirm
        const keyHandler = (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); onOk() } }
        field.addEventListener('keydown', keyHandler)
      }catch(e){ resolve(null) }
    })
  }

  // Try to initialize real VFS backend (IndexedDB preferred) and migrate existing local files
  try{
    const vfsMod = await import('./lib/vfs.js')
  const backend = await vfsMod.init()
  backendRef = backend
    // migrate existing localStorage-based files into backend if missing
    const localFiles = FileManager.list()
    for(const p of localFiles){
      try{
        const existing = await backend.read(p)
        if(existing == null){ await backend.write(p, FileManager.read(p)) }
      }catch(e){ /* ignore per-file errors */ }
    }
    // build an in-memory snapshot adapter so the UI can use a synchronous API
    // while the real backend is async (IndexedDB). We read all files into `mem`
    // and proxy writes/deletes to the backend asynchronously.
  mem = {}
    try{
      const names = await backend.list()
      for(const n of names){
        try{ mem[n] = await backend.read(n) }catch(e){ mem[n] = null }
      }
    }catch(e){ /* ignore if list/read fail */ }
  // Expose mem for debugging/tests and for other host helpers
  try{ window.__ssg_mem = mem; window.mem = mem }catch(_e){}

    FileManager = {
      list(){ return Object.keys(mem).sort() },
      read(path){ const n = path && path.startsWith('/') ? path : ('/' + path); return mem[n] || null },
      write(path, content){
        const n = path && path.startsWith('/') ? path : ('/' + path)
          const prev = mem[n]
          // If the content didn't change, return early to avoid writing into the runtime FS
          // which can trigger the notifier and cause a recursion.
          try{ if(prev === content) return Promise.resolve() }catch(_e){}

          // update in-memory copy first
          mem[n] = content
          // update localStorage mirror for tests and fallbacks
          try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); map[n] = content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){}

    // NOTE: intentionally do NOT write directly into window.__ssg_runtime_fs here.
    // Writing into the interpreter FS from the UI causes a write->notify->UI-write recursion
    // when the runtime's wrapped fs methods call back into `__ssg_notify_file_written`.
    // The UI will sync mem -> runtime FS in the pre-run sync phase instead.

          return backend.write(n, content).catch(e=>{ console.error('VFS write failed', e); throw e })
      },
      delete(path){
        const n = path && path.startsWith('/') ? path : ('/' + path)
        if(n === MAIN_FILE){ console.warn('Attempt to delete protected main file ignored:', path); return Promise.resolve() }
        delete mem[n]
        try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); delete map[n]; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){}
        // also attempt to remove from interpreter FS
        try{
          const fs = window.__ssg_runtime_fs
          if(fs){
            try{ if(typeof fs.unlink === 'function') fs.unlink(n); else if(typeof fs.unlinkSync === 'function') fs.unlinkSync(n) }catch(_e){}
          }
        }catch(_e){}
  return backend.delete(n).catch(e=>{ console.error('VFS delete failed', e); throw e })
      }
    }

  // Files panel removed — keep a no-op renderFilesList so other code can call it safely.
  function renderFilesList(){ /* no-op: tabs are the primary UI */ }
    // Helper to reload files from backend into the UI memory and optionally open tabs
    async function reloadFilesFromBackend(backend){
      try{
        if(!backend || typeof backend.list !== 'function') return
        const names = await backend.list()
        const newMem = Object.create(null)
        for(const n of names){
          try{ const c = await backend.read(n); if(c != null) newMem[n] = c }catch(_e){}
        }
        // Replace mem entirely with backend contents to avoid stale entries
        mem = newMem
        // update localStorage mirror for tests and UI fallbacks
        try{ const map = Object.create(null); for(const k of Object.keys(mem)) map[k]=mem[k]; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){}
        try{ if(typeof renderFilesList === 'function') renderFilesList() }catch(_e){}
        // open tabs for newly created files (but not MAIN_FILE)
        try{
          // Wait for TabManager to become available; if it's not present, retry a few times
          const maxAttempts = 10
          const delayMs = 100
          let opened = false
          for(let attempt=0; attempt<maxAttempts; attempt++){
                if(window.TabManager && typeof window.TabManager.openTab === 'function'){
            try{
            const existing = (window.TabManager.list && window.TabManager.list()) || []
            for(const n0 of names){
                  const n = (n0 && n0.startsWith('/')) ? n0 : ('/' + n0)
                  if(n === MAIN_FILE) continue
                  if(!existing.includes(n)){
              try{ window.TabManager.openTab(n) }catch(_e){}
                  }
                }
                opened = true
                break
              }catch(_e){ /* continue retrying */ }
            }
            await new Promise(r=>setTimeout(r, delayMs))
          }
          // If TabManager still not available, stash pending tabs for TabManager to consume on init
          if(!opened){
            try{ window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat(names.filter(n=> n !== MAIN_FILE)) }catch(_e){}
          }
        }catch(_e){}
      }catch(e){ appendTerminal('Reload backend files failed: ' + e) }
    }
    }catch(e){ /* VFS init failed; keep using local FileManager */ }

  // Simple modal editor (re-uses snapshot modal styles) -------------------------------------------------
  function openFileEditor(path){
    // create modal elements lazily
    let modal = document.getElementById('file-modal')
    if(!modal){
      modal = document.createElement('div')
      modal.id = 'file-modal'
      modal.className = 'modal file-modal'
      modal.setAttribute('aria-hidden','true')
      modal.innerHTML = `
      <div class="modal-content">
        <h3 id="file-modal-title">File</h3>
        <div>
          <label>Path: <input id="file-path" style="width:60%"></label>
        </div>
        <div style="margin-top:8px">
          <textarea id="file-body" style="width:100%;height:320px;font-family:monospace"></textarea>
        </div>
        <div class="modal-actions">
          <button id="file-save">Save</button>
          <button id="file-close">Close</button>
        </div>
      </div>`
      document.body.appendChild(modal)
      // wire buttons
      modal.querySelector('#file-close').addEventListener('click', ()=> closeModal(modal))
      // add an inline error message area
      const err = document.createElement('div'); err.id = 'file-modal-error'; err.style.color = 'red'; err.style.marginTop = '6px'; err.setAttribute('aria-live','polite')
      modal.querySelector('.modal-content').appendChild(err)
      modal.querySelector('#file-save').addEventListener('click', ()=>{
        const p = modal.querySelector('#file-path').value.trim()
        const b = modal.querySelector('#file-body').value
        if(!p){ err.textContent = 'Path required'; return }
        err.textContent = ''
        FileManager.write(p,b)
        closeModal(modal)
        renderFilesList()
      })
    }
  openModal(modal)
    modal.querySelector('#file-modal-title').textContent = 'Edit file: ' + path
    modal.querySelector('#file-path').value = path
    modal.querySelector('#file-body').value = FileManager.read(path) || ''
  }

  // File-panel controls were removed from the UI; file creation/upload flows
  // are handled via TabManager and the editor now. The previous DOM hooks
  // for new/refresh/upload are intentionally removed.

  // initial render of files
  renderFilesList()

  // expose FileManager and editor globals for tests and console
  try{ window.FileManager = FileManager }catch(e){}
  if(cm) try{ window.cm = cm }catch(e){}

  // --- Tab manager integrating files with CodeMirror ---
  const TabManager = (function(){
    const tabsHost = document.getElementById('tabs-left')
    const newBtn = document.getElementById('tab-new')
    let openTabs = [] // array of paths
    let active = null

  function render(){
  tabsHost.innerHTML = ''
      openTabs.forEach(p=>{
        const tab = document.createElement('div')
        tab.className = 'tab' + (p===active ? ' active' : '')
        tab.setAttribute('role','tab')
    const label = p.startsWith('/') ? p.slice(1) : p
    tab.innerHTML = `<span class="tab-label">${label}</span>`
        const close = document.createElement('button')
        close.className = 'close'
        close.title = 'Close'
  // hide close for protected main file
  if(p === MAIN_FILE){ close.style.display = 'none' }
  else { close.innerHTML = '×'; close.addEventListener('click', (ev)=>{ ev.stopPropagation(); closeTab(p) }) }
        tab.appendChild(close)
        tab.addEventListener('click', ()=> selectTab(p))
        tabsHost.appendChild(tab)
      })
      // Debug: surface current openTabs and DOM labels into the terminal so tests can capture timing issues
      try{
        const labels = Array.from(tabsHost.querySelectorAll('.tab-label')).map(e=>e.textContent)
        appendTerminalDebug('TabManager.render -> openTabs: ' + openTabs.join(',') + ' | DOM labels: ' + labels.join(','))
      }catch(_e){}
    }

    function _normalizePath(p){ if(!p) return p; return p.startsWith('/') ? p : ('/' + p) }

    async function openTab(path){
      const n = _normalizePath(path)
  appendTerminalDebug('TabManager.openTab called -> ' + n)
        if(!openTabs.includes(n)) {
          openTabs.push(n)
        }
      selectTab(n)
      render()
  // Signal an opened tab for external observers/tests
  try{ window.__ssg_last_tab_opened = { path: n, ts: Date.now() } }catch(_e){}
  try{ window.dispatchEvent(new CustomEvent('ssg:tab-opened', { detail: { path: n } })) }catch(_e){}
    }

    function forceClose(path){
      const n = _normalizePath(path)
      // delete from storage without confirmation
      try{ FileManager.delete(n) }catch(_e){}
      openTabs = openTabs.filter(x=>x!==n)
      if(active === n) active = openTabs.length ? openTabs[openTabs.length-1] : null
      if(active) selectTab(active)
      else{
        if(cm) cm.setValue('')
        else textarea.value = ''
      }
      try{ renderFilesList() }catch(_e){}
      render()
    }

    async function closeTab(path){
      const n = _normalizePath(path)
      // delete from storage and close tab — use accessible confirm modal
      try{
        const ok = await showConfirmModal('Close and delete', 'Close and delete file "' + n + '"? This will remove it from storage.')
        if(!ok) return
      }catch(_e){ return }
      FileManager.delete(n)
      openTabs = openTabs.filter(x=>x!==n)
      if(active === n) active = openTabs.length ? openTabs[openTabs.length-1] : null
      if(active) selectTab(active)
      else{
        // clear editor
        if(cm) cm.setValue('')
        else textarea.value = ''
      }
      renderFilesList()
      render()
    }

    function selectTab(path){
      const n = _normalizePath(path)
      active = n
      const content = FileManager.read(n) || ''
      if(cm) cm.setValue(content)
      else textarea.value = content
      render()
    }

    async function createNew(){
  const name = await showInputModal('New file', 'New file path (e.g. main.py):', '')
      if(!name) return
      const n = _normalizePath(name)
      FileManager.write(n, '')
      renderFilesList()
      openTab(n)
    }

    if(newBtn) newBtn.addEventListener('click', createNew)

    // autosave current active tab on editor changes (debounced)
    let tabSaveTimer = null
    function scheduleTabSave(){
      if(!active) return
      if(tabSaveTimer) clearTimeout(tabSaveTimer)
      tabSaveTimer = setTimeout(()=>{
        const content = cm ? cm.getValue() : textarea.value
        try{
          const stored = FileManager.read(active)
          if(stored === content) {
            const ind = $('autosave-indicator')
            if(ind) ind.textContent = 'Saved (' + active + ')'
            return
          }
        }catch(_e){}
        FileManager.write(active, content)
        const ind = $('autosave-indicator')
        if(ind) ind.textContent = 'Saved (' + active + ')'
  }, 300)
    }
  if(cm){ cm.on('change', scheduleTabSave) } else { textarea.addEventListener('input', scheduleTabSave) }

  return { openTab, closeTab, selectTab, list: ()=> { try{ appendTerminalDebug('TabManager.list -> ' + openTabs.join(',')) }catch(_e){}; return openTabs }, getActive: ()=> active, forceClose, refresh: ()=> { try{ render() }catch(_e){} } }
  })()

  // expose TabManager globally for tests
  try{ window.TabManager = TabManager }catch(e){}

  // Ensure main file is open in initial tab and selected
  TabManager.openTab(MAIN_FILE)

  // If any tabs were queued while TabManager wasn't available, open them now.
  try{
    const pending = (window.__ssg_pending_tabs || [])
    if(pending && pending.length && window.TabManager && typeof window.TabManager.openTab === 'function'){
      for(const p of pending){ try{ window.TabManager.openTab(p) }catch(_e){} }
      try{ window.__ssg_pending_tabs = [] }catch(_e){}
    }
  }catch(_e){}

  // Helper: flush any pending tabs asynchronously. This runs repeatedly when
  // the notifier queues new tabs and ensures TabManager.openTab is called
  // at a safe time (after runtime/backend sync) without blocking the notifier.
  function flushPendingTabs(){
    try{
      const pending = (window.__ssg_pending_tabs || [])
      if(!pending || !pending.length) return
      if(!(window.TabManager && typeof window.TabManager.openTab === 'function')) return
      const existing = (window.TabManager.list && window.TabManager.list()) || []
      for(const p of pending){
        try{
          if(!existing.includes(p)) window.TabManager.openTab(p)
        }catch(_e){}
      }
      try{ window.__ssg_pending_tabs = [] }catch(_e){}
    }catch(_e){}
  }

  // (renderFilesList already attaches Open handlers when it builds the DOM)


  // Helper: transform user source by replacing input(...) with await host.get_input(...)
  // and wrap in an async runner. Returns {code: wrappedCode, headerLines}
  function transformAndWrap(userCode){
    // tokenizer-aware replacement: skip strings and comments and only replace
    // real code occurrences of `input(`. This behaves like an AST-aware rewrite
    // for the common cases while keeping everything in-client.
    function safeReplaceInput(src){
      let out = ''
      const N = src.length
      let i = 0
      let state = 'normal' // normal | single | double | tri-single | tri-double | comment
      while(i < N){
        // detect triple-quoted strings first
        if(state === 'normal'){
          // line comment
          if(src[i] === '#'){
            // copy until newline or end
            const j = src.indexOf('\n', i)
            if(j === -1){ out += src.slice(i); break }
            out += src.slice(i, j+1)
            i = j+1
            continue
          }
          // triple single
          if(src.startsWith("'''", i)){
            state = 'tri-single'
            out += "'''"
            i += 3
            continue
          }
          // triple double
          if(src.startsWith('"""', i)){
            state = 'tri-double'
            out += '"""'
            i += 3
            continue
          }
          // single-quote
          if(src[i] === "'"){
            state = 'single'
            out += src[i++]
            continue
          }
          // double-quote
          if(src[i] === '"'){
            state = 'double'
            out += src[i++]
            continue
          }

          // detect identifier 'input' with word boundary and a following '('
          if(src.startsWith('input', i) && (i === 0 || !(/[A-Za-z0-9_]/.test(src[i-1])))){
            // lookahead for optional whitespace then '('
            let j = i + 5
            while(j < N && /\s/.test(src[j])) j++
            if(j < N && src[j] === '('){
              out += 'await host.get_input'
              i += 5
              continue
            }
          }

          // default: copy char
          out += src[i++]
        } else if(state === 'single'){
          // inside single-quoted string
          if(src[i] === '\\'){
            out += src.substr(i, 2)
            i += 2
            continue
          }
          if(src[i] === "'"){
            state = 'normal'
            out += src[i++]
            continue
          }
          out += src[i++]
        } else if(state === 'double'){
          if(src[i] === '\\'){
            out += src.substr(i, 2)
            i += 2
            continue
          }
          if(src[i] === '"'){
            state = 'normal'
            out += src[i++]
            continue
          }
          out += src[i++]
        } else if(state === 'tri-single'){
          if(src.startsWith("'''", i)){
            state = 'normal'
            out += "'''"
            i += 3
            continue
          }
          out += src[i++]
        } else if(state === 'tri-double'){
          if(src.startsWith('"""', i)){
            state = 'normal'
            out += '"""'
            i += 3
            continue
          }
          out += src[i++]
        } else {
          // unknown state fallback
          out += src[i++]
        }
      }
      return out
    }

    const replaced = safeReplaceInput(userCode)

    const headerLinesArr = [
      'import host',
      '# Asyncio compatibility wrapper: prefer asyncio.run or uasyncio.run, fallback to get_event_loop().run_until_complete',
      'try:',
      "    import asyncio as _asyncio",
      "    _run = getattr(_asyncio, 'run', None)",
      "except Exception:",
      "    _asyncio = None\n    _run = None",
      "# prefer uasyncio.run if available (MicroPython often exposes this)",
      "try:",
      "    import uasyncio as _ua",
      "    if _run is None:",
      "        _run = getattr(_ua, 'run', None)",
      "except Exception:",
      "    _ua = None",
      "# fallback: use asyncio.get_event_loop().run_until_complete if present",
      "if _run is None and _asyncio is not None:",
      "    try:",
      "        _loop = _asyncio.get_event_loop()",
      "        if hasattr(_loop, 'run_until_complete'):",
      "            def _run(coro): _loop.run_until_complete(coro)",
      "    except Exception:",
      "        _run = None",
      "",
      "async def __ssg_main():"
    ]
    const indent = (line)=> '    ' + line
    const body = replaced.split('\n').map(indent).join('\n')
  const footer = `if _run is None:\n    raise ImportError('no async runner available')\n_run(__ssg_main())`
    const full = headerLinesArr.join('\n') + '\n' + body + '\n' + footer
    return { code: full, headerLines: headerLinesArr.length }
  }

  // Prefer local vendored module: ./vendor/micropython.mjs if present (dynamic import)
  try{
    let localMod = null
    try{
      localMod = await import('./vendor/micropython.mjs')
    }catch(e){
      // dynamic import failed or isn't allowed; instead create a small inline module that
      // imports the vendored module and assigns its exports to window.__ssg_runtime so we
      // can access its exports from non-module code.
      const bridgeSrc = `import * as m from './vendor/micropython.mjs'; window.__ssg_runtime = m;`;
      const bridge = document.createElement('script')
      bridge.type = 'module'
      bridge.textContent = bridgeSrc
      // append and wait for the bridge to run (it will populate window.__ssg_runtime if import succeeds)
      document.head.appendChild(bridge)
  appendTerminalDebug('Injected inline module bridge for vendor runtime: ./vendor/micropython.mjs')
      // wait up to a short timeout for the bridge to populate the global
      const waitForGlobal = async (timeoutMs=2500)=>{
        const start = Date.now()
        while(Date.now() - start < timeoutMs){
          if(window.__ssg_runtime) return window.__ssg_runtime
          await new Promise(r=>setTimeout(r, 150))
        }
        return null
      }
      localMod = await waitForGlobal()
    }
    if(localMod){
      appendTerminalDebug('Loaded local vendor runtime (via import/bridge): ./vendor/micropython.mjs')
    }
    // build adapter from exports
    if(localMod){
      // Prefer the modern loader API if present: loadMicroPython
      if(typeof localMod.loadMicroPython === 'function'){
  appendTerminalDebug('Vendor module provides loadMicroPython(); initializing runtime...')
          try{
          let captured = ''
          const td = new TextDecoder()
          const stdout = (chunk)=>{
            if(typeof chunk === 'string'){
              // bridge sends decoded lines without newline; restore a newline for readability
              captured += chunk + '\n'
            }else if(chunk && (chunk instanceof Uint8Array || ArrayBuffer.isView(chunk))){
              captured += td.decode(chunk)
            }else if(typeof chunk === 'number'){
              captured += String(chunk)
            }else{
              captured += String(chunk || '')
            }
          }
          const stderr = (chunk)=>{ stdout(chunk) }
          const mpInstance = await localMod.loadMicroPython({
            url: (cfg?.runtime?.wasm) || './vendor/micropython.wasm',
            stdout, stderr, linebuffer: true
          })
          // expose runtime FS for persistence sync
          try{ window.__ssg_runtime_fs = mpInstance.FS }catch(e){}
          // Wrap common FS ops to notify host when files are written
          try{
            const fs = mpInstance.FS
            try{ fs.__ssg_fd_map = fs.__ssg_fd_map || {} }catch(_e){}
            if(fs){
              // wrap open to remember fd -> { path, wrote }
              if(typeof fs.open === 'function'){
                const origOpen = fs.open.bind(fs)
                fs.open = function(path, flags, mode){
                  const fd = origOpen(path, flags, mode)
                  try{ fs.__ssg_fd_map[fd] = { path: path, wrote: false } }catch(_e){}
                  return fd
                }
              }
              // wrap write: after writing, attempt to read and notify
              if(typeof fs.write === 'function'){
                const origWrite = fs.write.bind(fs)
                fs.write = function(fd, buffer, offset, length, position){
                  const res = origWrite(fd, buffer, offset, length, position)
                  try{
                    // mark this fd as having been written to
                    try{ const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]; if(meta) meta.wrote = true }catch(_e){}
                    const p = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                    const path = p && p.path ? p.path : fd
                    // notify asynchronously to avoid re-entrant stack loops during close/read
                    setTimeout(()=>{
                      try{
                        if(window.__ssg_suppress_notifier) return
                        if(typeof fs.readFile === 'function'){
                          try{
                            const data = fs.readFile(path)
                            const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                            try{ if(typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, text) }catch(_e){}
                          }catch(_e){}
                        }
                      }catch(_e){}
                    }, 0)
                  }catch(_e){}
                  return res
                }
              }
              // wrap close: after close, read the file and notify
              if(typeof fs.close === 'function'){
                const origClose = fs.close.bind(fs)
                fs.close = function(fd){
                  const res = origClose(fd)
                  try{
                    const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                    if(meta){
                      // only notify if this fd was written to (avoid notifications for pure reads)
                      if(meta.wrote){
                        // schedule notify after current stack unwinds to avoid recursion
                        setTimeout(()=>{
                          try{
                            if(window.__ssg_suppress_notifier) return
                            try{
                              if(typeof fs.readFile === 'function'){
                                const data = fs.readFile(meta.path)
                                const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                                try{ if(typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(meta.path, text) }catch(_e){}
                              }
                            }catch(_e){}
                          }catch(_e){}
                        }, 0)
                      }
                      try{ delete fs.__ssg_fd_map[fd] }catch(_e){}
                    }
                  }catch(_e){}
                  return res
                }
              }
              // wrap createDataFile which some runtimes use to create files
              if(typeof fs.createDataFile === 'function'){
                const origCreateDataFile = fs.createDataFile.bind(fs)
                fs.createDataFile = function(parent, name, data, canRead, canWrite){
                  const res = origCreateDataFile(parent, name, data, canRead, canWrite)
                  try{
                    const path = (parent === '/' ? '' : parent) + '/' + name
                    const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data || new Uint8Array()))
                    try{ if(typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, text) }catch(_e){}
                  }catch(_e){}
                  return res
                }
              }
            }
          }catch(_e){}
          // If VFS backend is available, mount files into the runtime FS so interpreter sees them
          try{
            const backend = window.__ssg_vfs_backend
            if(backend && typeof backend.mountToEmscripten === 'function'){
              await backend.mountToEmscripten(mpInstance.FS)
              appendTerminal('VFS mounted into MicroPython FS')
            }
          }catch(e){ appendTerminal('VFS mount error: ' + e) }
          // register a host module so transformed code can await host.get_input()
          try{
            const hostModule = {
              get_input: async function(promptText=''){
                // Return a JS promise that resolves when the user sends input via the UI
                return new Promise((resolve)=>{
                  // store resolver temporarily on the window so UI handler can find it
                  window.__ssg_pending_input = { resolve, promptText }
                  // focus the stdin-box for immediate typing
                  const stdinBox = $('stdin-box')
                  if(stdinBox){ stdinBox.focus(); }
                })
              }
            }
            if(typeof mpInstance.registerJsModule === 'function') mpInstance.registerJsModule('host', hostModule)
            else window.__ssg_host = hostModule
          }catch(e){ /* ignore */ }

          // Add a host notification for file writes so runtime can notify the UI immediately
          try{
            // expose a global notifier the UI side will implement
            window.__ssg_notify_file_written = window.__ssg_notify_file_written || (function(){
              // debounce rapid notifications per-path to avoid notifier->UI->save->notifier loops
              const lastNotified = new Map()
              const DEBOUNCE_MS = 120
              return function(path, content){
                try{
                  // global suppress guard: if set, ignore runtime-originated notifications
                  try{ if(window.__ssg_suppress_notifier){ try{ appendTerminal && appendTerminal('[notify] globally suppressed: ' + String(path)) }catch(_e){}; return } }catch(_e){}
                  if(typeof path !== 'string') return
                  const n = '/' + path.replace(/^\/+/,'' )

                  // debounce duplicates
                  try{
                    const prev = lastNotified.get(n) || 0
                    const now = Date.now()
                    if(now - prev < DEBOUNCE_MS) return
                    lastNotified.set(n, now)
                  }catch(_e){}

                  // If this notification matches an expected write we performed recently,
                  // consume it and skip further UI processing to avoid echo loops.
                  try{ if(consumeExpectedWriteIfMatches(n, content)) { appendTerminal && appendTerminal('[notify] ignored expected write: ' + n); return } }catch(_e){}
                  // Log the notification only after we've confirmed it's not an expected echo
                  try{ appendTerminal('notify: ' + n) }catch(_e){}
                  // update mem and localStorage mirror for tests and fallbacks (always keep mem in sync)
                  try{ if(typeof mem !== 'undefined'){ mem[n] = content } }catch(_e){}
                  try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); map[n]=content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){}

                  // Queue the path for the UI to open later via the existing pending-tabs flow.
                  // Avoid calling TabManager.openTab/refresh directly from here to prevent
                  // write->notify->UI-write recursion and timing races. The UI reload/sync
                  // logic will process `__ssg_pending_tabs` and open tabs at a safe point.
                  try{
                    if(n !== MAIN_FILE){
                      try{ window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat([n]) }catch(_e){}
                    }
                  }catch(_e){}

                  // Ensure the pending list is deduplicated but keep entries for the UI to consume.
                  try{ window.__ssg_pending_tabs = Array.from(new Set(window.__ssg_pending_tabs || [])) }catch(_e){}
                  try{ setTimeout(()=>{ try{ flushPendingTabs() }catch(_e){} }, 10) }catch(_e){}
                }catch(_e){}
              }
            })()
            // register into mpInstance host if possible
            if(typeof mpInstance.registerJsModule === 'function'){
              try{ mpInstance.registerJsModule('host_notify', { notify_file_written: (p,c)=> { try{ window.__ssg_notify_file_written(p, c) }catch(_e){} } }) }catch(_e){}
            }
            // Also attempt to wrap the runtime FS write methods to call the notifier
            try{
              const fs = mpInstance.FS
              if(fs){
                if(typeof fs.writeFile === 'function'){
                  const orig = fs.writeFile.bind(fs)
                  fs.writeFile = function(path, data){
                    const res = orig(path, data)
                    try{
                      if(!(window.__ssg_suppress_notifier)){
                        const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                        try{ window.__ssg_notify_file_written(path, text) }catch(_e){}
                      }
                    }catch(_e){}
                    return res
                  }
                }
                if(typeof fs.writeFileSync === 'function'){
                  const orig2 = fs.writeFileSync.bind(fs)
                  fs.writeFileSync = function(path, data){
                    const res = orig2(path, data)
                    try{
                      if(!(window.__ssg_suppress_notifier)){
                        const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                        try{ window.__ssg_notify_file_written(path, text) }catch(_e){}
                      }
                    }catch(_e){}
                    return res
                  }
                }
                if(typeof fs.writeFileText === 'function'){
                  const orig3 = fs.writeFileText.bind(fs)
                  fs.writeFileText = function(path, data){
                    const res = orig3(path, data)
                    try{
                      if(!(window.__ssg_suppress_notifier)){
                        try{ window.__ssg_notify_file_written(path, String(data)) }catch(_e){}
                      }
                    }catch(_e){}
                    return res
                  }
                }
              }
            }catch(_e){}
          }catch(_e){}

          runtimeAdapter = {
            run: async (code) => {
              captured = ''
              try{
                // prefer async runner if available
                if(typeof mpInstance.runPythonAsync === 'function'){
                  const maybe = await mpInstance.runPythonAsync(code)
                  return (captured || '') + (maybe == null ? '' : String(maybe))
                }
                if(typeof mpInstance.runPython === 'function'){
                  const maybe = mpInstance.runPython(code)
                  return (captured || '') + (maybe == null ? '' : String(maybe))
                }
                return captured || ''
              }catch(e){ throw e }
            }
          }
          appendTerminal('MicroPython runtime initialized')
        }catch(e){ appendTerminal('Failed to initialize vendored MicroPython: ' + e) }
      } else {
        const runFn = localMod.run || localMod.default?.run || localMod.MicroPy?.run || localMod.default
        if(typeof runFn === 'function'){
          runtimeAdapter = {
            run: async (code, input) => {
              // If module run accepts options, pass them; otherwise just call with code
              try{
                // call with (code, {input}) if supported
                const maybe = runFn.length >= 2 ? await runFn(code, {input, onPrint: (t)=>{/*ignored*/}}) : await runFn(code)
                return maybe === undefined ? '' : String(maybe)
              }catch(e){ throw e }
            }
          }
        } else if(localMod.exec && typeof localMod.exec === 'function'){
          runtimeAdapter = { run: async (code)=> String(await localMod.exec(code)) }
        }
      }
    }
  }catch(e){
    // ignore — vendor not present or failed to load
    // appendTerminal('Local vendor load failed: ' + e)
  }

  // If no local vendor adapter, choose runtime URL: explicit `runtime.url` or fallback to `runtime.recommended`.
  if(!runtimeAdapter){
    const runtimeUrl = (cfg?.runtime?.url && cfg.runtime.url.trim()) ? cfg.runtime.url.trim() : cfg?.runtime?.recommended
    if(runtimeUrl){
      try{
        const s = document.createElement('script')
        s.src = runtimeUrl
        // If the runtime is an ES module (.mjs), mark the script as a module so import.meta is allowed
        if(/\.mjs(\?|$)/i.test(runtimeUrl)){
          s.type = 'module'
        }
        s.defer = true
        // allow cross-origin fetching where appropriate
        s.crossOrigin = 'anonymous'
        document.head.appendChild(s)
  appendTerminalDebug('Runtime loader script appended: ' + runtimeUrl)

        // Probe for runtime availability for a short timeout and build an adapter
        runtimeAdapter = await (async function probeRuntime(timeoutMs=8000){
          const start = Date.now()
          function findGlobal(){
            // prefer explicit bridge global when present
            if(window.__ssg_runtime) return {type:'bridge', obj: window.__ssg_runtime}
            if(window.pyodide) return {type:'pyodide', obj: window.pyodide}
            if(window.MicroPy) return {type:'micropy', obj: window.MicroPy}
            if(window.micropython) return {type:'micropy', obj: window.micropython}
            for(const k of Object.keys(window)){
              if(/micro(py|python)|micropy|micropython/i.test(k) && typeof window[k] === 'object'){
                return {type:'micropy', obj: window[k]}
              }
            }
            return null
          }

          while(Date.now() - start < timeoutMs){
            const found = findGlobal()
            if(found){
                  appendTerminalDebug('Runtime detected: ' + found.type)
              // helpful diagnostic: if it's the bridge, list exported keys
              try{
                if(found.type === 'bridge' && found.obj){
                  const keys = Object.keys(found.obj).slice(0,50)
                  appendTerminalDebug('Bridge exports: ' + keys.join(', '))
                }
              }catch(e){/*ignore*/}
              if(found.type === 'pyodide'){
                return {
                  run: async (code, input) => {
                    const indent = code.split('\n').map(l=>'    '+l).join('\n')
                    const wrapper = `import sys, io\nbuf = io.StringIO()\n_old = sys.stdout\nsys.stdout = buf\ntry:\n${indent}\nfinally:\n    sys.stdout = _old\nbuf.getvalue()`
                    return await window.pyodide.runPythonAsync(wrapper)
                  }
                }
              }
              // If the bridge/global offers loadMicroPython, initialize an instance and use it
              if(found.type === 'bridge' && found.obj){
                if(typeof found.obj.loadMicroPython === 'function'){
                  appendTerminalDebug('Bridge exposes loadMicroPython(); initializing...')
                  try{
                    let captured = ''
                    const td = new TextDecoder()
                    const stdout = (c)=>{
                      if(typeof c === 'string') captured += c + '\n'
                      else if(c && (c instanceof Uint8Array || ArrayBuffer.isView(c))) captured += td.decode(c)
                      else captured += String(c || '')
                    }
                    const stderr = (c)=> stdout(c)
                    const mp = await found.obj.loadMicroPython({url: (cfg?.runtime?.wasm) || './vendor/micropython.wasm', stdout, stderr, linebuffer: true})
                      try{ window.__ssg_runtime_fs = mp.FS }catch(e){}
                    // mount VFS if available
                    try{
                      const backend = window.__ssg_vfs_backend
                      if(backend && typeof backend.mountToEmscripten === 'function'){
                        await backend.mountToEmscripten(mp.FS)
                        appendTerminal('VFS mounted into MicroPython FS')
                      }
                    }catch(e){ appendTerminal('VFS mount error: ' + e) }
                    appendTerminal('Bridge MicroPython initialized')
                    return {
                      run: async (code, input) => {
                        captured = ''
                        if(typeof mp.runPythonAsync === 'function'){
                          const m = await mp.runPythonAsync(code)
                          return (captured || '') + (m == null ? '' : String(m))
                        }
                        if(typeof mp.runPython === 'function'){
                          const m = mp.runPython(code)
                          return (captured || '') + (m == null ? '' : String(m))
                        }
                        return captured || ''
                      }
                    }
                  }catch(e){ appendTerminal('Bridge init failed: ' + e) }
                }
              }

              return {
                run: async (code, input) => {
                  try{
                    if(typeof found.obj.run === 'function'){
                      let out = ''
                      if(found.obj.run.length >= 2){
                        await found.obj.run(code, {onPrint: (t)=> out += t + '\n', input})
                      }else{
                        const r = await found.obj.run(code)
                        if(r !== undefined) out += String(r)
                      }
                      return out
                    }
                    if(typeof found.obj.exec === 'function'){
                      const r = await found.obj.exec(code)
                      return r === undefined ? '' : String(r)
                    }
                  }catch(e){ throw e }
                  throw new Error('No runnable API found on detected runtime')
                }
              }
            }
            await new Promise(r=>setTimeout(r,200))
          }
          appendTerminal('Runtime probe timed out; no runtime available')
          return null
        })()
      }catch(e){
        appendTerminal('Failed to append runtime script: ' + e)
      }
    }
  }

  $('run').addEventListener('click', async ()=>{
    appendTerminal('>>> Running...')
    
    // Save current active tab's content (if any) so that latest edits are persisted
    try{
      const activePath = (typeof TabManager.getActive === 'function') ? TabManager.getActive() : null
      if(activePath){
          const current = (cm ? cm.getValue() : textarea.value)
          // await write to ensure persistence before running/assertions
          try{ await FileManager.write(activePath, current) }catch(_){ /* ignore write errors */ }
        }
        // Always persist the MAIN_FILE with current editor contents as run executes main.py
        try{
          const currentMain = (cm ? cm.getValue() : textarea.value)
          await FileManager.write(MAIN_FILE, currentMain)
        }catch(_){ /* ignore */ }
    }catch(_){ /* ignore */ }

    // Always run the protected main program file
    const code = FileManager.read(MAIN_FILE) || ''
  // Ensure runtimeAdapter exists (no worker path supported)
  if(!runtimeAdapter){ appendTerminal('ERROR: no runtime available') ; return }

    // Regex-based feedback: rules can target `code`, `output`, or `input`.
    // Prepare feedback/input/output variables
    const rules = (cfg?.feedback?.regex) || []
    let runtimeOutput = ''
    let providedInput = ''
    try{
      // If any rule targets input, prompt the user once
      const needsInput = rules.some(r=> r.target === 'input')
  if(needsInput){ providedInput = (await showInputModal('Program input', 'Provide input for the program (used by some feedback rules):', '')) || '' }

      for(const r of rules){
        const target = r.target || 'code'
        const text = (target === 'code') ? code : (target === 'output') ? runtimeOutput : (target === 'input') ? providedInput : ''
        const re = new RegExp(r.pattern)
        if(re.test(text)){
          appendTerminal('Feedback (' + target + '): ' + r.message)
        }
      }
    }catch(e){ appendTerminal('Feedback engine error: ' + e) }

  // Yield once to ensure the click event completes and the browser can update.
  await new Promise(r => setTimeout(r, 0))
  appendTerminal('Run handler resumed after yield')

  // Transform code to async wrapper so input() becomes await host.get_input()
    try{
      const { code: transformed, headerLines } = transformAndWrap(code)
      // If transformed code expects input, focus the stdin box and wire Enter->send
      const stdinBox = $('stdin-box')
      if(/\bawait host.get_input\(/.test(transformed) && stdinBox){
        stdinBox.focus()
        // ensure Enter submits
        const submitHandler = (ev)=>{
          if(ev.key === 'Enter'){
            ev.preventDefault()
            const val = stdinBox.value || ''
            // resolve any pending promise created by host.get_input
            if(window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function'){
              window.__ssg_pending_input.resolve(val)
              delete window.__ssg_pending_input
            }
            appendTerminal('[UI] stdin sent: ' + JSON.stringify(val))
            stdinBox.value = ''
          }
        }
        stdinBox.addEventListener('keydown', submitHandler, { once: false })
      }

      if(runtimeAdapter && typeof runtimeAdapter.run === 'function'){
        try{
          // Ensure backend files are mounted into the interpreter FS before running.
          try{
            const backend = window.__ssg_vfs_backend
            const fs = window.__ssg_runtime_fs
            // First, ensure any UI FileManager contents are pushed into the backend so mount sees them
            try{
      if(backend && typeof backend.write === 'function' && typeof FileManager?.list === 'function'){
                const files = FileManager.list()
                for(const p of files){
                  try{
                    const c = FileManager.read(p)
                    // backend.write expects normalized path
        // suppress notifier echoes while we push UI files into backend
        try{ window.__ssg_suppress_notifier = true }catch(_e){}
        await backend.write(p, c == null ? '' : c)
        try{ window.__ssg_suppress_notifier = false }catch(_e){}
                  }catch(_e){ /* ignore per-file */ }
                }
                appendTerminal('Synced UI FileManager -> backend (pre-run)')
              } else if(fs && typeof fs.writeFile === 'function' && typeof FileManager?.list === 'function'){
                // no async backend available; write directly into runtime FS from UI FileManager
                const files = FileManager.list()
        for(const p of files){
                  try{
                    const content = FileManager.read(p) || ''
                    try{ markExpectedWrite(p, content) }catch(_e){}
          try{ window.__ssg_suppress_notifier = true }catch(_e){}
          fs.writeFile(p, content)
          try{ window.__ssg_suppress_notifier = false }catch(_e){}
                  }catch(_e){}
                }
                appendTerminal('Synced UI FileManager -> runtime FS (pre-run)')
              }
            }catch(_e){ appendTerminal('Pre-run sync error: ' + _e) }

            if(backend && typeof backend.mountToEmscripten === 'function' && fs){
              appendTerminal('Ensuring VFS is mounted into MicroPython FS (pre-run)')
              // Mark expected writes for backend files so mount echoes are ignored by the notifier.
              try{
                const bk = await backend.list()
                for(const p of bk){ try{ const c = await backend.read(p); markExpectedWrite(p, c || '') }catch(_e){} }
              }catch(_e){}
              let mounted = false
              for(let attempt=0; attempt<3 && !mounted; attempt++){
                try{
                  try{ window.__ssg_suppress_notifier = true }catch(_e){}
                  await backend.mountToEmscripten(fs)
                  try{ window.__ssg_suppress_notifier = false }catch(_e){}
                  mounted = true
                  appendTerminal('VFS mounted into MicroPython FS (pre-run)')
                }catch(merr){
                  appendTerminal('VFS pre-run mount attempt #' + (attempt+1) + ' failed: ' + String(merr))
                  await new Promise(r=>setTimeout(r, 150))
                }
              }
              if(!mounted) appendTerminal('Warning: VFS pre-run mount attempts exhausted')
            }
          }catch(_m){ appendTerminal('VFS pre-run mount error: ' + _m) }

          
          const out = await runtimeAdapter.run(transformed)
          const runtimeOutput = out === undefined ? '' : String(out)
          appendTerminal('Runtime result:\n' + runtimeOutput)
            // After run completes, sync any interpreter-side FS changes back to persistent VFS
              try{
                const backend = window.__ssg_vfs_backend
                const fs = window.__ssg_runtime_fs
                  if(backend && typeof backend.syncFromEmscripten === 'function' && fs) {
                  await backend.syncFromEmscripten(fs)
                  try{ await reloadFilesFromBackend(backend); try{ openTabsFromMem() }catch(_e){} }catch(_e){}
                  // Additionally, attempt to persist runtime FS files directly into mem/localStorage
                  try{
                    if(fs && typeof fs.readdir === 'function'){
                      const entries = fs.readdir('/')
                      for(const en of entries){
                        if(!en) continue
                        if(en === '.' || en === '..') continue
                        const path = en.startsWith('/') ? en : ('/' + en)
                        try{
                          let content = null
                          if(typeof fs.readFile === 'function'){
                            const data = fs.readFile(path)
                            content = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                          }else if(typeof fs.readFileSync === 'function'){
                            const data = fs.readFileSync(path)
                            content = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                          }
                          if(content != null){
                            const norm = '/' + path.replace(/^\/+/, '')
                            mem[norm] = content
                            try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); map[norm]=content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){}
                          }
                        }catch(_e){}
                      }
                      try{ openTabsFromMem() }catch(_e){}
                    }
                  }catch(_e){}
                } else {
                  // ensure localStorage fallback is updated for MAIN_FILE so tests can read it
                  try{
                    const cur = (cm ? cm.getValue() : textarea.value)
                    const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}')
                    map['/main.py'] = cur
                    localStorage.setItem('ssg_files_v1', JSON.stringify(map))
                  }catch(_e){}
                  // If runtime FS is present, persist its files into mem/localStorage so UI can pick them up
                  try{
                    const fs = window.__ssg_runtime_fs
                    if(fs && typeof fs.readdir === 'function'){
                      try{
                        const entries = fs.readdir('/')
                        for(const en of entries){
                          if(!en) continue
                          if(en === '.' || en === '..') continue
                          const path = '/' + en
                          try{
                            let content = null
                            // Try both '/name' and 'name' forms for runtime FS reads
                            const tryPaths = [path, en]
                            for(const tp of tryPaths){
                              try{
                                if(typeof fs.readFile === 'function'){
                                  const data = fs.readFile(tp)
                                  if(data){ content = (typeof data === 'string') ? data : (new TextDecoder().decode(data)); break }
                                }else if(typeof fs.readFileSync === 'function'){
                                  const data = fs.readFileSync(tp)
                                  if(data){ content = (typeof data === 'string') ? data : (new TextDecoder().decode(data)); break }
                                }
                              }catch(_e){}
                            }
                            if(content != null){ const norm = '/' + path.replace(/^\/+/, ''); mem[norm] = content; try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); map[norm]=content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){} }
                          }catch(_e){}
                        }
                      }catch(_e){}
                    }
                  }catch(_e){}
                  // Give runtime a short moment to flush files, then open tabs from mem
                  try{ setTimeout(()=>{ try{ openTabsFromMem() }catch(_e){} }, 80) }catch(_e){}
                }
              }catch(e){ appendTerminal('VFS sync after run failed: ' + e) }
        }catch(e){
          const msg = String(e || '')
          // If no async runner is available, fall back to a pre-prompt strategy
          if(/no async runner available/i.test(msg)){
            try{
              // ensure VFS mounted before entering fallback loop
              try{
                const backend = window.__ssg_vfs_backend
                const fs = window.__ssg_runtime_fs
                if(backend && typeof backend.mountToEmscripten === 'function' && fs){
                  appendTerminal('Ensuring VFS is mounted into MicroPython FS (pre-fallback)')
                  let ok=false
                  for(let i=0;i<3 && !ok;i++){
                    try{ await backend.mountToEmscripten(fs); ok=true; appendTerminal('VFS mounted into MicroPython FS (pre-fallback)') }catch(e){ appendTerminal('VFS pre-fallback mount failed: '+e); await new Promise(r=>setTimeout(r,120)) }
                  }
                  if(!ok) appendTerminal('Warning: VFS pre-fallback mount attempts exhausted')
                }
              }catch(_e){ appendTerminal('VFS pre-fallback mount error: ' + _e) }
              // Iterative split-run fallback: handle multiple sequential input() calls.
              const lines = code.split('\n')
              let executedLine = 0
              // Helper to run a block of lines [start, end) and append output
              const runBlock = async (start, end)=>{
                if(end <= start) return
                const block = lines.slice(start, end).join('\n')
                try{
                  const out = await runtimeAdapter.run(block)
                  if(out) appendTerminal(out)
                }catch(err){
                  // Map traceback with offset = start (lines already executed)
                  mapTracebackAndShow(String(err), start, code)
                  throw err
                }
              }

              while(true){
                // find next input() line from executedLine onwards
                let nextInputLine = -1
                for(let i = executedLine; i < lines.length; i++){
                  if(/\binput\s*\(/.test(lines[i])){ nextInputLine = i; break }
                }
                if(nextInputLine === -1) break // no more inputs

                // run code up to the line with the input (non-inclusive)
                await runBlock(executedLine, nextInputLine)

                // prepare prompt text (if input literal present on this line)
                const inputLine = lines[nextInputLine]
                const promptMatch = inputLine.match(/input\s*\(\s*(['\"])(.*?)\1\s*\)/)
                const promptText = promptMatch ? promptMatch[2] : ''
                appendTerminal(promptText)
                const stdinBoxLocal = $('stdin-box')
                if(stdinBoxLocal) stdinBoxLocal.focus()

                // wait for user submit via the existing pending_input mechanism
                const val = await new Promise((resolve)=>{
                  window.__ssg_pending_input = { resolve, promptText }
                })

                // replace only the first occurrence of input(...) on this line with a Python literal
                const literal = JSON.stringify(val)
                lines[nextInputLine] = inputLine.replace(/input\s*\(.*?\)/, literal)

                // execute the replaced line so any assignments/effects happen now
                await runBlock(nextInputLine, nextInputLine+1)

                // advance executedLine past the line we just executed
                executedLine = nextInputLine + 1
              }

              // finally run any remaining code after last input
              if(executedLine < lines.length){
                await runBlock(executedLine, lines.length)
              }
              // after fallback finished, sync FS back to persistent storage
              try{
                const backend = window.__ssg_vfs_backend
                const fs = window.__ssg_runtime_fs
                  if(backend && typeof backend.syncFromEmscripten === 'function' && fs) {
                  await backend.syncFromEmscripten(fs)
                  try{ await reloadFilesFromBackend(backend); try{ openTabsFromMem() }catch(_e){} }catch(_e){}
                } else {
                  try{ const cur = (cm ? cm.getValue() : textarea.value); const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); map['/main.py']=cur; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) }catch(_e){}
                  try{ openTabsFromMem() }catch(_e){}
                }
              }catch(_e){ appendTerminal('VFS sync after fallback failed: ' + _e) }
            }catch(_e){ appendTerminal('Fallback input error: ' + _e) }
          }else{
            try{ mapTracebackAndShow(String(e), headerLines, code) }catch(_){ appendTerminal('Runtime error: ' + e) }
          }
        }
      }else{
        appendTerminal('[error] no runtime adapter available')
      }
    }catch(e){ appendTerminal('Transform/run error: ' + e) }

    // Re-run regex feedback for rules targeting output now that runtimeOutput may be available
    try{
      const rules = (cfg?.feedback?.regex) || []
      for(const r of rules){
        if((r.target || 'code') === 'output'){
          const re = new RegExp(r.pattern)
          if(re.test(runtimeOutput)) appendTerminal('Feedback (output): ' + r.message)
        }
      }
    }catch(e){ appendTerminal('Feedback engine error (output pass): ' + e) }
  })

  // Wire stdin-send button to resolve pending host.get_input promises and clear the field
  const stdinSendBtn = $('stdin-send')
  const stdinBox = $('stdin-box')
  if(stdinSendBtn && stdinBox){
    stdinSendBtn.addEventListener('click', ()=>{
      const val = stdinBox.value || ''
      if(window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function'){
        window.__ssg_pending_input.resolve(val)
        delete window.__ssg_pending_input
      }
      appendTerminal('[UI] stdin sent: ' + JSON.stringify(val))
      stdinBox.value = ''
      stdinBox.focus()
    })
  }

  // Simple commit-like snapshot storage: save full VFS snapshot (all files)
    $('save-snapshot').addEventListener('click', async ()=>{
    try{
      const snaps = JSON.parse(localStorage.getItem('snapshots')||'[]')
      const snap = { ts: Date.now(), files: {} }
      // Use the global FileManager (if available) as the authoritative source for snapshot contents.
      // FileManager may be a synchronous localStorage-backed implementation or the in-memory/backend proxy.
      try{
        if(window.FileManager && typeof window.FileManager.list === 'function'){
          const names = window.FileManager.list()
          for(const n of names){
            try{ const v = await Promise.resolve(window.FileManager.read(n)); if(v != null) snap.files[n] = v }catch(_e){}
          }
        } else if(mem && Object.keys(mem).length){
          for(const k of Object.keys(mem)) snap.files[k] = mem[k]
        } else if(backendRef && typeof backendRef.list === 'function'){
          const names = await backendRef.list()
          for(const n of names){ try{ snap.files[n] = await backendRef.read(n) }catch(_e){} }
        } else {
          // fallback to localStorage mirror
          try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); for(const k of Object.keys(map)) snap.files[k] = map[k] }catch(_e){}
        }
      }catch(e){
        try{ const map = JSON.parse(localStorage.getItem('ssg_files_v1')||'{}'); for(const k of Object.keys(map)) snap.files[k] = map[k] }catch(_e){}
      }
      snaps.push(snap)
      localStorage.setItem('snapshots', JSON.stringify(snaps))
      appendTerminal('Snapshot saved (' + new Date(snap.ts).toLocaleString() + ')')
    }catch(e){ appendTerminal('Snapshot save failed: ' + e) }
  })

  // Autosave: debounce changes to localStorage
  const autosaveIndicator = $('autosave-indicator')
  let autosaveTimer = null
  function scheduleAutosave(){
    autosaveIndicator.textContent = 'Saving...'
    if(autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(()=>{
      const content = (cm ? cm.getValue() : textarea.value)
      localStorage.setItem('autosave', JSON.stringify({ts: Date.now(), code: content}))
      autosaveIndicator.textContent = 'Saved'
  }, 300)
  }
  // Hook editor change events
  if(cm){ cm.on('change', scheduleAutosave) } else { textarea.addEventListener('input', scheduleAutosave) }

  // Snapshot modal logic
  const modal = $('snapshot-modal')
  const snapshotList = $('snapshot-list')
  const closeSnapshots = $('close-snapshots')
  const deleteSelected = $('delete-selected')

  function renderSnapshots(){
    const snaps = JSON.parse(localStorage.getItem('snapshots')||'[]')
    if(!snaps.length){ snapshotList.textContent = 'No snapshots' ; return }
    snapshotList.innerHTML = ''
    snaps.forEach((s,i)=>{
      const div = document.createElement('div')
      div.className = 'snapshot-item'
      const left = document.createElement('div')
      left.innerHTML = `<label><input type="checkbox" data-idx="${i}"> ${new Date(s.ts).toLocaleString()}</label>`
      const right = document.createElement('div')
      const restore = document.createElement('button')
      restore.textContent = 'Restore'
      restore.addEventListener('click', async ()=>{
        try{
          const snap = snaps[i]
          if(!snap) return
          // write all files from the snapshot into the backend/mem
          if(backendRef && typeof backendRef.write === 'function'){
            // Clear existing backend files (except protected MAIN_FILE) then write snapshot files.
            try{
              const existing = await backendRef.list()
              for(const p of existing){
                try{ if(p === MAIN_FILE) continue; await backendRef.delete(p) }catch(_e){}
              }
            }catch(_e){}

            // Write snapshot files (overwrite or create)
            for(const p of Object.keys(snap.files || {})){
              try{ await backendRef.write(p, snap.files[p]) }catch(_e){}
            }

            try{ await reloadFilesFromBackend(backendRef) }catch(_e){}
            // Replace in-memory mirror with snapshot contents for synchronous reads
            try{ mem = Object.create(null); for(const p of Object.keys(snap.files || {})) mem[p] = snap.files[p] }catch(_e){}
          } else if(mem){
            // Replace mem entirely so files from other snapshots are removed
            try{ mem = Object.create(null); for(const p of Object.keys(snap.files || {})) mem[p] = snap.files[p] }catch(_e){}
            try{
              const newMap = Object.create(null)
              for(const k of Object.keys(mem)) newMap[k] = mem[k]
              localStorage.setItem('ssg_files_v1', JSON.stringify(newMap))
            }catch(_e){}
            try{ renderFilesList() }catch(_e){}
          }
          // Open only MAIN_FILE as focused tab
          try{ if(window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab(MAIN_FILE); if(window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(MAIN_FILE) }catch(_e){}

          // Reconcile via FileManager to ensure mem/localStorage/backend are consistent
          try{
            if(window.FileManager && typeof window.FileManager.list === 'function'){
              const existing = window.FileManager.list() || []
              for(const p of existing){
                try{ if(p === MAIN_FILE) continue; if(!Object.prototype.hasOwnProperty.call(snap.files||{}, p)){ await Promise.resolve(window.FileManager.delete(p)) } }catch(_e){}
              }
              for(const p of Object.keys(snap.files || {})){
                try{ await Promise.resolve(window.FileManager.write(p, snap.files[p])) }catch(_e){}
              }
            }
          }catch(_e){}

          // Definitively replace in-memory map with snapshot contents to avoid any stale entries
          try{
            mem = Object.create(null)
            for(const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
            try{ localStorage.setItem('ssg_files_v1', JSON.stringify(mem)) }catch(_e){}
          }catch(_e){}

          closeModal(modal)
          appendTerminal('Snapshot restored (' + new Date(s.ts).toLocaleString() + ')')
          try{ window.__ssg_last_snapshot_restore = Date.now() }catch(_e){}
        }catch(e){ appendTerminal('Snapshot restore failed: ' + e) }
      })
      right.appendChild(restore)
      div.appendChild(left)
      div.appendChild(right)
      snapshotList.appendChild(div)
    })
  }

  $('history').addEventListener('click', () =>{
    renderSnapshots()
    openModal(modal)
  })
  closeSnapshots.addEventListener('click', ()=> closeModal(modal))
  deleteSelected.addEventListener('click', ()=>{
    const checks = Array.from(snapshotList.querySelectorAll('input[type=checkbox]:checked'))
    if(!checks.length){ appendTerminal('No snapshots selected for deletion'); return }
    const idxs = checks.map(c=> Number(c.getAttribute('data-idx'))).sort((a,b)=>b-a)
    const snaps = JSON.parse(localStorage.getItem('snapshots')||'[]')
    for(const i of idxs) snaps.splice(i,1)
    localStorage.setItem('snapshots', JSON.stringify(snaps))
    renderSnapshots()
  })
  // Remove legacy prompt-based snapshot restore; use the modal UI instead.

  // Confirmation modal helper (uses DOM modal created in index.html)
  function showConfirmModal(title, message){
    return new Promise((resolve)=>{
      try{
        const m = document.getElementById('confirm-modal')
        const t = document.getElementById('confirm-modal-title')
        const msg = document.getElementById('confirm-modal-message')
        const yes = document.getElementById('confirm-yes')
        const no = document.getElementById('confirm-no')
        if(!m || !t || !msg || !yes || !no){
          // Fallback to window.confirm if the modal is missing
          const ok = window.confirm(message || title || 'Confirm?')
          resolve(!!ok)
          return
        }
        t.textContent = title || 'Confirm'
        msg.textContent = message || ''
        openModal(m)
        const onYes = ()=>{ cleanup(); resolve(true) }
        const onNo = ()=>{ cleanup(); resolve(false) }
        function cleanup(){
          try{ closeModal(m) }catch(_e){}
          try{ yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo) }catch(_e){}
        }
        yes.addEventListener('click', onYes)
        no.addEventListener('click', onNo)
      }catch(e){ resolve(false) }
    })

    
  }

  $('clear-storage').addEventListener('click', async ()=>{
    const ok = await showConfirmModal('Clear storage', 'Clear saved snapshots and storage?')
    if(!ok){ appendTerminal('Clear storage cancelled') ; return }
    try{ localStorage.removeItem('snapshots'); appendTerminal('Cleared snapshots and storage') }catch(e){ appendTerminal('Clear storage failed: ' + e) }
  })
}

main()
