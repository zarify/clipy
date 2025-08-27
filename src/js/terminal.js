// Clear all terminal output
export function clearTerminal() {
    try {
        const out = $('terminal-output')
        if (out) {
            out.innerHTML = ''
        }
    } catch (_e) { }
}
// Setup clear terminal button event listener
export function setupClearTerminalButton() {
    try {
        const btn = $('clear-terminal')
        if (btn) {
            btn.addEventListener('click', clearTerminal)
        }
    } catch (_e) { }
}
// Terminal output and UI management
import { $ } from './utils.js'

// Debug-only logger: controlled by `window.__ssg_debug_logs` (default: false)
try { window.__ssg_debug_logs = window.__ssg_debug_logs || false } catch (_e) { }

// Ensure the global suppression flag exists as early as possible so that any
// code which runs before app initialization cannot cause the terminal to
// auto-switch or focus. The main initializer will explicitly clear this flag
// when startup completes.
try {
    if (typeof window !== 'undefined' && typeof window.__ssg_suppress_terminal_autoswitch === 'undefined') {
        window.__ssg_suppress_terminal_autoswitch = true
    }
} catch (_e) { }

// Prevent early focus on terminal elements while startup suppression is active.
// This uses a capture-phase focusin listener so it can intercept programmatic
// focus() calls from other modules before they take effect.
try {
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        document.addEventListener('focusin', (ev) => {
            try {
                const suppressed = Boolean(window.__ssg_suppress_terminal_autoswitch)
                if (!suppressed) return
                const tgt = ev.target
                if (!tgt || !tgt.id) return
                if (tgt.id === 'terminal-output' || tgt.id === 'stdin-box') {
                    try { tgt.blur && tgt.blur() } catch (_e) { }
                    // Move focus to a safe element (body) to avoid focus landing on terminal
                    try { document.body && document.body.focus && document.body.focus() } catch (_e) { }
                    ev.stopImmediatePropagation()
                    ev.preventDefault()
                }
            } catch (_e) { }
        }, true)
    }
} catch (_e) { }

// If the browser restores focus on reload, it can land on terminal elements
// before our capture handler runs. Proactively blur those elements when
// suppression is active. Run immediately and also schedule short delayed
// attempts to catch restoration timing across browsers.
try {
    const defocusIfSuppressed = () => {
        try {
            const suppressed = Boolean(window.__ssg_suppress_terminal_autoswitch)
            if (!suppressed) return
            const active = document.activeElement
            if (!active) return
            const id = active.id
            if (id === 'terminal-output' || id === 'stdin-box') {
                try { active.blur && active.blur() } catch (_e) { }
                try { document.body && document.body.focus && document.body.focus() } catch (_e) { }
            }
        } catch (_e) { }
    }

    // Run immediately
    try { defocusIfSuppressed() } catch (_e) { }
    // Run after microtask and a short delay to catch browser restoration timing
    try { setTimeout(defocusIfSuppressed, 0) } catch (_e) { }
    try { setTimeout(defocusIfSuppressed, 100) } catch (_e) { }
} catch (_e) { }

export function appendTerminalDebug(text) {
    try {
        if (window.__ssg_debug_logs) appendTerminal(text)
    } catch (_e) { }
}

// Append structured terminal lines. `kind` is one of: stdout, stderr, stdin, runtime
export function appendTerminal(text, kind = 'stdout') {
    try {
        // Only auto-switch to terminal if not a runtime init message
        const shouldSwitch = !(kind === 'runtime' && typeof text === 'string' && text.includes('MicroPython runtime initialized'))
        if (shouldSwitch) {
            // Respect global suppression used during app initialization to
            // avoid making the terminal visible or stealing focus while the
            // app is still booting or performing controlled restores.
            let suppressed = false
            try { suppressed = Boolean(window.__ssg_suppress_terminal_autoswitch) } catch (_e) { }
            if (!suppressed) {
                // Only switch if not already on terminal
                const termPanel = document.getElementById('terminal')
                if (termPanel && termPanel.style.display !== 'block') {
                    if (typeof window.activateSideTab === 'function') {
                        window.activateSideTab('terminal')
                    } else if (typeof activateSideTab === 'function') {
                        activateSideTab('terminal')
                    }
                }
            }
        }
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
        try { console.log(text) } catch (_e) { }
    }
}

// Track an active prompt line element when host.get_input is awaiting input
let __ssg_current_prompt = null

// Find and convert an existing printed prompt (single- or multi-line) into a structured prompt element.
export function findPromptLine(promptText) {
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

export function findOrCreatePromptLine(promptText) {
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
export function setTerminalInputEnabled(enabled, promptText) {
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

// Initialize default placeholder
export function initializeTerminal() {
    try {
        const p = $('stdin-box')
        if (p && !p.getAttribute('data-default-placeholder')) {
            p.setAttribute('data-default-placeholder', p.placeholder || '')
        }
    } catch (_e) { }

    // Start with terminal input disabled until a runtime requests it
    try { setTerminalInputEnabled(false) } catch (_e) { }
}

// Side tab helpers: toggle between instructions and terminal
export function activateSideTab(name) {
    try {
        const instrBtn = $('tab-btn-instructions')
        const termBtn = $('tab-btn-terminal')
        const instrPanel = $('instructions')
        const termPanel = $('terminal')

        if (!instrBtn || !termBtn || !instrPanel || !termPanel) return

        if (name === 'terminal') {
            instrBtn.setAttribute('aria-selected', 'false')
            termBtn.setAttribute('aria-selected', 'true')
            instrPanel.style.display = 'none'
            termPanel.style.display = 'block'
            // Respect global suppression used during app initialization to
            // avoid stealing focus while the app is still booting.
            try {
                if (!window.__ssg_suppress_terminal_autoswitch) {
                    termPanel.querySelector('#terminal-output')?.focus()
                }
            } catch (_e) { }
        } else {
            instrBtn.setAttribute('aria-selected', 'true')
            termBtn.setAttribute('aria-selected', 'false')
            instrPanel.style.display = 'block'
            termPanel.style.display = 'none'
        }
    } catch (_e) { }
}

export function setupSideTabs() {
    try {
        const instrBtn = $('tab-btn-instructions')
        const termBtn = $('tab-btn-terminal')
        if (instrBtn) instrBtn.addEventListener('click', () => activateSideTab('instructions'))
        if (termBtn) termBtn.addEventListener('click', () => activateSideTab('terminal'))

        // Default to instructions tab (original behavior)
        activateSideTab('instructions')
    } catch (_e) { }
}
