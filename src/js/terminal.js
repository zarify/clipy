// Terminal output and UI management
import { $ } from './config.js'

// Debug-only logger: controlled by `window.__ssg_debug_logs` (default: false)
try { window.__ssg_debug_logs = window.__ssg_debug_logs || false } catch (_e) { }

export function appendTerminalDebug(text) { 
  try { 
    if (window.__ssg_debug_logs) appendTerminal(text) 
  } catch (_e) { } 
}

// Append structured terminal lines. `kind` is one of: stdout, stderr, stdin, runtime
export function appendTerminal(text, kind = 'stdout') {
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
    try { out.scrollTop = out.scrollHeight } catch (_e) { }
  } catch (e) {
    console.error('appendTerminal error:', e)
  }
}

export function findPromptLine(promptText) {
  const out = $('terminal-output')
  if (!out) return null
  
  const lines = out.querySelectorAll('.terminal-line')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.textContent.includes(promptText || '>>> ')) {
      return line
    }
  }
  return null
}

export function findOrCreatePromptLine(promptText) {
  const existing = findPromptLine(promptText)
  if (existing) return existing
  
  // Create new prompt line
  appendTerminal(promptText || '>>> ', 'stdin')
  return findPromptLine(promptText)
}

export function setTerminalInputEnabled(enabled, promptText) {
  const inpt = $('stdin-box')
  if (!inpt) return
  
  if (enabled) {
    inpt.disabled = false
    inpt.style.display = 'block'
    inpt.placeholder = promptText || 'Enter input...'
    try { inpt.focus() } catch (_e) { }
  } else {
    inpt.disabled = true
    inpt.style.display = 'none'
    inpt.placeholder = inpt.getAttribute('data-default-placeholder') || ''
  }
}

// Initialize default placeholder
export function initializeTerminal() {
  try { 
    const p = $('stdin-box'); 
    if (p && !p.getAttribute('data-default-placeholder')) {
      p.setAttribute('data-default-placeholder', p.placeholder || '') 
    }
  } catch (_e) { }
}
