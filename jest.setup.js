// Minimal global stubs for jsdom tests
// This file is executed before each test file (via jest.config.cjs)

// Provide a basic localStorage shim if jsdom doesn't provide it
if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map()
    globalThis.localStorage = {
        getItem: (k) => { const v = _store.get(k); return v === undefined ? null : v },
        setItem: (k, v) => { _store.set(k, String(v)); return true },
        removeItem: (k) => { _store.delete(k) },
        clear: () => { _store.clear() }
    }
}

// Basic no-op console wrappers used by some modules
if (typeof globalThis.console === 'undefined') {
    globalThis.console = { log: () => { }, warn: () => { }, error: () => { }, info: () => { }, debug: () => { } }
}

// Ensure a minimal window.Config object exists
try { globalThis.window = globalThis.window || globalThis } catch (e) { globalThis.window = globalThis }
window.Config = window.Config || {}

// Provide simple placeholders used by vfs-client
window.__ssg_expected_writes = window.__ssg_expected_writes || new Map()
window.__ssg_pending_tabs = window.__ssg_pending_tabs || []
// Do NOT provide the legacy in-memory mirror here. Tests should use a
// `FileManager` test-shim (via `createFileManager(host)`) or mock the
// runtime fs when synchronous access is required. Intentionally omitting
// a global `window.__ssg_mem` helps tests fail early if they accidentally
// depend on the legacy mirror while we migrate to the unified storage
// model.
// Note: window.__ssg_mem is intentionally not initialized in tests.
window.__ssg_suppress_notifier = false

// Minimal safeSetItem used by storage-manager expectations (if imported)
globalThis.safeSetItem = function (k, v) { try { localStorage.setItem(k, v); return { success: true } } catch (e) { return { success: false, error: String(e) } } }

// Make fetch available via node-fetch polyfill if not present
if (typeof globalThis.fetch === 'undefined') {
    // Use a lightweight polyfill relying on node's fetch when available
    try {
        // Node 18+ has global fetch
        if (typeof globalThis.process !== 'undefined') {
            // noop - assume environment provides fetch via node
        }
    } catch (e) { }
}

// Polyfill TextEncoder/TextDecoder for environments where they're missing (jsdom/whatwg-url)
if (typeof globalThis.TextEncoder === 'undefined') {
    if (typeof Buffer !== 'undefined') {
        globalThis.TextEncoder = class TextEncoder { encode(s) { return Buffer.from(String(s), 'utf8') } }
    } else {
        globalThis.TextEncoder = class TextEncoder { encode(s) { return new Uint8Array(Array.from(String(s)).map(c => c.charCodeAt(0))) } }
    }
}
if (typeof globalThis.TextDecoder === 'undefined') {
    if (typeof Buffer !== 'undefined') {
        globalThis.TextDecoder = class TextDecoder { decode(b) { return Buffer.from(b).toString('utf8') } }
    } else {
        globalThis.TextDecoder = class TextDecoder { decode(b) { return Array.from(b).map(x => String.fromCharCode(x)).join('') } }
    }
}

// Provide a noop appendTerminal and appendTerminalDebug for tests that import UI modules
globalThis.appendTerminalDebug = globalThis.appendTerminalDebug || (() => { })
globalThis.appendTerminal = globalThis.appendTerminal || ((content, type) => {
    try {
        // Keep a lightweight event log for tests that inspect terminal output
        window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []
        window.__ssg_terminal_event_log.push({ when: Date.now(), action: type || 'stdout', text: String(content).slice(0, 200) })
    } catch (_e) { }
})
