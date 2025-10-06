// Utilities to reset record/replay state when switching configs/problems
import { getReplayEngine, getReplayUI } from './replay-ui.js'
import { getExecutionRecorder } from './execution-recorder.js'
import { appendTerminalDebug } from './terminal.js'

export function resetRecordReplayState() {
    try {
        const engine = (typeof getReplayEngine === 'function') ? getReplayEngine() : null
        const ui = (typeof getReplayUI === 'function') ? getReplayUI() : null
        const recorder = (typeof getExecutionRecorder === 'function') ? getExecutionRecorder() : null

        appendTerminalDebug('🔄 resetRecordReplayState() called')

        // Stop any active replay and clear engine traces/caches
        try {
            if (engine && engine.isReplaying && typeof engine.stopReplay === 'function') {
                engine.stopReplay()
            }
        } catch (e) { appendTerminalDebug('Failed to stop replay: ' + e) }

        try {
            if (engine) {
                engine.executionTrace = null
                try { engine.originalTrace = null } catch (_) { /* setter may be read-only in tests */ }
                engine.lineReferenceMap = null
                engine.functionLocalMaps = null
                engine.lineFunctionMap = null
                if (engine.lineDecorator && typeof engine.lineDecorator.clearAllDecorations === 'function') {
                    try { engine.lineDecorator.clearAllDecorations() } catch (e) { appendTerminalDebug('Failed to clear line decorations: ' + e) }
                }
            }
        } catch (e) { appendTerminalDebug('Failed to clear engine state: ' + e) }

        // Update UI controls to reflect no recording available
        try {
            if (ui && typeof ui.updateReplayControls === 'function') ui.updateReplayControls(false)
        } catch (e) { appendTerminalDebug('Failed to update replay UI controls: ' + e) }

        // Clear any active recording and native trace callback
        try {
            if (recorder) {
                try { if (typeof recorder.cleanupNativeTraceCallback === 'function') recorder.cleanupNativeTraceCallback() } catch (e) { appendTerminalDebug('Failed to cleanup native trace callback: ' + e) }
                try { if (typeof recorder.clearRecording === 'function') recorder.clearRecording() } catch (e) { appendTerminalDebug('Failed to clear recording: ' + e) }
            }
        } catch (e) { appendTerminalDebug('Failed to clear recorder state: ' + e) }

        appendTerminalDebug('✅ Record/replay state reset')
    } catch (err) {
        try { appendTerminalDebug('❌ resetRecordReplayState failed: ' + err) } catch (_) { }
    }
}

export default { resetRecordReplayState }
