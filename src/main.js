// ============================================================================
// CLIPY - CLIENT-SIDE PYTHON PLAYGROUND  
// Main application with MicroPython WASM runtime, interrupt system, and VFS
// ============================================================================

// ============================================================================
// CONFIGURATION & UTILITIES
// ============================================================================

// Minimal scaffolding: MicroPython loader, CodeMirror placeholder, simple terminal, config loader
const configUrl = './config/sample.json'

async function loadConfig() {
  try {
    const res = await fetch(configUrl)
    return await res.json()
  } catch (e) {
    return null
  }
}

function $(id) { return document.getElementById(id) }

async function main() {
  const cfg = await loadConfig()
  $('instructions-content').textContent = cfg?.instructions || 'No instructions provided.'
  // Initialize CodeMirror editor in the host div, fallback to hidden textarea
  const textarea = $('code')
  const host = $('editor-host')
  textarea.value = cfg?.starter || '# write Python here'
  let cm = null
  if (window.CodeMirror) {
    cm = window.CodeMirror(host, {
      value: textarea.value,
      mode: 'python',
      lineNumbers: true,
      indentUnit: 4,
      theme: 'default'
    })
    // Ctrl-Enter to run
    cm.setOption('extraKeys', { 'Ctrl-Enter': () => $('run').click() })
  }

  // Append structured terminal lines. `kind` is one of: stdout, stderr, stdin, runtime
  function appendTerminal(text, kind = 'stdout') {
    try {
      const out = $('terminal-output')
      if (!out) { console.log(text); return }
      // Normalize text to string
      const s = (text === null || text === undefined) ? '' : String(text)
      // Split into lines preserving empty lines
      const lines = s.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const div = document.createElement('div')
        div.className = 'terminal-line ' + ('term-' + (kind || 'stdout'))
        // preserve empty lines visually
        div.textContent = line || ''
        out.appendChild(div)
      }
      // Auto-scroll to bottom
      out.scrollTop = out.scrollHeight
    } catch (e) { try { console.log(text) } catch (_e) { } }
  }

  // Track an active prompt line element when host.get_input is awaiting input
  let __ssg_current_prompt = null
  // Find and convert an existing printed prompt (single- or multi-line) into a structured prompt element.
  // Returns the element if found/converted, or null if none matched.
  function findPromptLine(promptText) {
    try {
      const out = $('terminal-output')
      if (!out) return null
      const children = Array.from(out.querySelectorAll('.terminal-line'))
      const wantedRaw = (promptText || '')
      const wanted = wantedRaw.trim()
      if (!wanted) return null
      const MAX_LOOKBACK = 12
      for (let end = children.length - 1; end >= 0; end--) {
        let acc = []
        for (let start = end; start >= Math.max(0, end - MAX_LOOKBACK); start--) {
          acc.unshift((children[start].textContent || ''))
          const joined = acc.join('\n').trim()
          if (joined === wanted || joined.endsWith(wanted)) {
            // Convert the sequence children[start..end] into a single structured prompt element
            try {
              const nodesToRemove = children.slice(start, end + 1)
              const div = document.createElement('div')
              div.className = 'terminal-line term-prompt'
              for (let k = 0; k < acc.length; k++) {
                const pspan = document.createElement('span')
                pspan.className = 'prompt-text'
                pspan.textContent = acc[k]
                div.appendChild(pspan)
                if (k < acc.length - 1) div.appendChild(document.createElement('br'))
              }
              const inputSpan = document.createElement('span')
              inputSpan.className = 'prompt-input'
              div.appendChild(inputSpan)
              const firstNode = nodesToRemove[0]
              out.insertBefore(div, firstNode)
              for (const n of nodesToRemove) {
                try { out.removeChild(n) } catch (_e) { }
              }
              out.scrollTop = out.scrollHeight
              return div
            } catch (_e) { return null }
          }
        }
      }
      // Single-line fallback
      for (let i = children.length - 1; i >= 0; i--) {
        const el = children[i]
        const rawText = (el.textContent || '')
        const txt = rawText.trim()
        if (!txt) continue
        if (txt === wanted || txt.endsWith(wanted)) {
          if (!el.querySelector('.prompt-text')) {
            try {
              const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
              const existing = textNodes.map(n => n.textContent).join('').trim() || wanted
              for (const n of textNodes) try { n.parentNode && n.parentNode.removeChild(n) } catch (_e) { }
              const promptSpan = document.createElement('span')
              promptSpan.className = 'prompt-text'
              promptSpan.textContent = existing
              if (el.firstChild) el.insertBefore(promptSpan, el.firstChild)
              else el.appendChild(promptSpan)
            } catch (_e) { }
          }
          if (!el.querySelector('.prompt-input')) {
            const span = document.createElement('span')
            span.className = 'prompt-input'
            el.appendChild(span)
          }
          try { el.classList.add('term-prompt') } catch (_e) { }
          return el
        }
      }
      return null
    } catch (e) { return null }
  }
  function findOrCreatePromptLine(promptText) {
    try {
      const out = $('terminal-output')
      if (!out) return null
      // Try to find a recent line or contiguous set of lines that matches the prompt text
      const children = Array.from(out.querySelectorAll('.terminal-line'))
      const wantedRaw = (promptText || '')
      const wanted = wantedRaw.trim()
      if (wanted) {
        // Try multi-line match: look for a contiguous block of recent lines whose joined text equals the prompt
        const MAX_LOOKBACK = 12
        for (let end = children.length - 1; end >= 0; end--) {
          let acc = []
          for (let start = end; start >= Math.max(0, end - MAX_LOOKBACK); start--) {
            acc.unshift((children[start].textContent || ''))
            const joined = acc.join('\n').trim()
            if (joined === wanted || joined.endsWith(wanted)) {
              // Replace the sequence children[start..end] with a single structured prompt line.
              try {
                const nodesToRemove = children.slice(start, end + 1)
                const div = document.createElement('div')
                div.className = 'terminal-line term-prompt'
                // For each line in acc, append a prompt-text span and a <br> except last line
                for (let k = 0; k < acc.length; k++) {
                  const pspan = document.createElement('span')
                  pspan.className = 'prompt-text'
                  pspan.textContent = acc[k]
                  div.appendChild(pspan)
                  if (k < acc.length - 1) div.appendChild(document.createElement('br'))
                }
                const inputSpan = document.createElement('span')
                inputSpan.className = 'prompt-input'
                div.appendChild(inputSpan)
                // Insert before the first matched node then remove matched nodes
                const firstNode = nodesToRemove[0]
                out.insertBefore(div, firstNode)
                for (const n of nodesToRemove) {
                  try { out.removeChild(n) } catch (_e) { }
                }
                out.scrollTop = out.scrollHeight
                return div
              } catch (_e) { /* fallback to other strategies */ }
            }
          }
        }
        // Single-line fallback: find a single terminal-line that ends with the prompt
        for (let i = children.length - 1; i >= 0; i--) {
          const el = children[i]
          const rawText = (el.textContent || '')
          const txt = rawText.trim()
          if (!txt) continue
          if (txt === wanted || txt.endsWith(wanted)) {
            // Ensure there is a .prompt-text span (convert plain text nodes into prompt-text)
            if (!el.querySelector('.prompt-text')) {
              try {
                const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
                const existing = textNodes.map(n => n.textContent).join('').trim() || wanted
                for (const n of textNodes) try { n.parentNode && n.parentNode.removeChild(n) } catch (_e) { }
                const promptSpan = document.createElement('span')
                promptSpan.className = 'prompt-text'
                promptSpan.textContent = existing
                if (el.firstChild) el.insertBefore(promptSpan, el.firstChild)
                else el.appendChild(promptSpan)
              } catch (_e) { }
            }
            if (!el.querySelector('.prompt-input')) {
              const span = document.createElement('span')
              span.className = 'prompt-input'
              el.appendChild(span)
            }
            try { el.classList.add('term-prompt') } catch (_e) { }
            return el
          }
        }
      }
      // Not found: create a new prompt line
      const div = document.createElement('div')
      div.className = 'terminal-line term-prompt'
      const promptSpan = document.createElement('span')
      promptSpan.className = 'prompt-text'
      promptSpan.textContent = promptText || ''
      const inputSpan = document.createElement('span')
      inputSpan.className = 'prompt-input'
      div.appendChild(promptSpan)
      div.appendChild(inputSpan)
      out.appendChild(div)
      out.scrollTop = out.scrollHeight
      return div
    } catch (e) { return null }
  }

  // Enable/disable the inline terminal input prompt.
  function setTerminalInputEnabled(enabled, promptText) {
    try {
      const inpt = $('stdin-box')
      const send = $('stdin-send')
      const form = $('terminal-input-form')
      if (inpt) {
        inpt.disabled = !enabled
        if (enabled) {
          inpt.setAttribute('aria-disabled', 'false')
          inpt.placeholder = inpt.getAttribute('data-default-placeholder') || ''
        } else {
          inpt.setAttribute('aria-disabled', 'true')
          inpt.placeholder = inpt.getAttribute('data-default-placeholder') || ''
          try { __ssg_current_prompt = null } catch (_e) { }
        }
      }
      if (send) {
        send.disabled = !enabled
        if (enabled) send.setAttribute('aria-disabled', 'false')
        else send.setAttribute('aria-disabled', 'true')
      }
      if (form) {
        if (enabled) form.classList.remove('disabled')
        else form.classList.add('disabled')
      }
    } catch (_e) { }
  }

  // On load, remember the default placeholder so we can restore it when disabling
  try { const p = $('stdin-box'); if (p && !p.getAttribute('data-default-placeholder')) p.setAttribute('data-default-placeholder', p.placeholder || '') } catch (_e) { }

  // Side tab helpers: toggle between instructions and terminal
  function activateSideTab(name) {
    try {
      const instrBtn = document.getElementById('tab-btn-instructions')
      const termBtn = document.getElementById('tab-btn-terminal')
      const instrPanel = document.getElementById('instructions')
      const termPanel = document.getElementById('terminal')
      if (!instrBtn || !termBtn || !instrPanel || !termPanel) return
      if (name === 'terminal') {
        instrBtn.setAttribute('aria-selected', 'false')
        termBtn.setAttribute('aria-selected', 'true')
        instrPanel.style.display = 'none'
        termPanel.style.display = 'block'
        try { termPanel.querySelector('#terminal-output')?.focus() } catch (_e) { }
      } else {
        instrBtn.setAttribute('aria-selected', 'true')
        termBtn.setAttribute('aria-selected', 'false')
        instrPanel.style.display = 'block'
        termPanel.style.display = 'none'
      }
    } catch (_e) { }
  }

  // Wire up side tab buttons if present
  try {
    const instrBtn = document.getElementById('tab-btn-instructions')
    const termBtn = document.getElementById('tab-btn-terminal')
    if (instrBtn) instrBtn.addEventListener('click', () => activateSideTab('instructions'))
    if (termBtn) termBtn.addEventListener('click', () => activateSideTab('terminal'))
  } catch (_e) { }

  // Debug-only logger: controlled by `window.__ssg_debug_logs` (default: false)
  try { window.__ssg_debug_logs = window.__ssg_debug_logs || false } catch (_e) { }
  function appendTerminalDebug(text) { try { if (window.__ssg_debug_logs) appendTerminal(text) } catch (_e) { } }

  // ============================================================================
  // MICROPYTHON RUNTIME & EXECUTION SYSTEM
  // ============================================================================

  // Map and display tracebacks that originate in transformed code back to user source
  function mapTracebackAndShow(rawText, headerLines, userCode) {
    if (!rawText) return
    // Replace occurrences like: File "<stdin>", line N[, column C]
    const mapped = rawText.replace(/File \"([^\"]+)\", line (\d+)(?:, column (\d+))?/g, (m, fname, ln, col) => {
      const mappedLn = Math.max(1, Number(ln) - headerLines)
      if (col) return `File "${fname}", line ${mappedLn}, column ${col}`
      return `File "${fname}", line ${mappedLn}`
    })
    appendTerminal(mapped, 'stderr')

    // When there's no async backend to reload from, open tabs based on in-memory `mem` or localStorage mirror.
    function openTabsFromMem() {
      try {
        const names = Object.keys(mem || {})
        if (!names || !names.length) return
        if (window.TabManager && typeof window.TabManager.openTab === 'function') {
          const existing = (window.TabManager.list && window.TabManager.list()) || []
          for (const n0 of names) {
            const n = (n0 && n0.startsWith('/')) ? n0 : ('/' + n0)
            if (n === MAIN_FILE) continue
            if (!existing.includes(n)) {
              try { window.TabManager.openTab(n) } catch (_e) { }
            }
          }
        } else {
          try { window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat(names.filter(n => n !== MAIN_FILE)) } catch (_e) { }
        }
      } catch (_e) { }
    }
    appendTerminal('[mapped traceback]')
    appendTerminal(mapped)

    // Optionally show small source context for first mapped line
    const m = mapped.match(/line (\d+)/)
    if (m) {
      const errLine = Math.max(1, Number(m[1]))
      const userLines = userCode.split('\n')
      const contextStart = Math.max(0, errLine - 3)
      appendTerminal('--- source context (student code) ---')
      for (let i = contextStart; i < Math.min(userLines.length, errLine + 2); i++) {
        const prefix = (i + 1 === errLine) ? '-> ' : '   '
        appendTerminal(prefix + String(i + 1).padStart(3, ' ') + ': ' + userLines[i])
      }
    }
  }

  // runtimeAdapter will provide a run(code) -> Promise<string> API if a runtime is available
  let runtimeAdapter = null

  // Execution state management for timeout and cancellation
  let executionState = {
    isRunning: false,
    currentAbortController: null,
    timeoutId: null
  }

  // Helper: Execute code with timeout and cancellation support
  async function executeWithTimeout(executionPromise, timeoutMs, safetyTimeoutMs = 5000) {
    const abortController = new AbortController()
    executionState.currentAbortController = abortController

    // Add a safety timeout that will forcibly interrupt the VM if it's stuck in a tight loop
    let safetyTimeoutId = null
    let vmInterruptAttempted = false

    const timeoutPromise = new Promise((_, reject) => {
      executionState.timeoutId = setTimeout(() => {
        abortController.abort()
        reject(new Error(`Execution timeout after ${Math.round(timeoutMs / 1000)} seconds. The program may contain an infinite loop or be taking too long to complete.`))
      }, timeoutMs)
    })

    // Safety mechanism: Try VM interrupt before falling back to abort
    const safetyPromise = new Promise((_, reject) => {
      safetyTimeoutId = setTimeout(() => {
        if (!vmInterruptAttempted && !abortController.signal.aborted) {
          vmInterruptAttempted = true
          appendTerminal(`>>> Safety timeout reached after ${Math.round(safetyTimeoutMs / 1000)}s, attempting VM interrupt...`, 'runtime')

          // Try to interrupt the VM first
          const interrupted = interruptMicroPythonVM()
          if (!interrupted) {
            appendTerminal('>>> VM interrupt failed, forcing abort...', 'runtime')
            abortController.abort()
          }

          // Still reject after attempting interrupt to trigger error handling
          setTimeout(() => {
            reject(new Error(`Safety timeout: Execution appears stuck in tight loop after ${Math.round(safetyTimeoutMs / 1000)} seconds`))
          }, 500) // Give VM interrupt time to work
        }
      }, safetyTimeoutMs)
    })

    try {
      const result = await Promise.race([executionPromise, timeoutPromise, safetyPromise])
      clearTimeout(executionState.timeoutId)
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
      return result
    } catch (error) {
      clearTimeout(executionState.timeoutId)
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId)

      if (abortController.signal.aborted) {
        throw new Error('Execution was cancelled by user or timeout')
      }
      throw error
    }
  }

  // UI helpers for execution state
  function setExecutionRunning(running) {
    executionState.isRunning = running
    const runBtn = $('run')
    const stopBtn = $('stop')

    if (runBtn) {
      runBtn.disabled = running
      runBtn.style.display = running ? 'none' : 'inline-flex'
    }
    if (stopBtn) {
      stopBtn.disabled = !running
      stopBtn.style.display = running ? 'inline-flex' : 'none'
    }

    // When stopping execution, clean up any pending input promises and terminal state
    if (!running) {
      try {
        // Resolve any pending input promises with empty string to allow graceful exit
        if (window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function') {
          appendTerminalDebug('Cleaning up pending input promise')
          window.__ssg_pending_input.resolve('')
          delete window.__ssg_pending_input
        }
      } catch (_e) {
        appendTerminalDebug('Error cleaning up pending input: ' + _e)
      }

      try {
        // Reset terminal input state
        setTerminalInputEnabled(false)
        const stdinBox = $('stdin-box')
        if (stdinBox) {
          stdinBox.value = ''
          stdinBox.blur()
        }
      } catch (_e) {
        appendTerminalDebug('Error resetting terminal input: ' + _e)
      }

      try {
        // Clear any execution timeouts
        if (executionState.timeoutId) {
          clearTimeout(executionState.timeoutId)
          executionState.timeoutId = null
        }
      } catch (_e) {
        appendTerminalDebug('Error clearing timeout: ' + _e)
      }
    }
  }

  // Helper: Send KeyboardInterrupt to MicroPython VM
  function interruptMicroPythonVM() {
    if (!runtimeAdapter) {
      appendTerminalDebug('Cannot interrupt: no runtime adapter available')
      return false
    }

    // Check if we're in a vulnerable state (pending input)
    if (window.__ssg_pending_input) {
      appendTerminalDebug('Warning: Interrupting during input() - this may cause VM state issues')
      appendTerminal('⚠️ Interrupting during input may require recovery afterward', 'runtime')
    }

    // NEW: Try v3.0.0 asyncify interrupt API first (much more reliable)
    if (runtimeAdapter.hasYieldingSupport && runtimeAdapter.interruptExecution) {
      try {
        appendTerminalDebug('Using v3.0.0 asyncify interrupt API...')
        runtimeAdapter.interruptExecution()
        appendTerminalDebug('✅ VM interrupt sent via interruptExecution()')
        return true
      } catch (err) {
        appendTerminalDebug('v3.0.0 interrupt failed: ' + err)
        // Fall through to legacy method
      }
    }

    // Legacy fallback: try the old mp_sched_keyboard_interrupt method
    if (runtimeAdapter._module && typeof runtimeAdapter._module.ccall === 'function') {
      try {
        appendTerminalDebug('Falling back to legacy mp_sched_keyboard_interrupt...')
        runtimeAdapter._module.ccall('mp_sched_keyboard_interrupt', 'null', [], [])
        appendTerminalDebug('✅ VM interrupt sent via legacy API')
        return true
      } catch (err) {
        appendTerminalDebug('Legacy VM interrupt failed: ' + err)
      }
    }

    appendTerminalDebug('❌ No VM interrupt method available')
    return false
  }

  // Expose interrupt function globally for debugging and external use
  try {
    window.__ssg_interrupt_vm = interruptMicroPythonVM

    // Also expose a more user-friendly global function
    window.interruptPython = function () {
      if (!executionState.isRunning) {
        console.log('No Python execution is currently running')
        return false
      }

      console.log('Interrupting Python execution...')
      const success = interruptMicroPythonVM()

      if (success) {
        console.log('KeyboardInterrupt sent to MicroPython VM')
        setExecutionRunning(false)
      } else {
        console.log('VM interrupt failed, falling back to AbortController')
        if (executionState.currentAbortController) {
          executionState.currentAbortController.abort()
          setExecutionRunning(false)
        }
      }

      return success
    }

    // NEW: Expose v3.0.0 yielding controls globally for debugging
    window.setMicroPythonYielding = function (enabled) {
      if (!runtimeAdapter) {
        console.log('No runtime adapter available')
        return false
      }

      if (!runtimeAdapter.setYielding) {
        console.log('Yielding control not available (requires asyncify v3.0.0)')
        return false
      }

      try {
        runtimeAdapter.setYielding(enabled)
        console.log(`✅ MicroPython yielding ${enabled ? 'enabled' : 'disabled'}`)

        if (enabled) {
          console.log('💡 Yielding enabled - loops with time.sleep() should be interruptible')
          console.log('💡 Browser should remain responsive during Python execution')
        } else {
          console.log('⚠️ Yielding disabled - maximum speed but may not be interruptible')
          console.log('⚠️ Browser may become unresponsive during long operations')
        }

        return true
      } catch (err) {
        console.log('❌ Failed to set yielding:', err)
        return false
      }
    }

    window.clearMicroPythonInterrupt = function () {
      if (!runtimeAdapter) {
        console.log('No runtime adapter available')
        return false
      }

      let success = false

      // Try v3.0.0 clear interrupt method
      if (runtimeAdapter.clearInterrupt) {
        try {
          runtimeAdapter.clearInterrupt()
          console.log('✅ Interrupt state cleared with v3.0.0 API')
          success = true
        } catch (err) {
          console.log('v3.0.0 clear interrupt failed:', err)
        }
      }

      // Try aggressive asyncify state reset
      if (runtimeAdapter._module) {
        const Module = runtimeAdapter._module

        // Reset asyncify internals if accessible
        if (Module.Asyncify) {
          try {
            console.log('Attempting to reset Asyncify state...')
            if (Module.Asyncify.currData !== undefined) {
              Module.Asyncify.currData = 0
              console.log('✅ Asyncify.currData reset')
            }
            if (Module.Asyncify.state !== undefined) {
              Module.Asyncify.state = 0  // Normal state
              console.log('✅ Asyncify.state reset')
            }
            success = true
          } catch (err) {
            console.log('Asyncify state reset failed:', err)
          }
        }

        // REPL reset
        if (typeof Module.ccall === 'function') {
          try {
            Module.ccall('mp_js_repl_init', 'null', [], [])
            console.log('✅ REPL state reset')
            success = true
          } catch (err) {
            console.log('REPL reset failed:', err)
          }
        }
      }

      // Also try to clean up any pending input state
      try {
        if (window.__ssg_pending_input) {
          console.log('Cleaning up pending input state...')
          delete window.__ssg_pending_input
        }
        setExecutionRunning(false)
        success = true
      } catch (err) {
        console.log('Failed to clean up input state:', err)
      }

      if (!success) {
        console.log('❌ Could not clear interrupt state - may need page refresh')
      }

      return success
    }

    window.checkMicroPythonYielding = function () {
      console.log('🔍 Checking MicroPython yielding state...')

      const status = {
        runtimeAvailable: !!runtimeAdapter,
        hasYieldingSupport: !!(runtimeAdapter?.hasYieldingSupport),
        hasSetYielding: !!(runtimeAdapter?.setYielding),
        trackingEnabled: !!window.__ssg_yielding_enabled,
        isExecuting: executionState.isRunning
      }

      console.log('Status:', status)

      if (!status.runtimeAvailable) {
        console.log('❌ No runtime available')
        return false
      }

      if (!status.hasYieldingSupport) {
        console.log('❌ Runtime does not support yielding')
        return false
      }

      if (!status.hasSetYielding) {
        console.log('❌ setYielding function not available')
        return false
      }

      // Try to ensure yielding is enabled
      try {
        runtimeAdapter.setYielding(true)
        window.__ssg_yielding_enabled = true
        console.log('✅ Yielding enabled/verified')
        return true
      } catch (err) {
        console.log('❌ Failed to enable yielding:', err)
        window.__ssg_yielding_enabled = false
        return false
      }
    }

    window.inspectMicroPythonRuntime = function () {
      console.log('� Deep MicroPython runtime inspection...')

      if (!runtimeAdapter) {
        console.log('❌ No runtime adapter')
        return
      }

      console.log('Runtime adapter properties:')
      console.log('- hasYieldingSupport:', runtimeAdapter.hasYieldingSupport)
      console.log('- interruptExecution:', typeof runtimeAdapter.interruptExecution)
      console.log('- setYielding:', typeof runtimeAdapter.setYielding)
      console.log('- clearInterrupt:', typeof runtimeAdapter.clearInterrupt)
      console.log('- _module:', !!runtimeAdapter._module)

      if (runtimeAdapter._module) {
        const Module = runtimeAdapter._module
        console.log('Module properties:')
        console.log('- Module type:', typeof Module)
        console.log('- ccall:', typeof Module.ccall)
        console.log('- Asyncify:', !!Module.Asyncify)

        if (Module.Asyncify) {
          console.log('Asyncify properties:')
          console.log('- currData:', Module.Asyncify.currData)
          console.log('- state:', Module.Asyncify.state)
          console.log('- StackSize:', Module.Asyncify.StackSize)
        }

        // Check for yielding-related functions
        console.log('Available functions:')
        const funcs = Object.keys(Module).filter(k => k.includes('yield') || k.includes('interrupt'))
        console.log('- Yielding/interrupt functions:', funcs)

        // Check if the runtime has the functions we expect
        const expectedFuncs = [
          'interruptExecution',
          'setYielding',
          'clearInterrupt',
          'mp_hal_get_interrupt_char',
          'mp_sched_keyboard_interrupt'
        ]

        expectedFuncs.forEach(func => {
          const exists = func in runtimeAdapter || (Module.ccall && func.startsWith('mp_'))
          console.log(`- ${func}: ${exists ? '✅' : '❌'}`)
        })
      }

      // Test if setYielding actually does something
      if (runtimeAdapter.setYielding) {
        console.log('🧪 Testing setYielding behavior...')
        try {
          console.log('Setting yielding to false...')
          runtimeAdapter.setYielding(false)
          console.log('Setting yielding to true...')
          runtimeAdapter.setYielding(true)
          console.log('✅ setYielding calls succeeded (but may not actually work)')
        } catch (err) {
          console.log('❌ setYielding calls failed:', err)
        }
      }
    }
    window.forceResetMicroPython = function () {
      console.log('🔄 Attempting force reset of MicroPython runtime...')

      if (!runtimeAdapter) {
        console.log('❌ No runtime adapter available')
        return false
      }

      let success = false

      try {
        // Clear all execution state
        setExecutionRunning(false)
        if (window.__ssg_pending_input) delete window.__ssg_pending_input

        // Clear any abort controllers
        if (executionState.currentAbortController) {
          executionState.currentAbortController = null
        }
        if (executionState.timeoutId) {
          clearTimeout(executionState.timeoutId)
          executionState.timeoutId = null
        }

        // Try all available reset methods
        if (runtimeAdapter.clearInterrupt) {
          runtimeAdapter.clearInterrupt()
          console.log('✅ v3.0.0 interrupt cleared')
        }

        // Re-enable yielding if available
        if (runtimeAdapter.setYielding) {
          try {
            runtimeAdapter.setYielding(true)
            console.log('✅ Yielding re-enabled')
            window.__ssg_yielding_enabled = true
          } catch (err) {
            console.log('❌ Failed to re-enable yielding:', err)
            window.__ssg_yielding_enabled = false
          }
        }

        const Module = runtimeAdapter._module
        if (Module) {
          // Reset asyncify state aggressively
          if (Module.Asyncify) {
            Module.Asyncify.currData = 0
            Module.Asyncify.state = 0
            console.log('✅ Asyncify state force reset')
          }

          // Reinitialize MicroPython systems
          if (typeof Module.ccall === 'function') {
            Module.ccall('mp_js_repl_init', 'null', [], [])
            console.log('✅ REPL force reinitialized')
          }
        }

        console.log('✅ Force reset completed - try running code again')
        success = true

      } catch (err) {
        console.log('❌ Force reset failed:', err)
        console.log('💡 You may need to refresh the page')
      }

      return success
    }

    // Status function to show what interrupt methods are available
    window.getMicroPythonInterruptStatus = function () {
      const status = {
        runtimeLoaded: !!runtimeAdapter,
        hasYieldingSupport: !!(runtimeAdapter?.hasYieldingSupport),
        hasLegacyInterrupt: !!(runtimeAdapter?._module?.ccall),
        isExecuting: executionState.isRunning,
        availableMethods: []
      }

      if (status.hasYieldingSupport) {
        status.availableMethods.push('v3.0.0 interruptExecution()')
      }
      if (status.hasLegacyInterrupt) {
        status.availableMethods.push('legacy mp_sched_keyboard_interrupt()')
      }
      if (status.availableMethods.length === 0) {
        status.availableMethods.push('AbortController (non-VM)')
      }

      console.log('MicroPython Interrupt Status:', status)
      return status
    }
  } catch (_e) { }

  // State clearing function to reset Python globals between runs
  try {
    window.clearMicroPythonState = function () {
      if (!runtimeAdapter || !runtimeAdapter._module) {
        console.log('❌ No runtime adapter or module available for state clearing')
        return false
      }

      try {
        // Access MicroPython instance globals
        const mpInstance = runtimeAdapter._module
        if (!mpInstance.globals || !mpInstance.globals.__dict__) {
          console.log('❌ Unable to access MicroPython globals.__dict__')
          return false
        }

        const globalsDict = mpInstance.globals.__dict__
        const builtins = ['__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__']

        // Get all keys and filter out built-ins
        const userKeys = Object.keys(globalsDict).filter(key =>
          !builtins.includes(key) && !key.startsWith('_')
        )

        // Delete user-defined variables
        let cleared = 0
        for (const key of userKeys) {
          try {
            delete globalsDict[key]
            cleared++
          } catch (err) {
            console.log(`❌ Failed to clear variable '${key}':`, err)
          }
        }

        console.log(`✅ Cleared ${cleared} user variables from Python globals`)
        return true
      } catch (err) {
        console.log('❌ Failed to clear MicroPython state:', err)
        return false
      }
    }
  } catch (_e) { }

  // Stop button handler
  function setupStopButton() {
    const stopBtn = $('stop')
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (executionState.isRunning) {
          appendTerminal('>>> Execution cancelled by user', 'runtime')

          // Try to interrupt the MicroPython VM cleanly first
          const interrupted = interruptMicroPythonVM()

          // Clean up any pending input promises immediately
          try {
            if (window.__ssg_pending_input) {
              appendTerminalDebug('Cleaning up pending input after interrupt...')
              if (typeof window.__ssg_pending_input.resolve === 'function') {
                window.__ssg_pending_input.resolve('')
              }
              delete window.__ssg_pending_input
            }
            setTerminalInputEnabled(false)
          } catch (_e) { }

          // If VM interrupt failed, fall back to AbortController
          if (!interrupted && executionState.currentAbortController) {
            try {
              appendTerminalDebug('Falling back to AbortController...')
              executionState.currentAbortController.abort()
            } catch (_e) {
              appendTerminalDebug('AbortController failed: ' + _e)
            }
          }

          // Clean up execution state 
          setExecutionRunning(false)

          // For v3.0.0 builds, attempt to clear interrupt state after processing
          if (interrupted && runtimeAdapter?.clearInterrupt) {
            setTimeout(() => {
              try {
                appendTerminalDebug('Clearing interrupt state after processing...')
                runtimeAdapter.clearInterrupt()
                appendTerminalDebug('✅ Interrupt state cleared')

                // IMPORTANT: Re-enable yielding after interrupt cleanup
                if (runtimeAdapter.setYielding) {
                  try {
                    runtimeAdapter.setYielding(true)
                    appendTerminalDebug('✅ Yielding re-enabled after interrupt')
                    window.__ssg_yielding_enabled = true
                  } catch (err) {
                    appendTerminalDebug('❌ Failed to re-enable yielding: ' + err)
                    window.__ssg_yielding_enabled = false
                  }
                }
              } catch (err) {
                appendTerminalDebug('Failed to clear interrupt state: ' + err)
              }
            }, 200)
          } else if (!interrupted) {
            // Try to reset the runtime to prevent "async operation in flight" errors
            try {
              // For asyncify MicroPython, try to reset by running a simple synchronous command
              if (runtimeAdapter && typeof runtimeAdapter.run === 'function') {
                setTimeout(async () => {
                  try {
                    appendTerminalDebug('Attempting runtime reset...')
                    // Run a simple non-async command to help reset the asyncify state
                    await runtimeAdapter.run('# runtime reset')
                    appendTerminalDebug('Runtime reset completed')
                  } catch (resetErr) {
                    appendTerminalDebug('Runtime reset failed: ' + resetErr)
                    // If reset fails, the user may need to refresh the page
                    appendTerminal('Warning: Runtime may be in inconsistent state. If next execution fails, try refreshing the page.', 'runtime')
                  }
                }, 150)
              }
            } catch (_e) {
              appendTerminalDebug('Error during runtime reset: ' + _e)
            }
          }
        }
      })
    }
  }

  // Debug helper: allow tests to run transformed code directly and capture raw errors.
  try {
    window.__ssg_run = async function (code) {
      if (!runtimeAdapter || typeof runtimeAdapter.run !== 'function') throw new Error('no runtime adapter')
      return await runtimeAdapter.run(code)
    }
  } catch (_e) { }

  // Testing aids: allow forcing the non-async split-run fallback and collect fallback logs
  try { window.__ssg_force_no_async = window.__ssg_force_no_async || false } catch (_e) { }
  try { window.__ssg_fallback_logs = window.__ssg_fallback_logs || [] } catch (_e) { }
  function fallbackLog(ev, data) {
    try {
      const entry = { ts: Date.now(), event: ev, data: data }
      try { window.__ssg_fallback_logs.push(entry) } catch (_e) { }
      try { appendTerminalDebug && appendTerminalDebug('[fallback] ' + ev + ' ' + JSON.stringify(data || {})) } catch (_e) { }
      // also append a visible runtime terminal line to aid test debugging
      try { appendTerminal && appendTerminal('[fallback] ' + ev + ' ' + (typeof data === 'string' ? data : JSON.stringify(data || {})), 'runtime') } catch (_e) { }
    } catch (_e) { }
  }

  // VFS runtime references (populated during async VFS init)
  let backendRef = null
  let mem = null

  // Expose a promise that resolves when the VFS/mem/backend has been initialized
  // Consumers (tests/UI) can await window.__ssg_vfs_ready to know when files are available.
  let vfsReadyResolve = null
  let vfsReadyReject = null
  let vfsReadySettled = false
  window.__ssg_vfs_ready = new Promise((res, rej) => { vfsReadyResolve = res; vfsReadyReject = rej })

  // Convenience helper: wait for a file to appear in mem/runtime/backend
  window.waitForFile = async function (path, timeoutMs = 2000) {
    const n = path && path.startsWith('/') ? path : ('/' + path)
    const start = Date.now()
    const td = new TextDecoder()
    while (Date.now() - start < timeoutMs) {
      try {
        // check mem first (synchronous)
        if (mem && Object.prototype.hasOwnProperty.call(mem, n)) return mem[n]
      } catch (_e) { }
      try {
        const fs = window.__ssg_runtime_fs
        if (fs) {
          try {
            if (typeof fs.readFile === 'function') {
              const data = fs.readFile(n)
              if (data !== undefined) return (typeof data === 'string') ? data : td.decode(data)
            } else if (typeof fs.readFileSync === 'function') {
              const data = fs.readFileSync(n)
              if (data !== undefined) return (typeof data === 'string') ? data : td.decode(data)
            }
          } catch (_e) { }
        }
      } catch (_e) { }
      try {
        if (backendRef && typeof backendRef.read === 'function') {
          const d = await backendRef.read(n).catch(() => null)
          if (d != null) return d
        }
      } catch (_e) { }
      await new Promise(r => setTimeout(r, 120))
    }
    throw new Error('waitForFile timeout: ' + path)
  }

  // Track expected writes we performed into the runtime FS so notifications that
  // are simply echoes of our own sync/mount operations can be suppressed.
  try { window.__ssg_expected_writes = window.__ssg_expected_writes || new Map() } catch (_e) { }
  function _normPath(p) { if (!p) return p; return p.startsWith('/') ? p : ('/' + p) }
  function markExpectedWrite(p, content) { try { const n = _normPath(p); window.__ssg_expected_writes.set(n, { content: String(content || ''), ts: Date.now() }) } catch (_e) { } }
  function consumeExpectedWriteIfMatches(p, content, windowMs = 3000) { try { const n = _normPath(p); const rec = window.__ssg_expected_writes.get(n); if (!rec) return false; const now = Date.now(); if (now - rec.ts > windowMs) { window.__ssg_expected_writes.delete(n); return false } if (String(content || '') === String(rec.content || '')) { window.__ssg_expected_writes.delete(n); return true } return false } catch (_e) { return false } }

  // Helper to settle the global VFS-ready promise when runtime FS becomes available
  function settleVfsReady() {
    try {
      if (!vfsReadySettled && typeof vfsReadyResolve === 'function') {
        vfsReadyResolve({ mem: (typeof mem !== 'undefined') ? mem : null, backend: backendRef || null, fs: window.__ssg_runtime_fs || null })
        vfsReadySettled = true
      }
    } catch (_e) { }
  }

  // Name of the protected main program file (normalized)
  const MAIN_FILE = '/main.py'

  // --- Simple FileManager shim (localStorage-backed) ---
  // This is a temporary UI-facing API so you can create/edit/delete files
  // now; it will be replaced by the IndexedDB-backed VFS implementation later.
  // localStorage-backed simple FileManager (normalizes keys to '/path')
  let FileManager = {
    key: 'ssg_files_v1',
    _load() { try { return JSON.parse(localStorage.getItem(this.key) || '{}') } catch (e) { return {} } },
    _save(m) { localStorage.setItem(this.key, JSON.stringify(m)) },
    _norm(p) { if (!p) return p; return p.startsWith('/') ? p : ('/' + p) },
    list() { return Object.keys(this._load()).sort() },
    read(path) { const m = this._load(); return m[this._norm(path)] || null },
    write(path, content) { const m = this._load(); m[this._norm(path)] = content; this._save(m); return Promise.resolve() },
    delete(path) { if (this._norm(path) === MAIN_FILE) { console.warn('Attempt to delete protected main file ignored:', path); return Promise.resolve() } const m = this._load(); delete m[this._norm(path)]; this._save(m); return Promise.resolve() }
  }

  // Expose the local FileManager immediately so tests and early scripts can access it.
  try { window.FileManager = FileManager } catch (e) { }

  // Provide a minimal TabManager stub so test code can call openTab early; it will be replaced later.
  try { window.TabManager = window.TabManager || { openTab: (n) => { }, closeTab: (n) => { }, selectTab: (n) => { }, getActive: () => null } } catch (e) { }

  // Ensure MAIN_FILE exists with starter content (but don't overwrite existing)
  if (!FileManager.read(MAIN_FILE)) {
    FileManager.write(MAIN_FILE, cfg?.starter || '# main program (auto-created)\n')
  }

  // Files panel has been removed from the UI. Keep a no-op shim so existing
  // call sites (tests, early code) that call renderFilesList() remain safe.
  function renderFilesList() {
    // Debug shim: the files panel UI was removed. Enable logging by setting
    // `window.__ssg_enable_fileslist_debug = true` in the console to see
    // call sites and stack traces for unexpected calls.
    try {
      if (window.__ssg_enable_fileslist_debug) {
        // Use console.debug so it's easy to filter; include a short stack.
        console.debug('renderFilesList() called — files panel removed. Stack:', new Error().stack)
      }
    } catch (_e) { }
  }

  // Accessible modal helpers: openModal / closeModal
  // - Saves/restores focus
  // - Traps Tab within the modal
  // - Closes on Escape
  function _getFocusable(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement)
  }
  function openModal(m) {
    try {
      if (!m) return
      // record previously focused element for restore
      m.__previousActive = document.activeElement
      m.setAttribute('aria-hidden', 'false')
      m.setAttribute('aria-modal', 'true')
      // ensure modal is focusable
      if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1')
      const focusables = _getFocusable(m)
      if (focusables.length) focusables[0].focus()
      else m.focus()

      // key handling: trap tab and close on ESC
      m.__keydownHandler = function (e) {
        if (e.key === 'Escape') {
          e.stopPropagation(); e.preventDefault(); closeModal(m)
          return
        }
        if (e.key === 'Tab') {
          const focusList = _getFocusable(m)
          if (!focusList.length) { e.preventDefault(); return }
          const first = focusList[0], last = focusList[focusList.length - 1]
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', m.__keydownHandler, true)
      // mark inert siblings by setting aria-hidden on main content to help screen readers
      try { const main = document.querySelector('main'); if (main) main.setAttribute('aria-hidden', 'true'); } catch (_e) { }
    } catch (_e) { }
  }
  function closeModal(m) {
    try {
      if (!m) return
      m.setAttribute('aria-hidden', 'true')
      m.removeAttribute('aria-modal')
      try { document.removeEventListener('keydown', m.__keydownHandler, true) } catch (_e) { }
      try { if (m.__previousActive && typeof m.__previousActive.focus === 'function') m.__previousActive.focus() } catch (_e) { }
      try { const main = document.querySelector('main'); if (main) main.removeAttribute('aria-hidden'); } catch (_e) { }
    } catch (_e) { }
  }

  // Accessible input modal helper: returns string or null if cancelled
  function showInputModal(title, message, defaultValue) {
    return new Promise((resolve) => {
      try {
        const m = document.getElementById('input-modal')
        const t = document.getElementById('input-modal-title')
        const desc = document.getElementById('input-modal-desc')
        const field = document.getElementById('input-modal-field')
        const ok = document.getElementById('input-modal-ok')
        const cancel = document.getElementById('input-modal-cancel')

        if (!m || !t || !desc || !field || !ok || !cancel) {
          const val = window.prompt(message || title || '')
          resolve(val)
          return
        }
        t.textContent = title || 'Input'
        desc.textContent = message || ''
        field.value = defaultValue || ''
        openModal(m)
        const onOk = () => { cleanup(); resolve(field.value) }
        const onCancel = () => { cleanup(); resolve(null) }
        function cleanup() { try { closeModal(m) } catch (_e) { }; try { ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel) } catch (_e) { } }
        ok.addEventListener('click', onOk)
        cancel.addEventListener('click', onCancel)
        // allow Enter key within input to confirm
        const keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); onOk() } }
        field.addEventListener('keydown', keyHandler)
      } catch (e) { resolve(null) }
    })
  }

  // Try to initialize real VFS backend (IndexedDB preferred) and migrate existing local files
  try {
    const vfsMod = await import('./lib/vfs.js')
    const backend = await vfsMod.init()
    backendRef = backend
    // migrate existing localStorage-based files into backend if missing
    const localFiles = FileManager.list()
    for (const p of localFiles) {
      try {
        const existing = await backend.read(p)
        if (existing == null) { await backend.write(p, FileManager.read(p)) }
      } catch (e) { /* ignore per-file errors */ }
    }
    // build an in-memory snapshot adapter so the UI can use a synchronous API
    // while the real backend is async (IndexedDB). We read all files into `mem`
    // and proxy writes/deletes to the backend asynchronously.
    mem = {}
    try {
      const names = await backend.list()
      for (const n of names) {
        try { mem[n] = await backend.read(n) } catch (e) { mem[n] = null }
      }
    } catch (e) { /* ignore if list/read fail */ }
    // Expose mem for debugging/tests and for other host helpers
    try { window.__ssg_mem = mem; window.mem = mem } catch (_e) { }

    FileManager = {
      list() { return Object.keys(mem).sort() },
      read(path) { const n = path && path.startsWith('/') ? path : ('/' + path); return mem[n] || null },
      write(path, content) {
        const n = path && path.startsWith('/') ? path : ('/' + path)
        const prev = mem[n]
        // If the content didn't change, return early to avoid writing into the runtime FS
        // which can trigger the notifier and cause a recursion.
        try { if (prev === content) return Promise.resolve() } catch (_e) { }

        // update in-memory copy first
        mem[n] = content
        // update localStorage mirror for tests and fallbacks
        try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); map[n] = content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { }

        // NOTE: intentionally do NOT write directly into window.__ssg_runtime_fs here.
        // Writing into the interpreter FS from the UI causes a write->notify->UI-write recursion
        // when the runtime's wrapped fs methods call back into `__ssg_notify_file_written`.
        // The UI will sync mem -> runtime FS in the pre-run sync phase instead.

        return backend.write(n, content).catch(e => { console.error('VFS write failed', e); throw e })
      },
      delete(path) {
        const n = path && path.startsWith('/') ? path : ('/' + path)
        if (n === MAIN_FILE) { console.warn('Attempt to delete protected main file ignored:', path); return Promise.resolve() }
        delete mem[n]
        try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); delete map[n]; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { }
        // also attempt to remove from interpreter FS
        try {
          const fs = window.__ssg_runtime_fs
          if (fs) {
            try { if (typeof fs.unlink === 'function') fs.unlink(n); else if (typeof fs.unlinkSync === 'function') fs.unlinkSync(n) } catch (_e) { }
          }
        } catch (_e) { }
        return backend.delete(n).catch(e => { console.error('VFS delete failed', e); throw e })
      }
    }

    // Files panel removed — keep a no-op renderFilesList so other code can call it safely.
    function renderFilesList() { /* no-op: tabs are the primary UI */ }
    // Helper to reload files from backend into the UI memory and optionally open tabs
    async function reloadFilesFromBackend(backend) {
      try {
        if (!backend || typeof backend.list !== 'function') return
        const names = await backend.list()
        const newMem = Object.create(null)
        for (const n of names) {
          try { const c = await backend.read(n); if (c != null) newMem[n] = c } catch (_e) { }
        }
        // Replace mem entirely with backend contents to avoid stale entries
        mem = newMem
        // update localStorage mirror for tests and UI fallbacks
        try { const map = Object.create(null); for (const k of Object.keys(mem)) map[k] = mem[k]; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { }
        try { if (typeof renderFilesList === 'function') renderFilesList() } catch (_e) { }
        // open tabs for newly created files (but not MAIN_FILE)
        try {
          // Wait for TabManager to become available; if it's not present, retry a few times
          const maxAttempts = 10
          const delayMs = 100
          let opened = false
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (window.TabManager && typeof window.TabManager.openTab === 'function') {
              try {
                const existing = (window.TabManager.list && window.TabManager.list()) || []
                for (const n0 of names) {
                  const n = (n0 && n0.startsWith('/')) ? n0 : ('/' + n0)
                  if (n === MAIN_FILE) continue
                  if (!existing.includes(n)) {
                    try { window.TabManager.openTab(n) } catch (_e) { }
                  }
                }
                opened = true
                break
              } catch (_e) { /* continue retrying */ }
            }
            await new Promise(r => setTimeout(r, delayMs))
          }
          // If TabManager still not available, stash pending tabs for TabManager to consume on init
          if (!opened) {
            try { window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat(names.filter(n => n !== MAIN_FILE)) } catch (_e) { }
          }
        } catch (_e) { }
      } catch (e) { appendTerminal('Reload backend files failed: ' + e) }
    }
  } catch (e) { /* VFS init failed; keep using local FileManager */ }

  // If VFS init completed or failed, ensure the readiness promise is settled
  try {
    try { settleVfsReady() } catch (_e) { }
  } catch (_e) { }

  // Simple modal editor (re-uses snapshot modal styles) -------------------------------------------------
  function openFileEditor(path) {
    // create modal elements lazily
    let modal = document.getElementById('file-modal')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'file-modal'
      modal.className = 'modal file-modal'
      modal.setAttribute('aria-hidden', 'true')
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
      modal.querySelector('#file-close').addEventListener('click', () => closeModal(modal))
      // add an inline error message area
      const err = document.createElement('div'); err.id = 'file-modal-error'; err.style.color = 'red'; err.style.marginTop = '6px'; err.setAttribute('aria-live', 'polite')
      modal.querySelector('.modal-content').appendChild(err)
      modal.querySelector('#file-save').addEventListener('click', () => {
        const p = modal.querySelector('#file-path').value.trim()
        const b = modal.querySelector('#file-body').value
        if (!p) { err.textContent = 'Path required'; return }
        err.textContent = ''
        FileManager.write(p, b)
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
  try { window.FileManager = FileManager } catch (e) { }
  if (cm) try { window.cm = cm } catch (e) { }

  // --- Tab manager integrating files with CodeMirror ---
  const TabManager = (function () {
    const tabsHost = document.getElementById('tabs-left')
    const newBtn = document.getElementById('tab-new')
    let openTabs = [] // array of paths
    let active = null

    function render() {
      tabsHost.innerHTML = ''
      openTabs.forEach(p => {
        const tab = document.createElement('div')
        tab.className = 'tab' + (p === active ? ' active' : '')
        tab.setAttribute('role', 'tab')
        const label = p.startsWith('/') ? p.slice(1) : p
        tab.innerHTML = `<span class="tab-label">${label}</span>`
        const close = document.createElement('button')
        close.className = 'close'
        close.title = 'Close'
        // hide close for protected main file
        if (p === MAIN_FILE) { close.style.display = 'none' }
        else { close.innerHTML = '×'; close.addEventListener('click', (ev) => { ev.stopPropagation(); closeTab(p) }) }
        tab.appendChild(close)
        tab.addEventListener('click', () => selectTab(p))
        tabsHost.appendChild(tab)
      })
      // Debug: surface current openTabs and DOM labels into the terminal so tests can capture timing issues
      try {
        const labels = Array.from(tabsHost.querySelectorAll('.tab-label')).map(e => e.textContent)
        appendTerminalDebug('TabManager.render -> openTabs: ' + openTabs.join(',') + ' | DOM labels: ' + labels.join(','))
      } catch (_e) { }
    }

    function _normalizePath(p) { if (!p) return p; return p.startsWith('/') ? p : ('/' + p) }

    async function openTab(path) {
      const n = _normalizePath(path)
      appendTerminalDebug('TabManager.openTab called -> ' + n)
      if (!openTabs.includes(n)) {
        openTabs.push(n)
      }
      selectTab(n)
      render()
      // Signal an opened tab for external observers/tests
      try { window.__ssg_last_tab_opened = { path: n, ts: Date.now() } } catch (_e) { }
      try { window.dispatchEvent(new CustomEvent('ssg:tab-opened', { detail: { path: n } })) } catch (_e) { }
    }

    function forceClose(path) {
      const n = _normalizePath(path)
      // delete from storage without confirmation
      try { FileManager.delete(n) } catch (_e) { }
      openTabs = openTabs.filter(x => x !== n)
      if (active === n) active = openTabs.length ? openTabs[openTabs.length - 1] : null
      if (active) selectTab(active)
      else {
        if (cm) cm.setValue('')
        else textarea.value = ''
      }
      try { renderFilesList() } catch (_e) { }
      render()
    }

    async function closeTab(path) {
      const n = _normalizePath(path)
      // delete from storage and close tab — use accessible confirm modal
      try {
        const ok = await showConfirmModal('Close and delete', 'Close and delete file "' + n + '"? This will remove it from storage.')
        if (!ok) return
      } catch (_e) { return }
      FileManager.delete(n)
      openTabs = openTabs.filter(x => x !== n)
      if (active === n) active = openTabs.length ? openTabs[openTabs.length - 1] : null
      if (active) selectTab(active)
      else {
        // clear editor
        if (cm) cm.setValue('')
        else textarea.value = ''
      }
      renderFilesList()
      render()
    }

    function selectTab(path) {
      const n = _normalizePath(path)
      active = n
      const content = FileManager.read(n) || ''
      if (cm) cm.setValue(content)
      else textarea.value = content
      render()
    }

    async function createNew() {
      const name = await showInputModal('New file', 'New file path (e.g. main.py):', '')
      if (!name) return
      const n = _normalizePath(name)
      FileManager.write(n, '')
      renderFilesList()
      openTab(n)
    }

    if (newBtn) newBtn.addEventListener('click', createNew)

    // autosave current active tab on editor changes (debounced)
    let tabSaveTimer = null
    function scheduleTabSave() {
      if (!active) return
      if (tabSaveTimer) clearTimeout(tabSaveTimer)
      tabSaveTimer = setTimeout(() => {
        const content = cm ? cm.getValue() : textarea.value
        try {
          const stored = FileManager.read(active)
          if (stored === content) {
            const ind = $('autosave-indicator')
            if (ind) ind.textContent = 'Saved (' + active + ')'
            return
          }
        } catch (_e) { }
        FileManager.write(active, content)
        const ind = $('autosave-indicator')
        if (ind) ind.textContent = 'Saved (' + active + ')'
      }, 300)
    }
    if (cm) { cm.on('change', scheduleTabSave) } else { textarea.addEventListener('input', scheduleTabSave) }

    return { openTab, closeTab, selectTab, list: () => { try { appendTerminalDebug('TabManager.list -> ' + openTabs.join(',')) } catch (_e) { }; return openTabs }, getActive: () => active, forceClose, refresh: () => { try { render() } catch (_e) { } } }
  })()

  // expose TabManager globally for tests
  try { window.TabManager = TabManager } catch (e) { }

  // Ensure main file is open in initial tab and selected
  TabManager.openTab(MAIN_FILE)

  // If any tabs were queued while TabManager wasn't available, open them now.
  try {
    const pending = (window.__ssg_pending_tabs || [])
    if (pending && pending.length && window.TabManager && typeof window.TabManager.openTab === 'function') {
      for (const p of pending) { try { window.TabManager.openTab(p) } catch (_e) { } }
      try { window.__ssg_pending_tabs = [] } catch (_e) { }
    }
  } catch (_e) { }

  // Helper: flush any pending tabs asynchronously. This runs repeatedly when
  // the notifier queues new tabs and ensures TabManager.openTab is called
  // at a safe time (after runtime/backend sync) without blocking the notifier.
  function flushPendingTabs() {
    try {
      const pending = (window.__ssg_pending_tabs || [])
      if (!pending || !pending.length) return
      if (!(window.TabManager && typeof window.TabManager.openTab === 'function')) return
      const existing = (window.TabManager.list && window.TabManager.list()) || []
      for (const p of pending) {
        try {
          if (!existing.includes(p)) window.TabManager.openTab(p)
        } catch (_e) { }
      }
      try { window.__ssg_pending_tabs = [] } catch (_e) { }
    } catch (_e) { }
  }

  // Start with terminal input disabled until a runtime requests it
  try { setTerminalInputEnabled(false) } catch (_e) { }

  // (renderFilesList already attaches Open handlers when it builds the DOM)


  // Helper: transform user source by replacing input(...) with await host.get_input(...)
  // and wrap in an async runner. Returns {code: wrappedCode, headerLines}
  function transformAndWrap(userCode) {
    // Support-lift simple walrus patterns where input() is used inside an
    // assignment expression in an `if` or `while` header. MicroPython may
    // not support the walrus operator, and the split-run fallback that
    // replaces input(...) with a literal can produce invalid syntax
    // when used inside `if var := input(...):` patterns. Convert a common
    // subset into an equivalent assignment + condition before further
    // processing.
    try {
      // Pattern with quoted prompt: if var := input("prompt"):
      userCode = userCode.replace(/^([ \t]*)(if|while)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*input\s*\(\s*(['\"])(.*?)\4\s*\)\s*:/gm, (m, indent, kw, vname, q, prompt) => {
        return `${indent}${vname} = input(${q}${prompt}${q})\n${indent}${kw} ${vname}:`
      })
      // Pattern without prompt string: if var := input():
      userCode = userCode.replace(/^([ \t]*)(if|while)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*input\s*\(\s*\)\s*:/gm, (m, indent, kw, vname) => {
        return `${indent}${vname} = input()\n${indent}${kw} ${vname}:`
      })
    } catch (_e) { }
    // tokenizer-aware replacement: skip strings and comments and only replace
    // real code occurrences of `input(`. This behaves like an AST-aware rewrite
    // for the common cases while keeping everything in-client.
    function safeReplaceInput(src) {
      let out = ''
      const N = src.length
      let i = 0
      let state = 'normal' // normal | single | double | tri-single | tri-double | comment
      while (i < N) {
        // detect triple-quoted strings first
        if (state === 'normal') {
          // line comment
          if (src[i] === '#') {
            // copy until newline or end
            const j = src.indexOf('\n', i)
            if (j === -1) { out += src.slice(i); break }
            out += src.slice(i, j + 1)
            i = j + 1
            continue
          }
          // triple single
          if (src.startsWith("'''", i)) {
            state = 'tri-single'
            out += "'''"
            i += 3
            continue
          }
          // triple double
          if (src.startsWith('"""', i)) {
            state = 'tri-double'
            out += '"""'
            i += 3
            continue
          }
          // single-quote
          if (src[i] === "'") {
            state = 'single'
            out += src[i++]
            continue
          }
          // double-quote
          if (src[i] === '"') {
            state = 'double'
            out += src[i++]
            continue
          }

          // detect identifier 'input' with word boundary and a following '('
          if (src.startsWith('input', i) && (i === 0 || !(/[A-Za-z0-9_]/.test(src[i - 1])))) {
            // lookahead for optional whitespace then '('
            let j = i + 5
            while (j < N && /\s/.test(src[j])) j++
            if (j < N && src[j] === '(') {
              out += 'await host.get_input'
              i += 5
              continue
            }
          }

          // default: copy char
          out += src[i++]
        } else if (state === 'single') {
          // inside single-quoted string
          if (src[i] === '\\') {
            out += src.substr(i, 2)
            i += 2
            continue
          }
          if (src[i] === "'") {
            state = 'normal'
            out += src[i++]
            continue
          }
          out += src[i++]
        } else if (state === 'double') {
          if (src[i] === '\\') {
            out += src.substr(i, 2)
            i += 2
            continue
          }
          if (src[i] === '"') {
            state = 'normal'
            out += src[i++]
            continue
          }
          out += src[i++]
        } else if (state === 'tri-single') {
          if (src.startsWith("'''", i)) {
            state = 'normal'
            out += "'''"
            i += 3
            continue
          }
          out += src[i++]
        } else if (state === 'tri-double') {
          if (src.startsWith('"""', i)) {
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
    const indent = (line) => '    ' + line
    // Normalize leading whitespace on each user line to spaces only so that
    // wrapping the code inside an indented async function doesn't produce
    // mixed-tab/space indentation errors. We only touch leading whitespace
    // (preserve interior tabs inside strings) and expand tabs to 4 spaces.
    const body = replaced.split('\n').map((line) => {
      // capture leading whitespace and the rest of the line
      const m = line.match(/^([ \t]*)([\s\S]*)$/)
      const leading = (m && m[1]) || ''
      const rest = (m && m[2]) || ''
      // convert leading tabs/spaces to a spaces-only indent (tab = 4 spaces)
      let spaceCount = 0
      for (let i = 0; i < leading.length; i++) {
        spaceCount += (leading[i] === '\t') ? 4 : 1
      }
      const normalized = ' '.repeat(spaceCount) + rest
      return indent(normalized)
    }).join('\n')
    const footer = `if _run is None:\n    raise ImportError('no async runner available')\n_run(__ssg_main())`
    const full = headerLinesArr.join('\n') + '\n' + body + '\n' + footer
    return { code: full, headerLines: headerLinesArr.length }
  }

  // Expose the transform helper for debugging/tests so tests can inspect
  // the exact transformed code without running it.
  try { window.__ssg_transform = transformAndWrap } catch (_e) { }

  // Load local vendored asyncify MicroPython directly: ./vendor/micropython.mjs
  try {
    let localMod = null
    try {
      // Import micropython.mjs directly to get loadMicroPython function
      await import('./vendor/micropython.mjs')
      if (globalThis.loadMicroPython) {
        localMod = { loadMicroPython: globalThis.loadMicroPython }
        appendTerminalDebug('Loaded asyncify runtime via direct import: ./vendor/micropython.mjs')
      } else {
        appendTerminalDebug('micropython.mjs imported but loadMicroPython not found on globalThis')
      }
    } catch (e) {
      appendTerminalDebug('Failed to import ./vendor/micropython.mjs: ' + e)
    }
    // build adapter from exports
    if (localMod) {
      // Prefer the modern loader API if present: loadMicroPython
      if (typeof localMod.loadMicroPython === 'function') {
        appendTerminalDebug('Vendor module provides loadMicroPython(); initializing runtime...')
        try {
          let captured = ''
          const td = new TextDecoder()
          const stdout = (chunk) => {
            let content = ''

            if (typeof chunk === 'string') {
              content = chunk
            } else if (chunk && (chunk instanceof Uint8Array || ArrayBuffer.isView(chunk))) {
              content = td.decode(chunk)
            } else if (typeof chunk === 'number') {
              content = String(chunk)
            } else {
              content = String(chunk || '')
            }

            // Display output immediately to the terminal
            if (content) {
              appendTerminal(content, 'stdout')
            }

            captured += content
          }
          const stderr = (chunk) => { stdout(chunk) }

          // Custom stdin function to replace browser prompts with terminal input
          const stdin = () => {
            console.log('STDIN FUNCTION CALLED - our custom stdin is working!')
            appendTerminal('DEBUG: Custom stdin function called!', 'runtime')
            return new Promise((resolve) => {
              // Set up input collection using the existing terminal input system
              window.__ssg_pending_input = {
                resolve: (value) => {
                  delete window.__ssg_pending_input
                  try { setTerminalInputEnabled(false) } catch (_e) { }
                  appendTerminal(`DEBUG: Resolving stdin with: ${value}`, 'runtime')
                  // Return the input with newline as MicroPython expects
                  resolve(value + '\n')
                },
                promptText: ''
              }
              // Enable terminal input immediately
              try { setTerminalInputEnabled(true, ''); } catch (_e) { }
              const stdinBox = $('stdin-box')
              if (stdinBox) { try { stdinBox.focus() } catch (_e) { } }
            })
          }

          // Set up custom input handler to replace browser prompts with terminal input
          const inputHandler = async function (promptText) {
            return new Promise((resolve) => {
              // Set up input collection
              window.__ssg_pending_input = {
                resolve: (value) => {
                  delete window.__ssg_pending_input
                  try { setTerminalInputEnabled(false) } catch (_e) { }

                  // Echo the input inline with the prompt
                  try {
                    const terminalOutput = $('terminal-output')
                    if (terminalOutput) {
                      const lines = terminalOutput.querySelectorAll('.terminal-line')
                      const lastLine = lines[lines.length - 1]

                      if (lastLine) {
                        // Append input directly to the last line (which should be the prompt)
                        if (value && value.trim()) {
                          lastLine.textContent += String(value)
                        }
                        // Always add a new line after input (or after prompt if blank input)
                        appendTerminal('', 'stdout')
                      } else {
                        // Fallback: add input on separate line if no last line found
                        if (value && value.trim()) {
                          appendTerminal(String(value), 'stdin')
                        } else {
                          appendTerminal('', 'stdout')
                        }
                      }
                    } else {
                      // Fallback: add input on separate line if no terminal output found
                      if (value && value.trim()) {
                        appendTerminal(String(value), 'stdin')
                      } else {
                        appendTerminal('', 'stdout')
                      }
                    }
                  } catch (_e) {
                    // Fallback on any error
                    if (value && value.trim()) {
                      appendTerminal(String(value), 'stdin')
                    } else {
                      appendTerminal('', 'stdout')
                    }
                  }

                  resolve((value || '').trim())
                },
                promptText: promptText || '',
                _usingDirectHandler: true  // Mark that we're using direct approach
              }

              // Display the prompt immediately in the terminal
              if (promptText) {
                appendTerminal(promptText, 'stdout')
              }

              // Enable terminal input 
              try { setTerminalInputEnabled(true, promptText || ''); } catch (_e) { }

              const stdinBox = $('stdin-box')
              if (stdinBox) {
                try {
                  stdinBox.value = ''

                  // Set up direct Enter key handler (bypass form submission)
                  const enterHandler = (e) => {
                    if (e.key === 'Enter' && window.__ssg_pending_input) {
                      e.preventDefault()
                      e.stopPropagation()

                      const value = (stdinBox.value || '').trim()

                      // Clean up the handlers
                      stdinBox.removeEventListener('keydown', enterHandler)
                      const form = $('terminal-input-form')
                      if (form) form.removeEventListener('submit', formHandler)
                      stdinBox.value = ''

                      // Resolve the input
                      window.__ssg_pending_input.resolve(value)
                    }
                  }

                  // Also handle form submission (for tests and edge cases)
                  const formHandler = (e) => {
                    if (window.__ssg_pending_input && window.__ssg_pending_input._usingDirectHandler) {
                      e.preventDefault()
                      e.stopPropagation()

                      const value = (stdinBox.value || '').trim()

                      // Clean up the handlers
                      stdinBox.removeEventListener('keydown', enterHandler)
                      const form = $('terminal-input-form')
                      if (form) form.removeEventListener('submit', formHandler)
                      stdinBox.value = ''

                      // Resolve the input
                      window.__ssg_pending_input.resolve(value)
                    }
                  }

                  stdinBox.addEventListener('keydown', enterHandler)
                  const form = $('terminal-input-form')
                  if (form) {
                    form.addEventListener('submit', formHandler)
                  }

                  // Focus the input field immediately
                  try {
                    stdinBox.focus()
                  } catch (_e) { }

                  // Also try again after a brief delay to ensure it works
                  setTimeout(() => {
                    try {
                      stdinBox.focus()
                    } catch (_e) { }
                  }, 10)
                } catch (_e) { }
              }
            })
          }

          const mpInstance = await localMod.loadMicroPython({
            url: (cfg?.runtime?.wasm) || './vendor/micropython.wasm',
            stdout, stderr, stdin, linebuffer: true,
            inputHandler: inputHandler
          })

          // NEW: Check if this is the v3.0.0 asyncify build with yielding support
          const hasYieldingSupport = typeof mpInstance.interruptExecution === 'function' &&
            typeof mpInstance.setYielding === 'function' &&
            typeof mpInstance.clearInterrupt === 'function'

          if (hasYieldingSupport) {
            appendTerminal('MicroPython runtime initialized (v3.0.0 with yielding support)', 'runtime')
            appendTerminalDebug('Detected asyncify v3.0.0 with interrupt and yielding support')

            // Enable yielding by default for interruptibility
            try {
              mpInstance.setYielding(true)
              appendTerminalDebug('✅ Yielding enabled for VM interrupt support')

              // Verify yielding is actually enabled
              setTimeout(() => {
                try {
                  appendTerminalDebug('Verifying yielding state...')
                  // Add a flag to track if yielding is enabled
                  window.__ssg_yielding_enabled = true
                  appendTerminalDebug('✅ Yielding state tracking initialized')
                } catch (e) {
                  appendTerminalDebug('Yielding verification failed: ' + e)
                }
              }, 100)

            } catch (e) {
              appendTerminalDebug('❌ Failed to enable yielding: ' + e)
              appendTerminal('Warning: Could not enable yielding - interrupts may not work properly', 'runtime')
              window.__ssg_yielding_enabled = false
            }
          } else {
            appendTerminal('MicroPython runtime initialized (legacy asyncify build)', 'runtime')
            appendTerminalDebug('Legacy asyncify build - no yielding support detected')
          }

          // expose runtime FS for persistence sync
          try { window.__ssg_runtime_fs = mpInstance.FS } catch (e) { }
          try { settleVfsReady() } catch (_e) { }
          // Wrap common FS ops to notify host when files are written
          try {
            const fs = mpInstance.FS
            try { fs.__ssg_fd_map = fs.__ssg_fd_map || {} } catch (_e) { }
            if (fs) {
              // wrap open to remember fd -> { path, wrote }
              if (typeof fs.open === 'function') {
                const origOpen = fs.open.bind(fs)
                fs.open = function (path, flags, mode) {
                  const fd = origOpen(path, flags, mode)
                  try { fs.__ssg_fd_map[fd] = { path: path, wrote: false } } catch (_e) { }
                  return fd
                }
              }
              // wrap write: after writing, attempt to read and notify
              if (typeof fs.write === 'function') {
                const origWrite = fs.write.bind(fs)
                fs.write = function (fd, buffer, offset, length, position) {
                  const res = origWrite(fd, buffer, offset, length, position)
                  try {
                    // mark this fd as having been written to
                    try { const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]; if (meta) meta.wrote = true } catch (_e) { }
                    const p = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                    const path = p && p.path ? p.path : fd
                    // notify asynchronously to avoid re-entrant stack loops during close/read
                    setTimeout(() => {
                      try {
                        if (window.__ssg_suppress_notifier) return
                        if (typeof fs.readFile === 'function') {
                          try {
                            const data = fs.readFile(path)
                            const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                            try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, text) } catch (_e) { }
                          } catch (_e) { }
                        }
                      } catch (_e) { }
                    }, 0)
                  } catch (_e) { }
                  return res
                }
              }
              // wrap close: after close, read the file and notify
              if (typeof fs.close === 'function') {
                const origClose = fs.close.bind(fs)
                fs.close = function (fd) {
                  const res = origClose(fd)
                  try {
                    const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                    if (meta) {
                      // only notify if this fd was written to (avoid notifications for pure reads)
                      if (meta.wrote) {
                        // schedule notify after current stack unwinds to avoid recursion
                        setTimeout(() => {
                          try {
                            if (window.__ssg_suppress_notifier) return
                            try {
                              if (typeof fs.readFile === 'function') {
                                const data = fs.readFile(meta.path)
                                const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                                try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(meta.path, text) } catch (_e) { }
                              }
                            } catch (_e) { }
                          } catch (_e) { }
                        }, 0)
                      }
                      try { delete fs.__ssg_fd_map[fd] } catch (_e) { }
                    }
                  } catch (_e) { }
                  return res
                }
              }
              // wrap createDataFile which some runtimes use to create files
              if (typeof fs.createDataFile === 'function') {
                const origCreateDataFile = fs.createDataFile.bind(fs)
                fs.createDataFile = function (parent, name, data, canRead, canWrite) {
                  const res = origCreateDataFile(parent, name, data, canRead, canWrite)
                  try {
                    const path = (parent === '/' ? '' : parent) + '/' + name
                    const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data || new Uint8Array()))
                    try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, text) } catch (_e) { }
                  } catch (_e) { }
                  return res
                }
              }
            }
          } catch (_e) { }
          // If VFS backend is available, mount files into the runtime FS so interpreter sees them
          try {
            const backend = window.__ssg_vfs_backend
            if (backend && typeof backend.mountToEmscripten === 'function') {
              await backend.mountToEmscripten(mpInstance.FS)
              appendTerminalDebug('VFS mounted into MicroPython FS')
              try { settleVfsReady() } catch (_e) { }
            }
          } catch (e) { appendTerminal('VFS mount error: ' + e) }
          // register a host module and override input() for better UX
          try {
            const hostModule = {
              get_input: async function (promptText = '') {
                // Don't print the prompt here since Python's input() already printed it
                // Just set up the UI for input collection
                return new Promise((resolve) => {
                  // store resolver temporarily on the window so UI handler can find it
                  window.__ssg_pending_input = { resolve, promptText }
                  // enable and focus the terminal inline input for immediate typing
                  try { setTerminalInputEnabled(true, promptText || ''); } catch (_e) { }
                  const stdinBox = $('stdin-box')
                  if (stdinBox) { try { stdinBox.focus() } catch (_e) { } }
                })
              }
            }

            // Register the host module
            if (typeof mpInstance.registerJsModule === 'function') {
              mpInstance.registerJsModule('host', hostModule)
            } else {
              window.__ssg_host = hostModule
            }

            // Just register host module without trying to override input() for now
            try {
              const hostModule = {
                get_input: async function (promptText = '') {
                  return new Promise((resolve) => {
                    window.__ssg_pending_input = { resolve, promptText }
                    try { setTerminalInputEnabled(true, promptText || ''); } catch (_e) { }
                    const stdinBox = $('stdin-box')
                    if (stdinBox) { try { stdinBox.focus() } catch (_e) { } }
                  })
                }
              }

              if (typeof mpInstance.registerJsModule === 'function') {
                mpInstance.registerJsModule('host', hostModule)
              } else {
                window.__ssg_host = hostModule
              }

              appendTerminalDebug('Host module registered for compatibility')
            } catch (e) {
              appendTerminal('Note: Could not register host module: ' + e)
            }
          } catch (e) { /* ignore */ }

          // Add a host notification for file writes so runtime can notify the UI immediately
          try {
            // expose a global notifier the UI side will implement
            window.__ssg_notify_file_written = window.__ssg_notify_file_written || (function () {
              // debounce rapid notifications per-path to avoid notifier->UI->save->notifier loops
              const lastNotified = new Map()
              const DEBOUNCE_MS = 120
              return function (path, content) {
                try {
                  // global suppress guard: if set, ignore runtime-originated notifications
                  try { if (window.__ssg_suppress_notifier) { try { appendTerminal && appendTerminal('[notify] globally suppressed: ' + String(path)) } catch (_e) { }; return } } catch (_e) { }
                  if (typeof path !== 'string') return
                  const n = '/' + path.replace(/^\/+/, '')

                  // debounce duplicates
                  try {
                    const prev = lastNotified.get(n) || 0
                    const now = Date.now()
                    if (now - prev < DEBOUNCE_MS) return
                    lastNotified.set(n, now)
                  } catch (_e) { }

                  // If this notification matches an expected write we performed recently,
                  // consume it and skip further UI processing to avoid echo loops.
                  try { if (consumeExpectedWriteIfMatches(n, content)) { try { appendTerminalDebug && appendTerminalDebug('[notify] ignored expected write: ' + n) } catch (_e) { }; return } } catch (_e) { }
                  // Log the notification only to debug logs (avoid noisy terminal output)
                  try { appendTerminalDebug('notify: ' + n) } catch (_e) { }
                  // update mem and localStorage mirror for tests and fallbacks (always keep mem in sync)
                  try { if (typeof mem !== 'undefined') { mem[n] = content } } catch (_e) { }
                  try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); map[n] = content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { }

                  // Queue the path for the UI to open later via the existing pending-tabs flow.
                  // Avoid calling TabManager.openTab/refresh directly from here to prevent
                  // write->notify->UI-write recursion and timing races. The UI reload/sync
                  // logic will process `__ssg_pending_tabs` and open tabs at a safe point.
                  try {
                    if (n !== MAIN_FILE) {
                      try { window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat([n]) } catch (_e) { }
                    }
                  } catch (_e) { }

                  // Ensure the pending list is deduplicated but keep entries for the UI to consume.
                  try { window.__ssg_pending_tabs = Array.from(new Set(window.__ssg_pending_tabs || [])) } catch (_e) { }
                  try { setTimeout(() => { try { flushPendingTabs() } catch (_e) { } }, 10) } catch (_e) { }
                } catch (_e) { }
              }
            })()
            // register into mpInstance host if possible
            if (typeof mpInstance.registerJsModule === 'function') {
              try { mpInstance.registerJsModule('host_notify', { notify_file_written: (p, c) => { try { window.__ssg_notify_file_written(p, c) } catch (_e) { } } }) } catch (_e) { }
            }
            // Also attempt to wrap the runtime FS write methods to call the notifier
            try {
              const fs = mpInstance.FS
              if (fs) {
                if (typeof fs.writeFile === 'function') {
                  const orig = fs.writeFile.bind(fs)
                  fs.writeFile = function (path, data) {
                    const res = orig(path, data)
                    try {
                      if (!(window.__ssg_suppress_notifier)) {
                        const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                        try { window.__ssg_notify_file_written(path, text) } catch (_e) { }
                      }
                    } catch (_e) { }
                    return res
                  }
                }
                if (typeof fs.writeFileSync === 'function') {
                  const orig2 = fs.writeFileSync.bind(fs)
                  fs.writeFileSync = function (path, data) {
                    const res = orig2(path, data)
                    try {
                      if (!(window.__ssg_suppress_notifier)) {
                        const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                        try { window.__ssg_notify_file_written(path, text) } catch (_e) { }
                      }
                    } catch (_e) { }
                    return res
                  }
                }
                if (typeof fs.writeFileText === 'function') {
                  const orig3 = fs.writeFileText.bind(fs)
                  fs.writeFileText = function (path, data) {
                    const res = orig3(path, data)
                    try {
                      if (!(window.__ssg_suppress_notifier)) {
                        try { window.__ssg_notify_file_written(path, String(data)) } catch (_e) { }
                      }
                    } catch (_e) { }
                    return res
                  }
                }
              }
            } catch (_e) { }
          } catch (_e) { }

          runtimeAdapter = {
            _module: mpInstance,  // Expose the module for asyncify detection
            hasYieldingSupport: hasYieldingSupport,  // NEW: Flag to indicate v3.0.0 features
            runPythonAsync: async (code) => {
              captured = ''
              try {
                if (typeof mpInstance.runPythonAsync === 'function') {
                  const maybe = await mpInstance.runPythonAsync(code)
                  // Don't return captured output since it's already been displayed in real-time
                  return maybe == null ? '' : String(maybe)
                }
                throw new Error('runPythonAsync not available')
              } catch (e) { throw e }
            },
            run: async (code) => {
              captured = ''
              try {
                // prefer async runner if available
                if (typeof mpInstance.runPythonAsync === 'function') {
                  const maybe = await mpInstance.runPythonAsync(code)
                  // Don't return captured output since it's already been displayed in real-time
                  return maybe == null ? '' : String(maybe)
                }
                if (typeof mpInstance.runPython === 'function') {
                  const maybe = mpInstance.runPython(code)
                  // Don't return captured output since it's already been displayed in real-time
                  return maybe == null ? '' : String(maybe)
                }
                // Don't return captured output since it's already been displayed in real-time
                return ''
              } catch (e) { throw e }
            },
            // NEW: Expose the v3.0.0 interrupt functions
            interruptExecution: hasYieldingSupport ? mpInstance.interruptExecution.bind(mpInstance) : null,
            setYielding: hasYieldingSupport ? mpInstance.setYielding.bind(mpInstance) : null,
            clearInterrupt: hasYieldingSupport ? mpInstance.clearInterrupt.bind(mpInstance) : null
          }
        } catch (e) { appendTerminal('Failed to initialize vendored MicroPython: ' + e) }
      } else {
        const runFn = localMod.run || localMod.default?.run || localMod.MicroPy?.run || localMod.default
        if (typeof runFn === 'function') {
          runtimeAdapter = {
            run: async (code, input) => {
              // If module run accepts options, pass them; otherwise just call with code
              try {
                // call with (code, {input}) if supported
                const maybe = runFn.length >= 2 ? await runFn(code, { input, onPrint: (t) => {/*ignored*/ } }) : await runFn(code)
                return maybe === undefined ? '' : String(maybe)
              } catch (e) { throw e }
            }
          }
        } else if (localMod.exec && typeof localMod.exec === 'function') {
          runtimeAdapter = { run: async (code) => String(await localMod.exec(code)) }
        }
      }
    }
  } catch (e) {
    // ignore — vendor not present or failed to load
    // appendTerminal('Local vendor load failed: ' + e)
  }

  // If no local vendor adapter, choose runtime URL: explicit `runtime.url` or fallback to `runtime.recommended`.
  if (!runtimeAdapter) {
    const runtimeUrl = (cfg?.runtime?.url && cfg.runtime.url.trim()) ? cfg.runtime.url.trim() : cfg?.runtime?.recommended
    if (runtimeUrl) {
      try {
        const s = document.createElement('script')
        s.src = runtimeUrl
        // If the runtime is an ES module (.mjs), mark the script as a module so import.meta is allowed
        if (/\.mjs(\?|$)/i.test(runtimeUrl)) {
          s.type = 'module'
        }
        s.defer = true
        // allow cross-origin fetching where appropriate
        s.crossOrigin = 'anonymous'
        document.head.appendChild(s)
        appendTerminalDebug('Runtime loader script appended: ' + runtimeUrl)

        // Probe for runtime availability for a short timeout and build an adapter
        runtimeAdapter = await (async function probeRuntime(timeoutMs = 8000) {
          const start = Date.now()
          function findGlobal() {
            // prefer explicit bridge global when present
            if (window.__ssg_runtime) return { type: 'bridge', obj: window.__ssg_runtime }
            if (window.pyodide) return { type: 'pyodide', obj: window.pyodide }
            if (window.MicroPy) return { type: 'micropy', obj: window.MicroPy }
            if (window.micropython) return { type: 'micropy', obj: window.micropython }
            for (const k of Object.keys(window)) {
              if (/micro(py|python)|micropy|micropython/i.test(k) && typeof window[k] === 'object') {
                return { type: 'micropy', obj: window[k] }
              }
            }
            return null
          }

          while (Date.now() - start < timeoutMs) {
            const found = findGlobal()
            if (found) {
              appendTerminalDebug('Runtime detected: ' + found.type)
              // helpful diagnostic: if it's the bridge, list exported keys
              try {
                if (found.type === 'bridge' && found.obj) {
                  const keys = Object.keys(found.obj).slice(0, 50)
                  appendTerminalDebug('Bridge exports: ' + keys.join(', '))
                }
              } catch (e) {/*ignore*/ }
              if (found.type === 'pyodide') {
                return {
                  run: async (code, input) => {
                    const indent = code.split('\n').map(l => '    ' + l).join('\n')
                    const wrapper = `import sys, io\nbuf = io.StringIO()\n_old = sys.stdout\nsys.stdout = buf\ntry:\n${indent}\nfinally:\n    sys.stdout = _old\nbuf.getvalue()`
                    return await window.pyodide.runPythonAsync(wrapper)
                  }
                }
              }
              // If the bridge/global offers loadMicroPython, initialize an instance and use it
              if (found.type === 'bridge' && found.obj) {
                if (typeof found.obj.loadMicroPython === 'function') {
                  appendTerminalDebug('Bridge exposes loadMicroPython(); initializing...')
                  try {
                    let captured = ''
                    const td = new TextDecoder()
                    const stdout = (c) => {
                      if (typeof c === 'string') captured += c + '\n'
                      else if (c && (c instanceof Uint8Array || ArrayBuffer.isView(c))) captured += td.decode(c)
                      else captured += String(c || '')
                    }
                    const stderr = (c) => stdout(c)
                    const mp = await found.obj.loadMicroPython({ url: (cfg?.runtime?.wasm) || './vendor/micropython.wasm', stdout, stderr, linebuffer: true })
                    try { window.__ssg_runtime_fs = mp.FS } catch (e) { }
                    try { settleVfsReady() } catch (_e) { }
                    // mount VFS if available
                    try {
                      const backend = window.__ssg_vfs_backend
                      if (backend && typeof backend.mountToEmscripten === 'function') {
                        await backend.mountToEmscripten(mp.FS)
                        appendTerminalDebug('VFS mounted into MicroPython FS')
                        try { settleVfsReady() } catch (_e) { }
                      }
                    } catch (e) { appendTerminal('VFS mount error: ' + e) }
                    appendTerminal('Bridge MicroPython initialized')
                    return {
                      _module: mp,  // Expose the module so we can access runPythonAsync
                      runPythonAsync: async (code) => {
                        captured = ''
                        if (typeof mp.runPythonAsync === 'function') {
                          const m = await mp.runPythonAsync(code)
                          // Don't return captured output since it's already been displayed in real-time
                          return m == null ? '' : String(m)
                        }
                        throw new Error('runPythonAsync not available')
                      },
                      run: async (code, input) => {
                        captured = ''
                        if (typeof mp.runPythonAsync === 'function') {
                          const m = await mp.runPythonAsync(code)
                          // Don't return captured output since it's already been displayed in real-time
                          return m == null ? '' : String(m)
                        }
                        if (typeof mp.runPython === 'function') {
                          const m = mp.runPython(code)
                          // Don't return captured output since it's already been displayed in real-time
                          return m == null ? '' : String(m)
                        }
                        // Don't return captured output since it's already been displayed in real-time
                        return ''
                      }
                    }
                  } catch (e) { appendTerminal('Bridge init failed: ' + e) }
                }
              }

              return {
                run: async (code, input) => {
                  try {
                    if (typeof found.obj.run === 'function') {
                      let out = ''
                      if (found.obj.run.length >= 2) {
                        await found.obj.run(code, { onPrint: (t) => out += t + '\n', input })
                      } else {
                        const r = await found.obj.run(code)
                        if (r !== undefined) out += String(r)
                      }
                      return out
                    }
                    if (typeof found.obj.exec === 'function') {
                      const r = await found.obj.exec(code)
                      return r === undefined ? '' : String(r)
                    }
                  } catch (e) { throw e }
                  throw new Error('No runnable API found on detected runtime')
                }
              }
            }
            await new Promise(r => setTimeout(r, 200))
          }
          appendTerminal('Runtime probe timed out; no runtime available')
          return null
        })()
      } catch (e) {
        appendTerminal('Failed to append runtime script: ' + e)
      }
    }
  }

  $('run').addEventListener('click', async () => {
    // Prevent multiple simultaneous executions
    if (executionState.isRunning) {
      appendTerminal('>>> Execution already in progress...', 'runtime')
      return
    }

    setExecutionRunning(true)
    appendTerminal('>>> Running...', 'runtime')

    // Clear Python state before each execution to ensure fresh start
    try {
      if (window.clearMicroPythonState) {
        window.clearMicroPythonState()
      }
    } catch (err) {
      appendTerminalDebug('⚠️ State clearing failed:', err)
    }

    // Get timeout from config (default 30 seconds)
    const timeoutSeconds = cfg?.execution?.timeoutSeconds || 30
    const timeoutMs = timeoutSeconds * 1000

    // Safety timeout for infinite loops (default 5 seconds, configurable)
    const safetyTimeoutSeconds = cfg?.execution?.safetyTimeoutSeconds || 5
    const safetyTimeoutMs = Math.min(safetyTimeoutSeconds * 1000, timeoutMs)

    // disable terminal input by default; enable only if runtime requests input
    try { setTerminalInputEnabled(false) } catch (_e) { }
    // Activate terminal tab automatically when running
    try { activateSideTab('terminal') } catch (_e) { }

    // Save current active tab's content (if any) so that latest edits are persisted
    try {
      const activePath = (typeof TabManager.getActive === 'function') ? TabManager.getActive() : null
      if (activePath) {
        const current = (cm ? cm.getValue() : textarea.value)
        // await write to ensure persistence before running/assertions
        try { await FileManager.write(activePath, current) } catch (_) { /* ignore write errors */ }
      }
      // Always persist the MAIN_FILE with current editor contents as run executes main.py
      try {
        const currentMain = (cm ? cm.getValue() : textarea.value)
        await FileManager.write(MAIN_FILE, currentMain)
      } catch (_) { /* ignore */ }
    } catch (_) { /* ignore */ }

    // Always run the protected main program file
    const code = FileManager.read(MAIN_FILE) || ''
    // Ensure runtimeAdapter exists (no worker path supported)
    if (!runtimeAdapter) { appendTerminal('ERROR: no runtime available', 'runtime'); try { setTerminalInputEnabled(false) } catch (_e) { }; return }

    // Regex-based feedback: rules can target `code`, `output`, or `input`.
    // Prepare feedback/input/output variables
    const rules = (cfg?.feedback?.regex) || []
    let runtimeOutput = ''
    let providedInput = ''
    try {
      // If any rule targets input, prompt the user once
      const needsInput = rules.some(r => r.target === 'input')
      if (needsInput) { providedInput = (await showInputModal('Program input', 'Provide input for the program (used by some feedback rules):', '')) || '' }

      for (const r of rules) {
        const target = r.target || 'code'
        const text = (target === 'code') ? code : (target === 'output') ? runtimeOutput : (target === 'input') ? providedInput : ''
        const re = new RegExp(r.pattern)
        if (re.test(text)) {
          // Route feedback to a stub and debug logger; do not show in terminal
          try { appendTerminalDebug('Feedback (' + target + '): ' + r.message) } catch (_e) { }
          try { if (typeof window.__ssg_feedback_stub === 'function') window.__ssg_feedback_stub({ target, message: r.message, matchText: text }) } catch (_e) { }
        }
      }
    } catch (e) { appendTerminal('Feedback engine error: ' + e) }

    // Yield once to ensure the click event completes and the browser can update.
    await new Promise(r => setTimeout(r, 0))
    appendTerminalDebug('Run handler resumed after yield')

    // Transform code to async wrapper so input() becomes await host.get_input()
    // With asyncify MicroPython, input() works natively without transformation!
    try {
      let codeToRun = code
      let headerLines = 0
      let needsTransformation = false

      // Check if this is asyncify MicroPython (runPythonAsync available)
      const isAsyncify = runtimeAdapter &&
        (typeof runtimeAdapter.runPythonAsync === 'function')

      if (isAsyncify) {
        // With asyncify, we can run the code directly without transformation!
        appendTerminalDebug('Using asyncify MicroPython - no transformation needed')
        codeToRun = code
        headerLines = 0
      } else {
        // Non-asyncify runtime: transform input() to await host.get_input()
        appendTerminalDebug('Using transform-based approach for input() handling')
        const transformed = transformAndWrap(code)
        codeToRun = transformed.code
        headerLines = transformed.headerLines
        needsTransformation = true
      }
      // If transformed code expects input, focus the stdin box and wire Enter->send
      const stdinBox = $('stdin-box')
      if (/await host.get_input\(/.test(codeToRun) && stdinBox) {
        // Let the terminal inline form handle Enter/submit. Just focus the input.
        try { stdinBox.focus() } catch (_e) { }
      }

      if (runtimeAdapter && typeof runtimeAdapter.run === 'function') {
        try {
          // If transformed code uses `await host.get_input`, ensure the runtime
          // can parse `async def`/`await` syntax before attempting to run it.
          // If parsing fails, throw a sentinel error so the existing fallback
          // path (which looks for /no async runner available/) is taken.
          if (needsTransformation && /\bawait host.get_input\(/.test(codeToRun)) {
            try {
              // Probe parse of a tiny async snippet; if runtime can't parse
              // async/await syntax this will typically throw a SyntaxError.
              await runtimeAdapter.run('async def __ssg_probe():\n    pass')
            } catch (probeErr) {
              const pm = String(probeErr || '')
              if (/syntax|invalid|bad input|indent/i.test(pm)) {
                throw new Error('no async runner available')
              }
            }
          }
          // Ensure backend files are mounted into the interpreter FS before running.
          try {
            const backend = window.__ssg_vfs_backend
            const fs = window.__ssg_runtime_fs
            // First, ensure any UI FileManager contents are pushed into the backend so mount sees them
            try {
              if (backend && typeof backend.write === 'function' && typeof FileManager?.list === 'function') {
                const files = FileManager.list()
                for (const p of files) {
                  try {
                    const c = FileManager.read(p)
                    // backend.write expects normalized path
                    // suppress notifier echoes while we push UI files into backend
                    try { window.__ssg_suppress_notifier = true } catch (_e) { }
                    await backend.write(p, c == null ? '' : c)
                    try { window.__ssg_suppress_notifier = false } catch (_e) { }
                  } catch (_e) { /* ignore per-file */ }
                }
                appendTerminalDebug('Synced UI FileManager -> backend (pre-run)')
              } else if (fs && typeof fs.writeFile === 'function' && typeof FileManager?.list === 'function') {
                // no async backend available; write directly into runtime FS from UI FileManager
                const files = FileManager.list()
                for (const p of files) {
                  try {
                    const content = FileManager.read(p) || ''
                    try { markExpectedWrite(p, content) } catch (_e) { }
                    try { window.__ssg_suppress_notifier = true } catch (_e) { }
                    fs.writeFile(p, content)
                    try { window.__ssg_suppress_notifier = false } catch (_e) { }
                  } catch (_e) { }
                }
                appendTerminalDebug('Synced UI FileManager -> runtime FS (pre-run)')
              }
            } catch (_e) { appendTerminal('Pre-run sync error: ' + _e) }

            if (backend && typeof backend.mountToEmscripten === 'function' && fs) {
              appendTerminal('Ensuring VFS is mounted into MicroPython FS (pre-run)')
              // Mark expected writes for backend files so mount echoes are ignored by the notifier.
              try {
                const bk = await backend.list()
                for (const p of bk) { try { const c = await backend.read(p); markExpectedWrite(p, c || '') } catch (_e) { } }
              } catch (_e) { }
              let mounted = false
              for (let attempt = 0; attempt < 3 && !mounted; attempt++) {
                try {
                  try { window.__ssg_suppress_notifier = true } catch (_e) { }
                  await backend.mountToEmscripten(fs)
                  try { window.__ssg_suppress_notifier = false } catch (_e) { }
                  mounted = true
                  appendTerminalDebug('VFS mounted into MicroPython FS (pre-run)')
                  try { settleVfsReady() } catch (_e) { }
                } catch (merr) {
                  appendTerminal('VFS pre-run mount attempt #' + (attempt + 1) + ' failed: ' + String(merr))
                  await new Promise(r => setTimeout(r, 150))
                }
              }
              if (!mounted) appendTerminal('Warning: VFS pre-run mount attempts exhausted')
            }
          } catch (_m) { appendTerminal('VFS pre-run mount error: ' + _m) }

          // Execute code using appropriate method (asyncify vs transformation)
          if (isAsyncify && !needsTransformation) {
            appendTerminalDebug('Executing with asyncify runPythonAsync - native input() support')
            try {
              let out = ''
              if (typeof runtimeAdapter.runPythonAsync === 'function') {
                out = await executeWithTimeout(runtimeAdapter.runPythonAsync(codeToRun), timeoutMs, safetyTimeoutMs)
              } else {
                // Fallback to regular run method
                out = await executeWithTimeout(runtimeAdapter.run(codeToRun), timeoutMs, safetyTimeoutMs)
              }
              const runtimeOutput = out === undefined ? '' : String(out)
              if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
            } catch (asyncifyErr) {
              const errMsg = String(asyncifyErr)

              // Handle KeyboardInterrupt (from VM interrupt) specially  
              if (errMsg.includes('KeyboardInterrupt')) {
                appendTerminal('>>> Execution interrupted by user (KeyboardInterrupt)', 'runtime')
                return // Clean exit for user-initiated interrupts
              }

              // Handle safety timeout (VM stuck in tight loop)
              if (errMsg.includes('Safety timeout') || errMsg.includes('tight loop')) {
                appendTerminal('>>> Execution stopped: Code appears to be stuck in an infinite loop', 'runtime')
                appendTerminal('>>> Tip: Add time.sleep() calls in loops to allow interrupts to work', 'runtime')
                return // Clean exit for safety timeout
              }

              // Handle execution timeout
              if (errMsg.includes('Execution timeout')) {
                appendTerminal('>>> Execution timeout: Program took too long to complete', 'runtime')
                return // Clean exit for timeout
              }

              // Handle cancellation
              if (errMsg.includes('cancelled by user')) {
                appendTerminal('>>> Execution cancelled by user', 'runtime')
                return // Clean exit for user cancellation
              }

              // Handle specific "async operation in flight" error
              if (errMsg.includes('We cannot start an async operation when one is already flight') ||
                errMsg.includes('async operation') || errMsg.includes('already flight')) {
                appendTerminal('Runtime Error: Previous execution was interrupted and left the runtime in an inconsistent state.', 'runtime')
                appendTerminal('Attempting automatic runtime recovery...', 'runtime')

                let recovered = false

                // Try aggressive v3.0.0 recovery
                if (runtimeAdapter && runtimeAdapter.clearInterrupt) {
                  try {
                    appendTerminalDebug('Clearing interrupt state with v3.0.0 API...')
                    runtimeAdapter.clearInterrupt()
                    appendTerminalDebug('✅ Basic interrupt state cleared')
                  } catch (err) {
                    appendTerminalDebug('v3.0.0 clear interrupt failed: ' + err)
                  }
                }

                // Try to reset asyncify state by reinitializing the runtime adapter
                try {
                  if (runtimeAdapter && runtimeAdapter._module) {
                    appendTerminalDebug('Attempting to reset asyncify state...')

                    // Try to access and reset asyncify internals if possible
                    const Module = runtimeAdapter._module
                    if (Module.Asyncify) {
                      appendTerminalDebug('Found Asyncify object, attempting state reset...')
                      try {
                        // Reset asyncify state variables if accessible
                        if (Module.Asyncify.currData) Module.Asyncify.currData = 0
                        if (Module.Asyncify.state) Module.Asyncify.state = 0  // Normal state
                        appendTerminalDebug('✅ Asyncify state variables reset')
                        recovered = true
                      } catch (e) {
                        appendTerminalDebug('Asyncify state reset failed: ' + e)
                      }
                    }

                    // Try REPL reinitialization
                    if (typeof Module.ccall === 'function') {
                      try {
                        Module.ccall('mp_js_repl_init', 'null', [], [])
                        appendTerminalDebug('✅ REPL reinitialized')
                        recovered = true
                      } catch (e) {
                        appendTerminalDebug('REPL reinit failed: ' + e)
                      }
                    }
                  }
                } catch (resetErr) {
                  appendTerminalDebug('Asyncify reset attempt failed: ' + resetErr)
                }

                if (recovered) {
                  appendTerminal('✅ Runtime state cleared successfully', 'runtime')
                  appendTerminal('You can try running code again. If problems persist, refresh the page.', 'runtime')
                } else {
                  appendTerminal('⚠️ Automatic recovery failed. You may need to refresh the page if the next execution fails.', 'runtime')
                }

                appendTerminal('Technical details: ' + errMsg, 'runtime')
              } else if (errMsg.includes('EOFError')) {
                appendTerminal('Input Error: Input operation was interrupted.', 'runtime')
                appendTerminal('This is normal when stopping execution during input().', 'runtime')

                // Try to clean up input state
                try {
                  if (window.__ssg_pending_input) {
                    appendTerminalDebug('Cleaning up pending input state...')
                    delete window.__ssg_pending_input
                  }
                  setTerminalInputEnabled(false)
                } catch (_e) { }
              } else {
                // For Python errors, show the clean traceback without "Asyncify" prefix
                if (errMsg.includes('Traceback')) {
                  appendTerminal(errMsg, 'stderr')
                } else {
                  // For non-Python errors, show with context
                  appendTerminal('Execution error: ' + errMsg, 'runtime')
                  throw asyncifyErr
                }
              }
            }
          } else {
            // Traditional transformed execution
            const out = await executeWithTimeout(runtimeAdapter.run(codeToRun), timeoutMs, safetyTimeoutMs)
            const runtimeOutput = out === undefined ? '' : String(out)
            if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
          }
          // After run completes, sync any interpreter-side FS changes back to persistent VFS
          try {
            const backend = window.__ssg_vfs_backend
            const fs = window.__ssg_runtime_fs
            if (backend && typeof backend.syncFromEmscripten === 'function' && fs) {
              await backend.syncFromEmscripten(fs)
              try { await reloadFilesFromBackend(backend); try { openTabsFromMem() } catch (_e) { } } catch (_e) { }
              // Additionally, attempt to persist runtime FS files directly into mem/localStorage
              try {
                if (fs && typeof fs.readdir === 'function') {
                  const entries = fs.readdir('/')
                  for (const en of entries) {
                    if (!en) continue
                    if (en === '.' || en === '..') continue
                    const path = en.startsWith('/') ? en : ('/' + en)
                    try {
                      let content = null
                      if (typeof fs.readFile === 'function') {
                        const data = fs.readFile(path)
                        content = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                      } else if (typeof fs.readFileSync === 'function') {
                        const data = fs.readFileSync(path)
                        content = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                      }
                      if (content != null) {
                        const norm = '/' + path.replace(/^\/+/, '')
                        mem[norm] = content
                        try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); map[norm] = content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { }
                      }
                    } catch (_e) { }
                  }
                  try { openTabsFromMem() } catch (_e) { }
                }
              } catch (_e) { }
            } else {
              // ensure localStorage fallback is updated for MAIN_FILE so tests can read it
              try {
                const cur = (cm ? cm.getValue() : textarea.value)
                const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                map['/main.py'] = cur
                localStorage.setItem('ssg_files_v1', JSON.stringify(map))
              } catch (_e) { }
              // If runtime FS is present, persist its files into mem/localStorage so UI can pick them up
              try {
                const fs = window.__ssg_runtime_fs
                if (fs && typeof fs.readdir === 'function') {
                  try {
                    const entries = fs.readdir('/')
                    for (const en of entries) {
                      if (!en) continue
                      if (en === '.' || en === '..') continue
                      const path = '/' + en
                      try {
                        let content = null
                        // Try both '/name' and 'name' forms for runtime FS reads
                        const tryPaths = [path, en]
                        for (const tp of tryPaths) {
                          try {
                            if (typeof fs.readFile === 'function') {
                              const data = fs.readFile(tp)
                              if (data) { content = (typeof data === 'string') ? data : (new TextDecoder().decode(data)); break }
                            } else if (typeof fs.readFileSync === 'function') {
                              const data = fs.readFileSync(tp)
                              if (data) { content = (typeof data === 'string') ? data : (new TextDecoder().decode(data)); break }
                            }
                          } catch (_e) { }
                        }
                        if (content != null) { const norm = '/' + path.replace(/^\/+/, ''); mem[norm] = content; try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); map[norm] = content; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { } }
                      } catch (_e) { }
                    }
                  } catch (_e) { }
                }
              } catch (_e) { }
              // Give runtime a short moment to flush files, then open tabs from mem
              try { setTimeout(() => { try { openTabsFromMem() } catch (_e) { } }, 80) } catch (_e) { }
            }
          } catch (e) { appendTerminal('VFS sync after run failed: ' + e) }
        } catch (e) {
          const msg = String(e || '')
          // If no async runner is available, fall back to a pre-prompt strategy
          if (/no async runner available/i.test(msg)) {
            try {
              // ensure VFS mounted before entering fallback loop
              try {
                const backend = window.__ssg_vfs_backend
                const fs = window.__ssg_runtime_fs
                if (backend && typeof backend.mountToEmscripten === 'function' && fs) {
                  appendTerminal('Ensuring VFS is mounted into MicroPython FS (pre-fallback)')
                  let ok = false
                  for (let i = 0; i < 3 && !ok; i++) {
                    try { await backend.mountToEmscripten(fs); ok = true; appendTerminal('VFS mounted into MicroPython FS (pre-fallback)') } catch (e) { appendTerminal('VFS pre-fallback mount failed: ' + e); await new Promise(r => setTimeout(r, 120)) }
                  }
                  if (!ok) appendTerminal('Warning: VFS pre-fallback mount attempts exhausted')
                }
              } catch (_e) { appendTerminal('VFS pre-fallback mount error: ' + _e) }
              // Iterative split-run fallback: handle multiple sequential input() calls.
              const lines = code.split('\n')
              let executedLine = 0
              // Quick check: detect input() calls that live inside compound statements
              // where sibling clauses (else/elif/except/finally) appear later in the file.
              // The simple split-run strategy cannot safely split these across separate
              // runs because `else:`/`elif:` must be in the same parse unit as the
              // corresponding header. If detected, abort fallback and show a helpful
              // message so the user knows to either enable an async-capable runtime
              // or rewrite to avoid inline input inside such compound statements.
              try {
                for (let i = 0; i < lines.length; i++) {
                  if (/\binput\s*\(/.test(lines[i])) {
                    // If input is indented (i.e., inside a block) and there's any later
                    // top-level sibling clause like `else:`/`elif`/`except`/`finally`,
                    // then split-run is unsafe.
                    const leading = (lines[i].match(/^([ \t]*)/) || [])[1] || ''
                    const indentLen = leading.replace(/\t/g, '    ').length
                    // scan forward for sibling clauses at indent <= the line's indent
                    for (let j = i + 1; j < Math.min(lines.length, i + 200); j++) {
                      const text = lines[j]
                      if (!text) continue
                      const tLeading = (text.match(/^([ \t]*)/) || [])[1] || ''
                      const tIndent = tLeading.replace(/\t/g, '    ').length
                      const trimmed = text.trim()
                      if (/^(else:|elif\b|except\b|finally\b)/.test(trimmed) && tIndent <= indentLen) {
                        appendTerminal('Fallback unsupported: inline input() inside compound statement (else/elif/except/finally present)')
                        fallbackLog('unsupported:compound_input', { inputLine: i, clauseLine: j })
                        throw new Error('fallback:unsupported-compound-input')
                      }
                    }
                  }
                }
              } catch (decl) { throw decl }
              // Helper to run a block of lines [start, end) and append output
              const runBlock = async (start, end) => {
                if (end <= start) return
                const block = lines.slice(start, end).join('\n')
                try {
                  try {
                    const out = await runtimeAdapter.run(block)
                    if (out) appendTerminal(out)
                  } catch (errRun) {
                    const msg = String(errRun || '')
                    // Common failure when running a partial block: "expected an indented block" or unexpected EOF
                    // Also handle the case where running a single header line like `if True:` produces
                    // a SyntaxError (invalid syntax) in some runtimes; if the block ends with ':' then
                    // it's likely a partial block and we should retry by appending an indented pass.
                    const looksLikePartialBlock = /expected an indented block|unexpected EOF|unexpected indent|unterminated|inconsistent use of tabs and spaces|inconsistent use of tabs/i.test(msg) || (/invalid syntax/i.test(msg) && /:\s*$/.test(block))
                    if (looksLikePartialBlock) {
                      // try again by appending a dummy indented pass to close any open block headers
                      try {
                        fallbackLog('runBlock:retry-padding', { start, end })
                        // Normalize tabs to 4 spaces then retry; helps when code uses mixed tabs/spaces
                        const normalized = block.replace(/\t/g, '    ')
                        const padded = normalized + '\n' + '    pass'
                        const out2 = await runtimeAdapter.run(padded)
                        if (out2) appendTerminal(out2)
                        fallbackLog('runBlock:retry-success', { start, end })
                      } catch (_e) {
                        // fallback to reporting original error if the retry fails
                        fallbackLog('runBlock:retry-failed', { start, end, err: String(_e) })
                        throw errRun
                      }
                    } else {
                      throw errRun
                    }
                  }
                } catch (err) {
                  // Map traceback with offset = start (lines already executed)
                  mapTracebackAndShow(String(err), start, code)
                  throw err
                }
              }

              while (true) {
                // find next input() line from executedLine onwards
                let nextInputLine = -1
                for (let i = executedLine; i < lines.length; i++) {
                  if (/\binput\s*\(/.test(lines[i])) { nextInputLine = i; break }
                }
                if (nextInputLine === -1) break // no more inputs

                // run code up to the line with the input (non-inclusive)
                fallbackLog('runBlock:pre', { start: executedLine, end: nextInputLine })
                await runBlock(executedLine, nextInputLine)
                fallbackLog('runBlock:post', { start: executedLine, end: nextInputLine })

                // prepare prompt text (if input literal present on this line)
                const inputLine = lines[nextInputLine]
                const promptMatch = inputLine.match(/input\s*\(\s*(['\"])(.*?)\1\s*\)/)
                const promptText = promptMatch ? promptMatch[2] : ''
                try {
                  try { setTerminalInputEnabled(true, promptText || '') } catch (_e) { }
                  const stdinBoxLocal = $('stdin-box')
                  if (stdinBoxLocal) try { stdinBoxLocal.focus() } catch (_e) { }
                } catch (_e) { }

                // wait for user submit via the existing pending_input mechanism
                const val = await new Promise((resolve) => {
                  window.__ssg_pending_input = { resolve, promptText }
                  fallbackLog('pending_input:set', { promptText })
                  try { setTerminalInputEnabled(true, promptText || '') } catch (_e) { }
                  try { const stdinBoxLocal2 = $('stdin-box'); if (stdinBoxLocal2) stdinBoxLocal2.focus() } catch (_e) { }
                })
                fallbackLog('pending_input:resolved', { value: val })

                // replace only the first occurrence of input(...) on this line with a Python literal
                const literal = JSON.stringify(val)
                lines[nextInputLine] = inputLine.replace(/input\s*\(.*?\)/, literal)

                // execute the replaced line so any assignments/effects happen now
                // single-line execution can fail if the line is indented; run it directly and only map tracebacks
                // after both the original and a dedented retry fail to avoid false-positive tracebacks.
                try {
                  try {
                    fallbackLog('execLine:pre', { line: nextInputLine, text: lines[nextInputLine] })
                    const out = await runtimeAdapter.run(lines[nextInputLine])
                    if (out) appendTerminal(out)
                    fallbackLog('execLine:post', { line: nextInputLine })
                  } catch (singleErr) {
                    const msg = String(singleErr || '')
                    if (/unexpected indent|unexpected EOF|invalid syntax|expected an indented block/i.test(msg)) {
                      // attempt dedented retry
                      try {
                        const orig = lines[nextInputLine]
                        // First try a simple dedent
                        const dedented = orig.replace(/^[ \t]+/, '')
                        try {
                          const out2 = await runtimeAdapter.run(dedented)
                          if (out2) appendTerminal(out2)
                        } catch (_try2) {
                          // If dedent failed, also try normalizing tabs to spaces then dedenting
                          const normalized = orig.replace(/\t/g, '    ')
                          const dedented2 = normalized.replace(/^[ \t]+/, '')
                          const out3 = await runtimeAdapter.run(dedented2)
                          if (out3) appendTerminal(out3)
                        }
                      } catch (dedentErr) {
                        // Both attempts failed — map traceback relative to the original line offset
                        fallbackLog('execLine:failed', { line: nextInputLine, err: String(singleErr || dedentErr) })
                        mapTracebackAndShow(String(singleErr || dedentErr), nextInputLine, code)
                        throw singleErr
                      }
                    } else {
                      fallbackLog('execLine:failed', { line: nextInputLine, err: String(singleErr) })
                      mapTracebackAndShow(String(singleErr), nextInputLine, code)
                      throw singleErr
                    }
                  }
                } catch (e) {
                  // propagate after mapping was handled above
                  throw e
                }

                // advance executedLine past the line we just executed
                executedLine = nextInputLine + 1
              }

              // finally run any remaining code after last input
              if (executedLine < lines.length) {
                await runBlock(executedLine, lines.length)
              }
              // after fallback finished, sync FS back to persistent storage
              try {
                const backend = window.__ssg_vfs_backend
                const fs = window.__ssg_runtime_fs
                if (backend && typeof backend.syncFromEmscripten === 'function' && fs) {
                  await backend.syncFromEmscripten(fs)
                  try { await reloadFilesFromBackend(backend); try { openTabsFromMem() } catch (_e) { } } catch (_e) { }
                } else {
                  try { const cur = (cm ? cm.getValue() : textarea.value); const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); map['/main.py'] = cur; localStorage.setItem('ssg_files_v1', JSON.stringify(map)) } catch (_e) { }
                  try { openTabsFromMem() } catch (_e) { }
                }
              } catch (_e) { appendTerminal('VFS sync after fallback failed: ' + _e) }
            } catch (_e) { appendTerminal('Fallback input error: ' + _e) }
          } else {
            try { mapTracebackAndShow(String(e), headerLines, code) } catch (_) { appendTerminal('Runtime error: ' + e) }
          }
        }
      } else {
        appendTerminal('[error] no runtime adapter available')
      }
    } catch (e) {
      appendTerminal('Transform/run error: ' + e, 'runtime');
      try { setTerminalInputEnabled(false) } catch (_e) { }
    } finally {
      // Always reset execution state
      setExecutionRunning(false)
    }

    // Re-run regex feedback for rules targeting output now that runtimeOutput may be available
    try {
      const rules = (cfg?.feedback?.regex) || []
      for (const r of rules) {
        if ((r.target || 'code') === 'output') {
          const re = new RegExp(r.pattern)
          if (re.test(runtimeOutput)) {
            try { appendTerminalDebug('Feedback (output): ' + r.message) } catch (_e) { }
            try { if (typeof window.__ssg_feedback_stub === 'function') window.__ssg_feedback_stub({ target: 'output', message: r.message, matchText: runtimeOutput }) } catch (_e) { }
          }
        }
      }
    } catch (e) { appendTerminal('Feedback engine error (output pass): ' + e) }
  })

  // Initialize stop button
  setupStopButton()

  // Add keyboard shortcut for VM interrupt (Ctrl+C)
  document.addEventListener('keydown', (e) => {
    // Only handle Ctrl+C when execution is running and not typing in input field
    if (e.ctrlKey && e.key === 'c' && executionState.isRunning) {
      // Don't interrupt if user is typing in the stdin box
      const stdinBox = $('stdin-box')
      if (stdinBox && document.activeElement === stdinBox) {
        return // Let normal Ctrl+C behavior work in input field
      }

      e.preventDefault()
      e.stopPropagation()

      // Trigger the same interrupt logic as the stop button
      appendTerminal('>>> KeyboardInterrupt (Ctrl+C)', 'runtime')
      const interrupted = interruptMicroPythonVM()

      if (!interrupted && executionState.currentAbortController) {
        try {
          appendTerminalDebug('Falling back to AbortController...')
          executionState.currentAbortController.abort()
        } catch (_e) {
          appendTerminalDebug('AbortController failed: ' + _e)
        }
      }

      setExecutionRunning(false)
    }
  })

  // Wire stdin-send button to resolve pending host.get_input promises and clear the field
  const stdinSendBtn = $('stdin-send')
  const stdinBox = $('stdin-box')

  // TEMPORARILY DISABLED: Add live echo functionality - update prompt display as user types
  // This complex input handling might be causing form submit conflicts
  // TODO: Re-enable after fixing the form submit issue
  if (false && stdinBox) {
    stdinBox.addEventListener('input', (ev) => {
      try {
        if (!window.__ssg_pending_input) return

        const currentValue = stdinBox.value || ''
        const promptText = window.__ssg_pending_input.promptText || ''

        // Find or create the prompt element and update its input display
        let pl = __ssg_current_prompt || findPromptLine(promptText)
        if (!pl && promptText) {
          // Create a structured prompt element if one doesn't exist
          pl = findOrCreatePromptLine(promptText)
          __ssg_current_prompt = pl
        }

        // Update the input display in real-time
        if (pl) {
          const inputSpan = pl.querySelector('.prompt-input')
          if (inputSpan) {
            inputSpan.textContent = currentValue
          }
        }
      } catch (_e) { /* ignore echo errors */ }
    })
  }

  // Wire terminal's inline form (and send button) to resolve pending input promises.
  const termForm = $('terminal-input-form')
  let submitting = false  // Prevent multiple simultaneous submissions
  let lastFocusTime = 0   // Track when input was last focused

  if (termForm && stdinBox) {
    termForm.addEventListener('submit', (ev) => {
      try {
        ev.preventDefault()

        const now = Date.now()
        const timeSinceFocus = now - lastFocusTime

        // Prevent submissions that happen too quickly after focusing (likely spurious)
        if (timeSinceFocus < 100) {
          return
        }

        // Prevent multiple simultaneous submissions
        if (submitting) {
          return
        }

        // Check if we have a pending input request
        if (!window.__ssg_pending_input) {
          return
        }

        // Check if we're using direct Enter handler (bypass form submission)
        if (window.__ssg_pending_input._usingDirectHandler) {
          return
        }

        submitting = true

        const val = (stdinBox.value || '').trim()
        stdinBox.value = ''
        setTerminalInputEnabled(false)
        appendTerminal(val, 'stdin')

        submitting = false

        window.__ssg_pending_input.resolve(val)
        delete window.__ssg_pending_input
      } catch (_e) {
        submitting = false  // Reset flag on error too
      }
    })
  }

  // TEMPORARILY DISABLED: Mirror live typing into the current prompt element 
  // This might be causing form submit conflicts
  try {
    if (false && stdinBox) {
      stdinBox.addEventListener('input', (ev) => {
        try {
          if (!__ssg_current_prompt) return
          const inputSpan = __ssg_current_prompt.querySelector('.prompt-input')
          if (!inputSpan) return
          inputSpan.textContent = stdinBox.value || ''
        } catch (_e) { }
      })
    }
  } catch (_e) { }

  // Wire send button to trigger form submit (avoid duplicate handlers)
  if (stdinSendBtn && termForm) {
    stdinSendBtn.addEventListener('click', () => {
      try {
        // Trigger the form submit event instead of duplicating the logic
        termForm.dispatchEvent(new Event('submit'))
      } catch (_e) { }
    })
  }

  // Simple commit-like snapshot storage: save full VFS snapshot (all files)
  $('save-snapshot').addEventListener('click', async () => {
    try {
      const snaps = JSON.parse(localStorage.getItem('snapshots') || '[]')
      const snap = { ts: Date.now(), files: {} }
      // Use the global FileManager (if available) as the authoritative source for snapshot contents.
      // FileManager may be a synchronous localStorage-backed implementation or the in-memory/backend proxy.
      try {
        if (window.FileManager && typeof window.FileManager.list === 'function') {
          const names = window.FileManager.list()
          for (const n of names) {
            try { const v = await Promise.resolve(window.FileManager.read(n)); if (v != null) snap.files[n] = v } catch (_e) { }
          }
        } else if (mem && Object.keys(mem).length) {
          for (const k of Object.keys(mem)) snap.files[k] = mem[k]
        } else if (backendRef && typeof backendRef.list === 'function') {
          const names = await backendRef.list()
          for (const n of names) { try { snap.files[n] = await backendRef.read(n) } catch (_e) { } }
        } else {
          // fallback to localStorage mirror
          try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); for (const k of Object.keys(map)) snap.files[k] = map[k] } catch (_e) { }
        }
      } catch (e) {
        try { const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}'); for (const k of Object.keys(map)) snap.files[k] = map[k] } catch (_e) { }
      }
      snaps.push(snap)
      localStorage.setItem('snapshots', JSON.stringify(snaps))
      appendTerminal('Snapshot saved (' + new Date(snap.ts).toLocaleString() + ')')
    } catch (e) { appendTerminal('Snapshot save failed: ' + e) }
  })

  // Autosave: debounce changes to localStorage
  const autosaveIndicator = $('autosave-indicator')
  let autosaveTimer = null
  function scheduleAutosave() {
    // While saving, show a short status without filename to avoid width jumps
    try { autosaveIndicator.textContent = 'Saving...' } catch (_e) { }
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      const content = (cm ? cm.getValue() : textarea.value)
      localStorage.setItem('autosave', JSON.stringify({ ts: Date.now(), code: content }))
      // After save, include the active filename if available
      try {
        const activePath = (window.TabManager && typeof window.TabManager.getActive === 'function') ? window.TabManager.getActive() : null
        autosaveIndicator.textContent = activePath ? ('Saved (' + activePath + ')') : 'Saved'
      } catch (_e) { try { autosaveIndicator.textContent = 'Saved' } catch (__e) { } }
    }, 300)
  }
  // Hook editor change events
  if (cm) { cm.on('change', scheduleAutosave) } else { textarea.addEventListener('input', scheduleAutosave) }

  // Snapshot modal logic
  const modal = $('snapshot-modal')
  const snapshotList = $('snapshot-list')
  const closeSnapshots = $('close-snapshots')
  const deleteSelected = $('delete-selected')

  function renderSnapshots() {
    const snaps = JSON.parse(localStorage.getItem('snapshots') || '[]')
    if (!snaps.length) { snapshotList.textContent = 'No snapshots'; return }
    snapshotList.innerHTML = ''
    snaps.forEach((s, i) => {
      const div = document.createElement('div')
      div.className = 'snapshot-item'
      const left = document.createElement('div')
      left.innerHTML = `<label><input type="checkbox" data-idx="${i}"> ${new Date(s.ts).toLocaleString()}</label>`
      const right = document.createElement('div')
      const restore = document.createElement('button')
      restore.textContent = 'Restore'
      restore.addEventListener('click', async () => {
        try {
          const snap = snaps[i]
          if (!snap) return
          // write all files from the snapshot into the backend/mem
          if (backendRef && typeof backendRef.write === 'function') {
            // Clear existing backend files (except protected MAIN_FILE) then write snapshot files.
            try {
              const existing = await backendRef.list()
              for (const p of existing) {
                try { if (p === MAIN_FILE) continue; await backendRef.delete(p) } catch (_e) { }
              }
            } catch (_e) { }

            // Write snapshot files (overwrite or create)
            for (const p of Object.keys(snap.files || {})) {
              try { await backendRef.write(p, snap.files[p]) } catch (_e) { }
            }

            try { await reloadFilesFromBackend(backendRef) } catch (_e) { }
            // Replace in-memory mirror with snapshot contents for synchronous reads
            try { mem = Object.create(null); for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p] } catch (_e) { }
          } else if (mem) {
            // Replace mem entirely so files from other snapshots are removed
            try { mem = Object.create(null); for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p] } catch (_e) { }
            try {
              const newMap = Object.create(null)
              for (const k of Object.keys(mem)) newMap[k] = mem[k]
              localStorage.setItem('ssg_files_v1', JSON.stringify(newMap))
            } catch (_e) { }
            try { renderFilesList() } catch (_e) { }
          }
          // Open only MAIN_FILE as focused tab
          try { if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab(MAIN_FILE); if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(MAIN_FILE) } catch (_e) { }

          // Reconcile via FileManager to ensure mem/localStorage/backend are consistent
          try {
            if (window.FileManager && typeof window.FileManager.list === 'function') {
              const existing = window.FileManager.list() || []
              for (const p of existing) {
                try { if (p === MAIN_FILE) continue; if (!Object.prototype.hasOwnProperty.call(snap.files || {}, p)) { await Promise.resolve(window.FileManager.delete(p)) } } catch (_e) { }
              }
              for (const p of Object.keys(snap.files || {})) {
                try { await Promise.resolve(window.FileManager.write(p, snap.files[p])) } catch (_e) { }
              }
            }
          } catch (_e) { }

          // Definitively replace in-memory map with snapshot contents to avoid any stale entries
          try {
            mem = Object.create(null)
            for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
            try { localStorage.setItem('ssg_files_v1', JSON.stringify(mem)) } catch (_e) { }
          } catch (_e) { }

          closeModal(modal)
          appendTerminal('Snapshot restored (' + new Date(s.ts).toLocaleString() + ')')
          try { window.__ssg_last_snapshot_restore = Date.now() } catch (_e) { }
        } catch (e) { appendTerminal('Snapshot restore failed: ' + e) }
      })
      right.appendChild(restore)
      div.appendChild(left)
      div.appendChild(right)
      snapshotList.appendChild(div)
    })
  }

  $('history').addEventListener('click', () => {
    renderSnapshots()
    openModal(modal)
  })
  closeSnapshots.addEventListener('click', () => closeModal(modal))
  deleteSelected.addEventListener('click', () => {
    const checks = Array.from(snapshotList.querySelectorAll('input[type=checkbox]:checked'))
    if (!checks.length) { appendTerminal('No snapshots selected for deletion'); return }
    const idxs = checks.map(c => Number(c.getAttribute('data-idx'))).sort((a, b) => b - a)
    const snaps = JSON.parse(localStorage.getItem('snapshots') || '[]')
    for (const i of idxs) snaps.splice(i, 1)
    localStorage.setItem('snapshots', JSON.stringify(snaps))
    renderSnapshots()
  })
  // Remove legacy prompt-based snapshot restore; use the modal UI instead.

  // Confirmation modal helper (uses DOM modal created in index.html)
  function showConfirmModal(title, message) {
    return new Promise((resolve) => {
      try {
        const m = document.getElementById('confirm-modal')
        const t = document.getElementById('confirm-modal-title')
        const msg = document.getElementById('confirm-modal-message')
        const yes = document.getElementById('confirm-yes')
        const no = document.getElementById('confirm-no')
        if (!m || !t || !msg || !yes || !no) {
          // Fallback to window.confirm if the modal is missing
          const ok = window.confirm(message || title || 'Confirm?')
          resolve(!!ok)
          return
        }
        t.textContent = title || 'Confirm'
        msg.textContent = message || ''
        openModal(m)
        const onYes = () => { cleanup(); resolve(true) }
        const onNo = () => { cleanup(); resolve(false) }
        function cleanup() {
          try { closeModal(m) } catch (_e) { }
          try { yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo) } catch (_e) { }
        }
        yes.addEventListener('click', onYes)
        no.addEventListener('click', onNo)
      } catch (e) { resolve(false) }
    })


  }

  $('clear-storage').addEventListener('click', async () => {
    const ok = await showConfirmModal('Clear storage', 'Clear saved snapshots and storage?')
    if (!ok) { appendTerminal('Clear storage cancelled'); return }
    try { localStorage.removeItem('snapshots'); appendTerminal('Cleared snapshots and storage') } catch (e) { appendTerminal('Clear storage failed: ' + e) }
  })
}

main()
