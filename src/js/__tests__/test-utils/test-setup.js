// Shared test setup helpers for execution tests
export function ensureWindow() {
    global.window = global.window || {}
}

export function setupTerminalDOM(content = '') {
    ensureWindow()
    document.body.innerHTML = `<div id="terminal-output">${content}</div>`
    return document.getElementById('terminal-output')
}

export function setupCodeArea(code = '') {
    ensureWindow()
    document.body.innerHTML = `<textarea id="code">${code}</textarea><div id="terminal-output"></div>`
    return { codeEl: document.getElementById('code'), out: document.getElementById('terminal-output') }
}

export function clearLocalStorageMirror() {
    try { if (typeof window !== 'undefined') { try { delete window.__ssg_unified_inmemory } catch (_e) { } } } catch (_e) { }
}

export async function setRuntimeAdapter(adapter) {
    const mp = await import('../../micropython.js')
    if (typeof mp.setRuntimeAdapter === 'function') mp.setRuntimeAdapter(adapter)
    try {
        const gs = mp.getExecutionState()
        // Ensure tests don't start with a stale 'isRunning' flag or leftover
        // abort controller/timeouts from previous tests.
        if (gs) {
            gs.isRunning = false
            gs.currentAbortController = null
            try { if (gs.timeoutId) clearTimeout(gs.timeoutId) } catch (_e) { }
            try { if (gs.safetyTimeoutId) clearTimeout(gs.safetyTimeoutId) } catch (_e) { }
            gs.timeoutId = null
            gs.safetyTimeoutId = null
        }
    } catch (_e) { }
}

export function setFileManager(fm) {
    ensureWindow()
    window.FileManager = fm
}

export function setMAIN_FILE(path) {
    ensureWindow()
    window.MAIN_FILE = path
}

export function ensureAppendTerminalDebug() {
    // noop: appendTerminal is provided by jest.setup.js
}
