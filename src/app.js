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
import { initializeVFS, MAIN_FILE } from './js/vfs.js'
import { initializeTabManager } from './js/tabs.js'

// Runtime and execution
import {
    loadMicroPythonRuntime,
    setupMicroPythonAPI,
    setupStopButton,
    setupKeyboardInterrupt
} from './js/micropython.js'
import { runPythonCode } from './js/execution.js'
import { setupInputHandling } from './js/input-handling.js'

// Code transformation 
import { transformAndWrap } from './js/code-transform.js'

// Additional features
import { setupSnapshotSystem } from './js/snapshots.js'
import { showStorageInfo } from './js/storage-manager.js'

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
} catch (_e) { }

// Main initialization function
async function main() {
    try {
        console.log('🚀 Initializing Clipy application...')

        // 1. Load configuration
        const cfg = await loadConfig()
        initializeInstructions(cfg)

        // Expose current config globally for tests
        try { window.Config.current = cfg } catch (_e) { }

        // 2. Initialize core UI components
        initializeTerminal()
        setupSideTabs()
        setupClearTerminalButton()

        // 3. Initialize editor
        const cm = initializeEditor()
        const textarea = $('code')

        // 4. Initialize file system and tabs
        const { FileManager } = await initializeVFS(cfg)
        const TabManager = initializeTabManager(cm, textarea)

        // Expose TabManager globally for compatibility
        try { window.TabManager = TabManager } catch (e) { }

        // 5. Initialize autosave
        initializeAutosave()

        // 6. Load MicroPython runtime
        const runtimeAdapter = await loadMicroPythonRuntime(cfg)

        // Expose runtimeAdapter globally for tests
        try { window.runtimeAdapter = runtimeAdapter } catch (e) { }

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

                    // Always persist the MAIN_FILE with current editor contents
                    const currentMain = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                    await FileManager.write(MAIN_FILE, currentMain)
                } catch (_) { /* ignore write errors */ }

                // Get the main file content and run it
                const code = FileManager.read(MAIN_FILE) || ''
                await runPythonCode(code, cfg)
            })
        }

        console.log('✅ Clipy application initialized successfully')

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
