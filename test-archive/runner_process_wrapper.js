// Wrapper to load the runner.js in a JSDOM-like environment and provide
// a way to post messages to its window. This allows testing the iframe
// runner logic without a real browser.
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function makeWindow() {
    const wnd = {}
    wnd.console = console
    wnd.location = { origin: 'http://localhost:8000' }
    wnd.parent = { postMessage: (o) => { /* stubbed by host */ } }
    // default store for messages sent to parent so tests can inspect early posts
    wnd.__posted = []
    wnd.parent.postMessage = (o) => { try { wnd.__posted.push(o) } catch (_e) { } }
    wnd.postMessage = (o, _origin) => { /* noop for runner when sending to parent */ }
    // simple event listeners store so addEventListener works for 'message'
    wnd.__listeners = { message: [] }
    wnd.addEventListener = function (type, fn) {
        if (!this.__listeners[type]) this.__listeners[type] = []
        this.__listeners[type].push(fn)
    }
    wnd.removeEventListener = function (type, fn) {
        if (!this.__listeners[type]) return
        const i = this.__listeners[type].indexOf(fn)
        if (i !== -1) this.__listeners[type].splice(i, 1)
    }
    // expose onmessage for direct handler compatibility
    wnd.onmessage = null
    return wnd
}

// Load and run the runner.js content in a VM context with a fake window
async function loadRunner() {
    const runnerPath = path.join(__dirname, '..', 'src', 'tests', 'runner.js')
    const code = fs.readFileSync(runnerPath, 'utf8')
    const wnd = makeWindow()
    const context = vm.createContext(Object.assign({ window: wnd, globalThis: wnd, console, TextDecoder }, wnd))

    // Provide timers in the VM context
    context.setTimeout = setTimeout
    context.clearTimeout = clearTimeout
    context.setInterval = setInterval
    context.clearInterval = clearInterval

    // Import the fake loader into the host and expose it as globalThis.loadMicroPython
    try {
        const fake = await import(path.join(__dirname, 'fake_micropython.mjs'))
        if (fake && typeof fake.loadMicroPython === 'function') {
            try { context.globalThis.loadMicroPython = fake.loadMicroPython } catch (_e) { }
        }
    } catch (e) {
        // ignore; runner will fallback if import not present
        console.debug('Failed to import fake loader for VM:', e)
    }

    // Run the script in the VM
    vm.runInContext(code, context)
    return { window: wnd, context }
}

module.exports = { loadRunner }
