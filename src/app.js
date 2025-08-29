// Main application orchestrator - lightweight modular structure
// This replaces the monolithic main.js with organized, maintainable modules

// Core utilities and configuration
import { loadConfig, initializeInstructions, getConfig, getConfigIdentity, getConfigKey, validateAndNormalizeConfig } from './js/config.js'
import { $ } from './js/utils.js'

// Terminal and UI
import { initializeTerminal, setupSideTabs, setupClearTerminalButton } from './js/terminal.js'
import { initializeEditor } from './js/editor.js'
import { initializeAutosave } from './js/autosave.js'

// File and tab management  
import { initializeVFS, MAIN_FILE } from './js/vfs-client.js'
import { initializeTabManager } from './js/tabs.js'

// Runtime and execution
import {
    loadMicroPythonRuntime,
    setupMicroPythonAPI,
    setupStopButton,
    setupKeyboardInterrupt
} from './js/micropython.js'
import { runPythonCode } from './js/execution.js'
import { runTests } from './js/test-runner.js'
import { setupInputHandling } from './js/input-handling.js'

// Code transformation 
import { transformAndWrap, highlightMappedTracebackInEditor, highlightFeedbackLine, clearAllErrorHighlights, clearAllFeedbackHighlights } from './js/code-transform.js'

// Additional features
import { setupSnapshotSystem } from './js/snapshots.js'
import { showStorageInfo } from './js/storage-manager.js'
import { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on as feedbackOn, off as feedbackOff } from './js/feedback.js'
import { initializeFeedbackUI, setFeedbackMatches, setFeedbackConfig } from './js/feedback-ui.js'

// Expose global functions for tests and debugging
try {
    window.__ssg_transform = transformAndWrap
    // Expose Config object for tests
    window.Config = {
        current: null,
        getConfigIdentity,
        getConfigKey,
        validateAndNormalizeConfig
    }
    // Expose storage info for debugging
    window.showStorageInfo = showStorageInfo
    // Expose highlight helpers for tests/debugging
    try { window.highlightMappedTracebackInEditor = highlightMappedTracebackInEditor } catch (_e) { }
    try { window.highlightFeedbackLine = highlightFeedbackLine } catch (_e) { }
} catch (_e) { }

// Startup debug helper - enable by setting `window.__ssg_debug_startup = true`
try {
    if (typeof window !== 'undefined') {
        window.__ssg_debug_startup = window.__ssg_debug_startup || false
    }
} catch (_e) { }

function dbg(...args) {
    try {
        if (typeof window !== 'undefined' && window.__ssg_debug_startup) console.log(...args)
    } catch (_e) { }
}

// Main initialization function
async function main() {
    try {
        console.log('🚀 Initializing Clipy application...')
        // Suppress automatic terminal auto-switching during startup
        try { if (typeof window !== 'undefined') window.__ssg_suppress_terminal_autoswitch = true } catch (_e) { }

        // 1. Load configuration
        const cfg = await loadConfig()
        initializeInstructions(cfg)

        // Expose current config globally for tests
        try { window.Config.current = cfg } catch (_e) { }

        // DEBUG: trace progress
        try { dbg('dbg: after loadConfig') } catch (_e) { }

        // 2. Initialize core UI components
        initializeTerminal()
        setupSideTabs()
        setupClearTerminalButton()

        // 3. Initialize editor
        const cm = initializeEditor()
        try { dbg('dbg: after initializeEditor', !!cm) } catch (_e) { }
        const textarea = $('code')

        // 4. Initialize file system and tabs
        const { FileManager } = await initializeVFS(cfg)
        try { dbg('dbg: after initializeVFS', !!FileManager) } catch (_e) { }
        const TabManager = initializeTabManager(cm, textarea)

        try { dbg('dbg: after initializeTabManager', !!TabManager) } catch (_e) { }

        // Expose TabManager globally for compatibility
        try { window.TabManager = TabManager } catch (e) { }

        // Prefer sandboxed iframe-based tests by default for better isolation.
        try { if (typeof window !== 'undefined' && typeof window.__ssg_use_sandboxed_tests === 'undefined') window.__ssg_use_sandboxed_tests = true } catch (_e) { }

        // Expose feedback highlight clear helper for tests and debugging
        try {
            if (typeof window.clearAllFeedbackHighlights !== 'function') {
                window.clearAllFeedbackHighlights = function () {
                    try { if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights() } catch (_e) { }
                }
            }
            if (typeof window.clearAllErrorHighlights !== 'function') {
                window.clearAllErrorHighlights = function () {
                    try { if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights() } catch (_e) { }
                }
            }
        } catch (_e) { }

        // Restore from the special 'current' snapshot if it exists
        try {
            const { restoreCurrentSnapshotIfExists } = await import('./js/snapshots.js')
            try { dbg('dbg: after import snapshots') } catch (_e) { }
            const _restored = await restoreCurrentSnapshotIfExists()
            try { dbg('dbg: after restoreCurrentSnapshotIfExists', _restored) } catch (_e) { }
        } catch (_e) { /* ignore snapshot restore failures at startup */ }

        // 5. Initialize autosave
        initializeAutosave()

        // 6. Load MicroPython runtime
        const runtimeAdapter = await loadMicroPythonRuntime(cfg)
        try { dbg('dbg: after loadMicroPythonRuntime', !!runtimeAdapter) } catch (_e) { }

        // Expose runtimeAdapter globally for tests
        try { window.runtimeAdapter = runtimeAdapter } catch (e) { }

        // Expose minimal Feedback API for tests and wire UI
        try { window.Feedback = { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on: feedbackOn, off: feedbackOff } } catch (_e) { }
        try {
            initializeFeedbackUI();
            feedbackOn('matches', (m) => { try { setFeedbackMatches(m) } catch (_e) { } })
            // Update UI config when Feedback subsystem is reset at runtime
            feedbackOn('reset', (payload) => { try { setFeedbackConfig(payload && payload.config ? payload.config : payload) } catch (_e) { } })
        } catch (_e) { }

        // Provide the feedback config to the UI so it can render visibleByDefault titles
        try { setFeedbackConfig(cfg) } catch (_e) { }

        // Now initialize Feedback subsystem with the config so it can evaluate and emit matches
        try {
            if (window.Feedback && typeof window.Feedback.resetFeedback === 'function') window.Feedback.resetFeedback(cfg)
            // Re-apply full configuration to the UI after Feedback.resetFeedback
            // because resetFeedback emits a 'reset' event with a normalized feedback-only
            // payload which would otherwise overwrite the UI's full config (including tests).
            try { setFeedbackConfig(cfg) } catch (_e) { }
        } catch (_e) { }

        // Initial feedback evaluation for starter content
        try {
            const content = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
            const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
            try { if (window.Feedback && window.Feedback.evaluateFeedbackOnEdit) window.Feedback.evaluateFeedbackOnEdit(content, path) } catch (_e) { }
        } catch (_e) { }

        // Wire feedback UI clicks to open/select files and apply highlights.
        // The UI dispatches `ssg:feedback-click` events with the entry payload
        // and an optional `match` object. Use the existing helpers to open the
        // tab and highlight the mapped line when possible.
        try {
            window.addEventListener('ssg:feedback-click', (ev) => {
                try {
                    const payload = ev && ev.detail ? ev.detail : null
                    if (!payload) return
                    const match = payload.match || null
                    // Prefer payload.match.file if present (edit-time matcher)
                    if (match && match.file) {
                        try { highlightFeedbackLine(match.file, match.line || 1) } catch (_e) { }
                        return
                    }
                    // Fall back to entry-level file/line fields
                    if (payload.file && typeof payload.line === 'number') {
                        try { highlightFeedbackLine(payload.file, payload.line) } catch (_e) { }
                        return
                    }
                    // If the entry specified an explicit action (e.g. open-file), perform it
                    if (payload.action && payload.action.type === 'open-file' && payload.action.path) {
                        try {
                            const p = payload.action.path
                            if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab(p)
                            if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(p)
                        } catch (_e) { }
                    }
                } catch (_e) { }
            })
        } catch (_e) { }

        // Listen for Run tests button and execute author-defined tests if present
        try {
            window.addEventListener('ssg:run-tests-click', async () => {
                try { console.debug && console.debug('[app] received ssg:run-tests-click') } catch (_e) { }
                try {
                    const cfg = window.Config && window.Config.current ? window.Config.current : null
                    try { console.debug && console.debug('[app] current config', !!cfg, cfg && Array.isArray(cfg.tests) ? cfg.tests.length : 0) } catch (_e) { }
                    const tests = (cfg && Array.isArray(cfg.tests)) ? cfg.tests : []
                    if (!tests || !tests.length) {
                        try { appendTerminal('No tests defined in config', 'runtime') } catch (_e) { }
                        return
                    }

                    // Define runFn that will either use the sandboxed iframe runner (preferred)
                    // or fall back to the adapter factory. This is feature-flagged by
                    // window.__ssg_use_sandboxed_tests.
                    try {
                        const vfs = await import('./js/vfs-client.js')
                        const getFileManager = vfs.getFileManager
                        const MAIN_FILE = vfs.MAIN_FILE

                        let runFn = null
                        if (window.__ssg_use_sandboxed_tests) {
                            // Use sandboxed iframe runner (Phase 1)
                            try {
                                const sandbox = await import('./js/test-runner-sandbox.js')
                                const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                                const mainContent = FileManager ? (FileManager.read(MAIN_FILE) || '') : ''
                                runFn = sandbox.createSandboxedRunFn({ runtimeUrl: (cfg && cfg.runtime && cfg.runtime.url) || '/vendor/micropython.mjs', filesSnapshot: { [MAIN_FILE]: mainContent } })
                            } catch (e) {
                                appendTerminal('Failed to initialize sandboxed runner: ' + e, 'runtime')
                                // fall through to adapter
                            }
                        }

                        if (!runFn) {
                            const adapterMod = await import('./js/test-runner-adapter.js')
                            const createRunFn = adapterMod && adapterMod.createRunFn ? adapterMod.createRunFn : adapterMod.default && adapterMod.default.createRunFn
                            runFn = createRunFn({ getFileManager, MAIN_FILE, runPythonCode, getConfig: () => (window.Config && window.Config.current) ? window.Config.current : {} })
                        }

                        // Run tests using the created runFn
                        const results = await runTests(tests, { runFn })
                        try { appendTerminal('Test run complete. ' + results.length + ' tests executed.', 'runtime') } catch (_e) { }

                        // Update UI with results and feed failures into Feedback
                        try {
                            if (typeof window.__ssg_set_test_results === 'function') {
                                try { console.debug && console.debug('[app] publishing test results', results && results.length) } catch (_e) { }
                                window.__ssg_set_test_results(results)
                                try { console.debug && console.debug('[app] published test results') } catch (_e) { }
                            }
                        } catch (_e) { }
                        if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                            for (const r of results) {
                                if (!r.passed) {
                                    try { window.Feedback.evaluateFeedbackOnRun({ stdout: r.stdout || '', stderr: r.stderr || '' }) } catch (_e) { }
                                }
                            }
                        }
                        return
                    } catch (_e) {
                        try { appendTerminal('Test run failed to start: ' + _e, 'runtime') } catch (_err) { }
                        return
                    }
                    // Run tests and publish results
                    const results = await runTests(tests, { runFn })
                    try {
                        appendTerminal('Test run complete. ' + results.length + ' tests executed.', 'runtime')
                    } catch (_e) { }

                    // Push results into Feedback as runMatches (create simple feedback entries per failing test)
                    try {
                        // Update Feedback UI test results if setter is available
                        try { if (typeof window.__ssg_set_test_results === 'function') window.__ssg_set_test_results(results) } catch (_e) { }
                        if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                            for (const r of results) {
                                if (!r.passed) {
                                    // Emit a feedback run evaluation with the stderr/stdout so configured patterns may match
                                    try { window.Feedback.evaluateFeedbackOnRun({ stdout: r.stdout || '', stderr: r.stderr || '' }) } catch (_e) { }
                                }
                            }
                        }
                    } catch (_e) { }
                } catch (_err) { }
            })
        } catch (_e) { }

        // 7. Setup runtime APIs and controls
        setupMicroPythonAPI()
        setupStopButton()
        setupKeyboardInterrupt()

        // 8. Setup input handling
        setupInputHandling()

        // 9. Setup snapshot system
        setupSnapshotSystem()

        // 10. Wire up the Run button
        const runBtn = $('run')
        if (runBtn) {
            runBtn.addEventListener('click', async () => {
                // Save current active tab's content before running
                try {
                    const activePath = TabManager.getActive()
                    if (activePath) {
                        const current = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                        await FileManager.write(activePath, current)
                    }

                    // Only persist MAIN_FILE from the editor if the active tab is MAIN_FILE
                    // or if MAIN_FILE does not yet exist in the FileManager. This prevents
                    // accidentally overwriting /main.py with the contents of another open tab
                    // (e.g. when a traceback caused the editor to open a different file).
                    try {
                        const mainExists = !!FileManager.read(MAIN_FILE)
                        if (activePath === MAIN_FILE || !mainExists) {
                            const currentMain = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                            await FileManager.write(MAIN_FILE, currentMain)
                        }
                    } catch (_e) {
                        // best-effort: if FileManager.read/write fail, avoid overwriting main
                    }
                } catch (_) { /* ignore write errors */ }

                // Get the main file content and run it
                const code = FileManager.read(MAIN_FILE) || ''
                await runPythonCode(code, cfg)
            })
        }

        console.log('✅ Clipy application initialized successfully')
        // Clear startup suppression so user actions can switch to terminal normally
        try { if (typeof window !== 'undefined') window.__ssg_suppress_terminal_autoswitch = false } catch (_e) { }

    } catch (error) {
        console.error('❌ Failed to initialize Clipy application:', error)

        // Show error to user
        const instructionsContent = $('instructions-content')
        if (instructionsContent) {
            instructionsContent.textContent = `Failed to initialize application: ${error.message || error}`
        }
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
