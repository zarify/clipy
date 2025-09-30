// Replay engine and UI controls for execution debugging
import { appendTerminalDebug } from './terminal.js'
import { $ } from './utils.js'

/**
 * Line decorator for CodeMirror integration
 */
export class ReplayLineDecorator {
    constructor(codemirror) {
        this.codemirror = codemirror
        this.activeWidgets = []
        this.currentExecutionLine = null
    }

    /**
     * Show variables at a specific line
     */
    showVariablesAtLine(lineNumber, variables) {
        if (!this.codemirror || !variables || variables.size === 0) {
            return
        }

        try {
            // Create HTML element for variable display
            const variableDisplay = this.formatVariablesForDisplay(variables)

            // Add line widget below the specified line
            const widget = this.codemirror.addLineWidget(lineNumber - 1, variableDisplay, {
                coverGutter: false,
                noHScroll: true,
                above: false
            })
            this.activeWidgets.push(widget)
        } catch (error) {
            appendTerminalDebug('Failed to show variables at line: ' + error)
        }
    }

    /**
     * Highlight current execution line
     */
    highlightExecutionLine(lineNumber) {
        try {
            // Clear previous highlight
            if (this.currentExecutionLine !== null) {
                this.codemirror.removeLineClass(this.currentExecutionLine - 1, 'background', 'execution-current')
            }

            // Add new highlight
            if (lineNumber > 0) {
                this.codemirror.addLineClass(lineNumber - 1, 'background', 'execution-current')
                this.currentExecutionLine = lineNumber

                // Scroll to the line
                const coords = this.codemirror.charCoords({ line: lineNumber - 1, ch: 0 }, 'local')
                this.codemirror.scrollIntoView({ line: lineNumber - 1, ch: 0 })
            }
        } catch (error) {
            appendTerminalDebug('Failed to highlight execution line: ' + error)
        }
    }

    /**
     * Format variables for display
     */
    formatVariablesForDisplay(variables) {
        const container = document.createElement('div')
        container.className = 'variable-display'

        let variableText = ''
        let count = 0
        const maxDisplay = 10

        for (const [name, value] of variables) {
            if (count >= maxDisplay) {
                variableText += `... and ${variables.size - maxDisplay} more variables`
                break
            }

            const formattedValue = this.formatValue(value)
            variableText += `${name} = ${formattedValue}${count < variables.size - 1 ? ', ' : ''}`
            count++
        }

        container.textContent = variableText
        return container
    }

    /**
     * Format a single value for display
     */
    formatValue(value) {
        if (value === null) return 'None'
        if (value === undefined) return 'undefined'
        if (typeof value === 'string') {
            return `"${value}"`
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value)
        }
        if (Array.isArray(value)) {
            return `[${value.map(v => this.formatValue(v)).join(', ')}]`
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value).slice(0, 3)
            const formatted = entries.map(([k, v]) => `${k}: ${this.formatValue(v)}`).join(', ')
            return `{${formatted}${Object.keys(value).length > 3 ? ', ...' : ''}}`
        }
        return String(value)
    }

    /**
     * Clear all decorations
     */
    clearAllDecorations() {
        try {
            // Remove all line widgets
            for (const widget of this.activeWidgets) {
                widget.clear()
            }
            this.activeWidgets = []

            // Clear execution line highlight
            if (this.currentExecutionLine !== null) {
                this.codemirror.removeLineClass(this.currentExecutionLine - 1, 'background', 'execution-current')
                this.currentExecutionLine = null
            }
        } catch (error) {
            appendTerminalDebug('Failed to clear decorations: ' + error)
        }
    }
}

/**
 * Main replay engine class
 */
export class ReplayEngine {
    constructor() {
        this.executionTrace = null
        this.currentStepIndex = 0
        this.isReplaying = false
        this.lineDecorator = null
        this.ui = null
    }

    /**
     * Start replay with an execution trace
     */
    startReplay(executionTrace) {
        if (!executionTrace || executionTrace.getStepCount() === 0) {
            appendTerminalDebug('Cannot start replay: no execution trace available')
            return false
        }

        try {
            // If already replaying with the same trace, just rewind to the start
            if (this.isReplaying && this.executionTrace === executionTrace) {
                appendTerminalDebug('Replay already active — rewinding to start')
                this.currentStepIndex = 0
                // Clear decorations and display first step
                if (this.lineDecorator) {
                    this.lineDecorator.clearAllDecorations()
                }
                this.displayCurrentStep()
                this.updateUI()
                return true
            }

            // If a different trace or not currently replaying, (re)initialize state
            // Ensure any previous decorations are cleared before starting
            if (this.lineDecorator) {
                try { this.lineDecorator.clearAllDecorations() } catch (e) { /* ignore */ }
            }

            this.executionTrace = executionTrace
            this.currentStepIndex = 0
            this.isReplaying = true

            // Initialize line decorator
            if (window.cm) {
                this.lineDecorator = new ReplayLineDecorator(window.cm)
            }

            // Show replay UI
            this.showReplayUI()

            // Display first step
            this.displayCurrentStep()

            appendTerminalDebug(`Replay started with ${executionTrace.getStepCount()} steps`)
            return true
        } catch (error) {
            appendTerminalDebug('Failed to start replay: ' + error)
            return false
        }
    }

    /**
     * Stop replay and clean up
     */
    stopReplay() {
        if (!this.isReplaying) {
            return
        }

        try {
            this.isReplaying = false

            // Clear decorations
            if (this.lineDecorator) {
                this.lineDecorator.clearAllDecorations()
            }

            // Hide replay UI
            this.hideReplayUI()

            appendTerminalDebug('Replay stopped')
        } catch (error) {
            appendTerminalDebug('Failed to stop replay: ' + error)
        }
    }

    /**
     * Step forward in replay
     */
    stepForward() {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        if (this.currentStepIndex < this.executionTrace.getStepCount() - 1) {
            this.currentStepIndex++
            this.displayCurrentStep()
            this.updateUI()
            return true
        }
        return false
    }

    /**
     * Step backward in replay
     */
    stepBackward() {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        if (this.currentStepIndex > 0) {
            this.currentStepIndex--
            this.displayCurrentStep()
            this.updateUI()
            return true
        }
        return false
    }

    /**
     * Jump to a specific step
     */
    jumpToStep(stepIndex) {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        const maxIndex = this.executionTrace.getStepCount() - 1
        if (stepIndex >= 0 && stepIndex <= maxIndex) {
            this.currentStepIndex = stepIndex
            this.displayCurrentStep()
            this.updateUI()
            return true
        }
        return false
    }

    /**
     * Jump to step by percentage
     */
    jumpToPercentage(percentage) {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        const totalSteps = this.executionTrace.getStepCount()
        const stepIndex = Math.round((percentage / 100) * (totalSteps - 1))
        return this.jumpToStep(stepIndex)
    }

    /**
     * Display the current step
     */
    displayCurrentStep() {
        if (!this.isReplaying || !this.executionTrace || !this.lineDecorator) {
            return
        }

        try {
            const step = this.executionTrace.getStep(this.currentStepIndex)
            if (!step) {
                return
            }

            // Clear previous decorations
            this.lineDecorator.clearAllDecorations()

            // Highlight execution line
            this.lineDecorator.highlightExecutionLine(step.lineNumber)

            // Show variables if available
            if (step.variables && step.variables.size > 0) {
                this.lineDecorator.showVariablesAtLine(step.lineNumber, step.variables)
            }
        } catch (error) {
            appendTerminalDebug('Failed to display current step: ' + error)
        }
    }

    /**
     * Show replay UI controls
     */
    showReplayUI() {
        const replayControls = $('replay-controls')
        if (replayControls) {
            replayControls.style.display = 'flex'
        }

        // Add replay mode class to editor
        if (window.cm) {
            window.cm.getWrapperElement().classList.add('replay-mode')
        }

        this.updateUI()
    }

    /**
     * Hide replay UI controls
     */
    hideReplayUI() {
        const replayControls = $('replay-controls')
        if (replayControls) {
            replayControls.style.display = 'none'
        }

        // Remove replay mode class from editor
        if (window.cm) {
            window.cm.getWrapperElement().classList.remove('replay-mode')
        }
    }

    /**
     * Update UI controls state
     */
    updateUI() {
        if (!this.isReplaying || !this.executionTrace) {
            return
        }

        try {
            const stepBackBtn = $('replay-step-back')
            const stepForwardBtn = $('replay-step-forward')
            const scrubber = $('replay-scrubber')

            if (stepBackBtn) {
                stepBackBtn.disabled = this.currentStepIndex <= 0
            }

            if (stepForwardBtn) {
                stepForwardBtn.disabled = this.currentStepIndex >= this.executionTrace.getStepCount() - 1
            }

            if (scrubber) {
                const percentage = this.executionTrace.getStepCount() > 1
                    ? (this.currentStepIndex / (this.executionTrace.getStepCount() - 1)) * 100
                    : 0
                scrubber.value = percentage
            }
        } catch (error) {
            appendTerminalDebug('Failed to update UI: ' + error)
        }
    }

    /**
     * Get current replay status
     */
    getStatus() {
        return {
            isReplaying: this.isReplaying,
            currentStep: this.currentStepIndex,
            totalSteps: this.executionTrace ? this.executionTrace.getStepCount() : 0,
            hasTrace: this.executionTrace !== null
        }
    }
}

/**
 * Replay UI controller
 */
export class ReplayUI {
    constructor(replayEngine) {
        this.replayEngine = replayEngine
        this.setupEventListeners()
    }

    /**
     * Setup event listeners for replay controls
     */
    setupEventListeners() {
        // Start replay button
        const replayStartBtn = $('replay-start')
        if (replayStartBtn) {
            replayStartBtn.addEventListener('click', () => {
                if (!window.ExecutionRecorder?.hasActiveRecording()) {
                    appendTerminalDebug('No execution recording available for replay')
                    return
                }

                const trace = window.ExecutionRecorder.getTrace()

                // If already replaying, rewind to start instead of creating a new replay
                if (this.replayEngine.isReplaying && this.replayEngine.executionTrace) {
                    // If the trace object appears to be the same (or equivalent by step count), rewind
                    const sameTrace = this.replayEngine.executionTrace === trace ||
                        (trace && this.replayEngine.executionTrace && trace.getStepCount &&
                            this.replayEngine.executionTrace.getStepCount &&
                            trace.getStepCount() === this.replayEngine.executionTrace.getStepCount())

                    if (sameTrace) {
                        appendTerminalDebug('Replay already running — rewinding to start')
                        this.replayEngine.jumpToStep(0)
                        return
                    }

                    // Different trace – stop current replay and start new one
                    this.replayEngine.stopReplay()
                }

                this.replayEngine.startReplay(trace)
            })
        }

        // Step backward button
        const stepBackBtn = $('replay-step-back')
        if (stepBackBtn) {
            stepBackBtn.addEventListener('click', () => {
                this.replayEngine.stepBackward()
            })
        }

        // Step forward button
        const stepForwardBtn = $('replay-step-forward')
        if (stepForwardBtn) {
            stepForwardBtn.addEventListener('click', () => {
                this.replayEngine.stepForward()
            })
        }

        // Scrubber/slider
        const scrubber = $('replay-scrubber')
        if (scrubber) {
            scrubber.addEventListener('input', (e) => {
                const percentage = parseFloat(e.target.value)
                this.replayEngine.jumpToPercentage(percentage)
            })
        }

        // Exit replay button
        const exitBtn = $('replay-exit')
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                this.replayEngine.stopReplay()
            })
        }

        // Keyboard shortcuts
        this.setupKeyboardShortcuts()
    }

    /**
     * Setup keyboard shortcuts for replay
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when replaying
            if (!this.replayEngine.isReplaying) {
                return
            }

            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault()
                    this.replayEngine.stepBackward()
                    break
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault()
                    this.replayEngine.stepForward()
                    break
                case 'Escape':
                    e.preventDefault()
                    this.replayEngine.stopReplay()
                    break
                case ' ': // Spacebar
                    e.preventDefault()
                    // Toggle between forward and backward (just step forward for now)
                    this.replayEngine.stepForward()
                    break
            }
        })
    }

    /**
     * Update replay controls visibility
     */
    updateReplayControls(hasRecording) {
        const replayControls = $('replay-controls')
        const replayStartBtn = $('replay-start')

        if (replayControls && replayStartBtn) {
            if (hasRecording) {
                replayControls.style.display = 'flex'
                replayStartBtn.disabled = false
            } else {
                replayControls.style.display = 'none'
                replayStartBtn.disabled = true
            }
        }
    }
}

// Global instance
let globalReplayEngine = null
let globalReplayUI = null

/**
 * Get the global replay engine instance
 */
export function getReplayEngine() {
    if (!globalReplayEngine) {
        globalReplayEngine = new ReplayEngine()
    }
    return globalReplayEngine
}

/**
 * Get the global replay UI instance
 */
export function getReplayUI() {
    if (!globalReplayUI) {
        const engine = getReplayEngine()
        globalReplayUI = new ReplayUI(engine)
    }
    return globalReplayUI
}

/**
 * Initialize the replay system
 */
export function initializeReplaySystem() {
    const engine = getReplayEngine()
    const ui = getReplayUI()

    // Expose globally for integration
    window.ReplayEngine = engine
    window.ReplayUI = ui

    appendTerminalDebug('Replay system initialized')
    return { engine, ui }
}