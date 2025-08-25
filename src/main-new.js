// Main application entry point - refactored for modularity
import { loadConfig, $ } from './js/config.js'
import { appendTerminal, initializeTerminal, setTerminalInputEnabled } from './js/terminal.js'
import { setupMicroPythonAPI, setRuntimeAdapter, interruptMicroPythonVM } from './js/micropython.js'
import { runPythonCode } from './js/execution.js'

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

  // Initialize terminal
  initializeTerminal()

  // Setup MicroPython API functions
  setupMicroPythonAPI()

  // Load and initialize MicroPython runtime
  try {
    const { default: runtimeAdapter } = await import('./vendor/api.js')
    setRuntimeAdapter(runtimeAdapter)
    
    if (runtimeAdapter.hasYieldingSupport) {
      appendTerminal('MicroPython runtime initialized (v3.0.0 with yielding support)', 'runtime')
    } else {
      appendTerminal('MicroPython runtime initialized (legacy)', 'runtime')
    }
  } catch (error) {
    appendTerminal('Failed to load MicroPython runtime: ' + error, 'runtime')
  }

  // Setup event handlers
  setupEventHandlers(cm, cfg)
}

function setupEventHandlers(cm, cfg) {
  // Run button
  const runBtn = $('run')
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const code = cm ? cm.getValue() : $('code').value
      await runPythonCode(code, cfg)
    })
  }

  // Stop button
  const stopBtn = $('stop')
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      appendTerminal('>>> Execution cancelled by user', 'runtime')
      interruptMicroPythonVM()
    })
  }

  // Clear storage button (this clears saved data, not terminal)
  const clearStorageBtn = $('clear-storage')
  if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', async () => {
      const ok = await showConfirmModal('Clear storage', 'Clear saved snapshots and storage?')
      if (ok) {
        // Clear storage logic would go here
        appendTerminal('Storage cleared', 'runtime')
      }
    })
  }

  // Input handling
  const stdinBox = $('stdin-box')
  if (stdinBox) {
    stdinBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const inputValue = stdinBox.value
        appendTerminal(inputValue, 'stdin')
        
        // Resolve pending input if waiting
        if (window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function') {
          window.__ssg_pending_input.resolve(inputValue)
          delete window.__ssg_pending_input
        }
        
        stdinBox.value = ''
        setTerminalInputEnabled(false)
      }
    })
  }

  // Tab switching for side panel
  const tabBtns = document.querySelectorAll('.side-tab-btn')
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target')
      activateSideTab(target)
    })
  })
}

// Helper function for tab switching
function activateSideTab(name) {
  const tabs = document.querySelectorAll('.side-tab-btn')
  const contents = document.querySelectorAll('.panel-child')
  
  tabs.forEach(tab => {
    tab.setAttribute('aria-selected', tab.getAttribute('data-target') === name ? 'true' : 'false')
  })
  
  contents.forEach(content => {
    content.style.display = content.id === name ? 'block' : 'none'
  })
}

// Simple modal confirmation (placeholder - would need full implementation)
async function showConfirmModal(title, message) {
  return window.confirm(`${title}\n\n${message}`)
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main)
} else {
  main()
}
