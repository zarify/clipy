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
        this.lineReferenceMap = null  // Will be set by ReplayEngine
    }

    /**
     * Show variables at a specific line
     * @param {number} lineNumber - Line number to show variables for
     * @param {Map} variables - Variables at this step
     * @param {Object} executionTrace - The execution trace (needed to look ahead for assigned values)
     * @param {number} currentStepIndex - Current step index (needed to look ahead)
     */
    showVariablesAtLine(lineNumber, variables, executionTrace = null, currentStepIndex = -1) {
        if (!this.codemirror || !variables || variables.size === 0) {
            appendTerminalDebug(`showVariablesAtLine: skipped - codemirror=${!!this.codemirror}, variables=${variables ? variables.size : 'null'}`)
            return
        }

        try {
            appendTerminalDebug(`showVariablesAtLine: line ${lineNumber}, ${variables.size} variables total`)

            // Get the source text for the given line
            let lineText = ''
            try {
                lineText = this.codemirror.getLine(lineNumber - 1) || ''
            } catch (e) {
                lineText = ''
            }

            // Use cached AST analysis to determine which variables are assigned/referenced on this line
            const displayVars = new Map()
            const astData = this.getReferencedNamesForLine(lineNumber)

            // Helper: Filter out built-in functions and internal variables
            const isBuiltinOrInternal = (name, value) => {
                // Filter out common built-in functions that shouldn't be shown
                const builtins = ['print', 'input', 'int', 'str', 'float', 'len', 'range', 'list', 'dict', 'set', 'tuple']
                if (builtins.includes(name)) return true

                // Filter out function objects (unless they're user-defined and assigned on this line)
                if (typeof value === 'string' && value.startsWith('<function') && !astData?.assigned.has(name)) return true

                return false
            }

            // DEBUG: Log complete state for this line
            console.group(`🔍 Line ${lineNumber}: ${lineText.trim()}`)
            console.log('Available variables:', Array.from(variables.keys()).join(', '))
            console.log('AST data exists:', !!astData)
            if (astData) {
                console.log('AST assigned size:', astData.assigned.size, 'referenced size:', astData.referenced.size)
            }

            if (astData && (astData.assigned.size > 0 || astData.referenced.size > 0)) {
                console.log('AST assigned:', Array.from(astData.assigned))
                console.log('AST referenced:', Array.from(astData.referenced))

                // Strategy: Show both assigned AND referenced variables
                // IMPORTANT: sys.settrace 'line' events fire BEFORE the line executes
                // So we need to look at the NEXT step to get values AFTER this line executes

                // Get the next step's variables (which will have been updated after this line executed)
                let nextStepVars = null
                if (executionTrace && currentStepIndex >= 0 && currentStepIndex < executionTrace.getStepCount() - 1) {
                    const nextStep = executionTrace.getStep(currentStepIndex + 1)
                    if (nextStep) {
                        nextStepVars = nextStep.variables
                        console.log('Next step vars:', Array.from(nextStepVars?.keys() || []).join(', '))
                        console.log('Next step line:', nextStep.lineNumber)
                    } else {
                        console.log('Next step exists but is null')
                    }
                } else {
                    console.log('No next step available - trace:', !!executionTrace, 'stepIndex:', currentStepIndex, 'count:', executionTrace?.getStepCount())
                }

                // First, add all assigned variables (use next step's values if available)
                for (const name of astData.assigned) {
                    // Skip built-ins
                    if (isBuiltinOrInternal(name, variables.get(name))) {
                        console.log(`  ⊘ Skipping builtin/internal: ${name}`)
                        continue
                    }

                    // For assignments, prefer the next step's value (after execution)
                    let value = nextStepVars?.get(name) ?? variables.get(name)

                    if (value !== undefined) {
                        displayVars.set(name, value)
                        console.log(`  ✓ Added ASSIGNED: ${name} = ${value}`)
                    } else {
                        console.log(`  ✗ ASSIGNED var not found: ${name}`)
                    }
                }

                // Then, add referenced variables that aren't already in displayVars
                // For referenced vars, use current step values (the values that were READ by this line)
                for (const [name, value] of variables) {
                    if (astData.referenced.has(name) && !displayVars.has(name) && !isBuiltinOrInternal(name, value)) {
                        displayVars.set(name, value)
                        console.log(`  ✓ Added REFERENCED: ${name} = ${value}`)
                    }
                }

                console.log('Final display vars:', Array.from(displayVars.keys()).join(', '))
                console.groupEnd()
                appendTerminalDebug(`showVariablesAtLine: line "${lineText.trim()}", AST found ${astData.assigned.size} assigned + ${astData.referenced.size} referenced, displaying ${displayVars.size} variables`)
            } else if (astData) {
                // AST data exists but indicates no variables assigned or referenced on this line
                // Show nothing (e.g., return statement with a constant, pass, etc.)
                console.log('AST indicates no variables - showing nothing')
                console.groupEnd()
                appendTerminalDebug(`showVariablesAtLine: line "${lineText.trim()}", AST indicates no variables`)
            } else {
                // Fallback: if AST not available at all, show all variables (better than showing nothing)
                console.log('No AST data - showing all variables as fallback')
                console.groupEnd()
                for (const [name, value] of variables) {
                    displayVars.set(name, value)
                }
                appendTerminalDebug(`showVariablesAtLine: line "${lineText.trim()}", no AST data, displaying all ${displayVars.size} variables`)
            }

            if (displayVars.size === 0) {
                return
            }

            // Create HTML element for variable display (each variable on its own row)
            const variableDisplay = this.formatVariablesForDisplay(displayVars)

            // Ensure value text doesn't overflow a reasonable width — cap to editor width
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

                // Scroll to the line with proper margin
                // CodeMirror's scrollIntoView accepts a margin parameter (in pixels)
                // We want 3 lines of context above/below, plus space for variable widgets
                const lineHeight = this.codemirror.defaultTextHeight() || 18
                const contextLines = 3
                const widgetEstimate = 100  // Estimate for variable display widget
                const margin = (contextLines * lineHeight) + widgetEstimate

                this.codemirror.scrollIntoView(
                    { line: lineNumber - 1, ch: 0 },
                    margin  // This ensures we have space above AND below
                )
            }
        } catch (error) {
            appendTerminalDebug('Failed to highlight execution line: ' + error)
        }
    }

    /**
     * Get variable names to display for a specific line (using AST analysis)
     * Returns an object with { assigned: Set, referenced: Set }
     * Display logic should prioritize assigned variables
     */
    getReferencedNamesForLine(lineNumber) {
        if (!this.lineReferenceMap || !this.lineReferenceMap.has(lineNumber)) {
            return null
        }
        const lineData = this.lineReferenceMap.get(lineNumber)

        // Return both assigned and referenced sets
        // Also include function calls in referenced (functions being called are "referenced")
        const referencedWithCalls = new Set([...lineData.referenced, ...lineData.functionCalls])

        return {
            assigned: lineData.assigned || new Set(),
            referenced: referencedWithCalls
        }
    }

    /**
     * Format variables for display
     */
    formatVariablesForDisplay(variables) {
        const container = document.createElement('div')
        container.className = 'variable-display'

        // limit number of variables shown to avoid huge widgets
        const maxDisplay = 10
        let count = 0

        // attempt to compute pixel widths so we can truncate values to fit
        let containerMaxPx = 400
        try {
            const editorWrapper = this.codemirror.getWrapperElement()
            if (editorWrapper && editorWrapper.clientWidth) {
                containerMaxPx = Math.max(200, Math.min(600, editorWrapper.clientWidth - 100))
            }
        } catch (e) {
            // ignore
        }

        // helper to measure text width in current page fonts
        const measureTextWidth = (text, className) => {
            const s = document.createElement('span')
            s.style.visibility = 'hidden'
            s.style.position = 'absolute'
            s.style.whiteSpace = 'nowrap'
            if (className) s.className = className
            s.textContent = text
            document.body.appendChild(s)
            const w = s.offsetWidth || 0
            document.body.removeChild(s)
            return w
        }

        const approxCharPx = Math.max(6, measureTextWidth('0', 'variable-value'))

        for (const [name, value] of variables) {
            if (count >= maxDisplay) {
                const more = document.createElement('div')
                more.className = 'variable-row variable-more'
                more.textContent = `... and ${variables.size - maxDisplay} more variables`
                container.appendChild(more)
                break
            }

            const row = document.createElement('div')
            row.className = 'variable-row'

            const nameEl = document.createElement('span')
            nameEl.className = 'variable-name'
            nameEl.textContent = name + ' = '

            const valueEl = document.createElement('span')
            valueEl.className = 'variable-value'
            // measure name width and compute available chars for the value
            const namePx = measureTextWidth(nameEl.textContent, 'variable-name')
            const availablePx = Math.max(50, containerMaxPx - namePx - 24)
            const maxChars = Math.max(8, Math.floor(availablePx / approxCharPx))
            valueEl.textContent = this.formatValue(value, maxChars)

            row.appendChild(nameEl)
            row.appendChild(valueEl)
            container.appendChild(row)
            count++
        }

        // Add minimal inline styles to prevent horizontal overflow if editor width known
        try {
            const editorWrapper = this.codemirror.getWrapperElement()
            if (editorWrapper && editorWrapper.clientWidth) {
                container.style.maxWidth = Math.max(200, Math.min(600, editorWrapper.clientWidth - 100)) + 'px'
            }
        } catch (e) {
            // ignore
        }

        return container
    }

    /**
     * Format a single value for display
     */
    formatValue(value, maxChars = 80) {
        if (value === null) return 'None'
        if (value === undefined) return 'undefined'
        // Strings: DO NOT add quotes — display raw/truncated string value as-is.
        if (typeof value === 'string') {
            return this.truncateString(value, maxChars)
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value)
        }
        if (Array.isArray(value)) {
            // Format inner values, then truncate the joined representation preserving brackets
            const inner = value.map(v => this.formatValue(v, Math.max(8, Math.floor(maxChars / Math.max(1, value.length))))).join(', ')
            return this.truncateWrapped(inner, '[', ']', maxChars)
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value).slice(0, 3)
            const formatted = entries.map(([k, v]) => `${k}: ${this.formatValue(v, Math.max(8, Math.floor(maxChars / Math.max(1, entries.length))))}`).join(', ')
            const body = `${formatted}${Object.keys(value).length > 3 ? ', ...' : ''}`
            return this.truncateWrapped(body, '{', '}', maxChars)
        }
        return String(value)
    }

    /**
     * Truncate a plain string with ellipses if too long. Do not add quotes.
     */
    truncateString(s, max = 80) {
        if (s.length <= max) return s
        return `${s.slice(0, max - 3)}...`
    }

    /**
     * Truncate content that is displayed inside opening/closing wrappers (like [ ... ] or { ... })
     * and preserve the wrappers while placing ellipses before the closing wrapper if truncated.
     */
    truncateWrapped(content, open, close, max = 80) {
        const full = `${open}${content}${close}`
        if (full.length <= max) return full
        // keep the opening and the close, but shorten content and add ellipses before close
        const spaceForContent = max - open.length - close.length - 3 // for '...'
        const shortened = content.slice(0, Math.max(0, spaceForContent))
        return `${open}${shortened}...${close}`
    }

    /**
     * Escape a string for safe insertion into a regex pattern
     */
    escapeForRegex(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
        this.currentFilename = '/main.py'  // Track which file is currently being shown
        this.lineReferenceMap = null  // Cache for AST-based line references
    }

    /**
     * Start replay with an execution trace
     */
    async startReplay(executionTrace) {
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
                // When rewinding, ensure we're on the correct file for the first step
                const firstStep = executionTrace.getStep(0)
                if (firstStep && firstStep.filename) {
                    this.ensureCorrectFileIsActive(firstStep.filename)
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

            // Build AST line reference map from source code
            if (executionTrace.metadata && executionTrace.metadata.sourceCode) {
                await this.buildLineReferenceMap(executionTrace.metadata.sourceCode)
            }

            // Initialize line decorator and pass it the AST reference map
            if (window.cm) {
                this.lineDecorator = new ReplayLineDecorator(window.cm)
                this.lineDecorator.lineReferenceMap = this.lineReferenceMap
            }

            // Before showing replay UI and displaying the first step, ensure
            // we're viewing a Python code file (not a data file like .txt).
            // Get the first execution step to determine which file to show.
            const firstStep = executionTrace.getStep(0)
            if (firstStep && firstStep.filename) {
                this.ensureCorrectFileIsActive(firstStep.filename)
            }

            // Show replay UI
            this.showReplayUI()

            // Reset scrubber to start when replay begins
            try {
                const scrubber = $('replay-scrubber')
                if (scrubber) {
                    scrubber.value = 0
                    scrubber.disabled = false
                }
            } catch (e) { /* ignore */ }

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
     * Build AST-based line reference map from source code
     */
    async buildLineReferenceMap(sourceCode) {
        try {
            // Dynamically import AST analyzer
            const { getASTAnalyzer } = await import('./ast-analyzer.js')
            const analyzer = await getASTAnalyzer()
            const ast = await analyzer.parse(sourceCode)

            if (ast) {
                this.lineReferenceMap = analyzer.getVariablesAndCallsPerLine(ast)

                // Build function local variable maps for translating local_N variables
                this.functionLocalMaps = analyzer.buildFunctionLocalMaps(ast)
                this.lineFunctionMap = analyzer.buildLineFunctionMap(ast)

                appendTerminalDebug(`Built AST line reference map: ${this.lineReferenceMap.size} lines analyzed`)

                // DEBUG: Log the complete AST map
                console.group('📊 Complete AST Line Reference Map')
                for (const [lineNum, data] of this.lineReferenceMap.entries()) {
                    const lineText = sourceCode.split('\n')[lineNum - 1] || ''
                    console.log(`Line ${lineNum}: ${lineText.trim()}`)
                    console.log(`  Assigned: [${Array.from(data.assigned).join(', ')}]`)
                    console.log(`  Referenced: [${Array.from(data.referenced).join(', ')}]`)
                    console.log(`  Function Calls: [${Array.from(data.functionCalls).join(', ')}]`)
                }
                console.groupEnd()

                // DEBUG: Log function local maps
                if (this.functionLocalMaps && Object.keys(this.functionLocalMaps).length > 0) {
                    console.group('📋 Function Local Variable Maps')
                    for (const [funcName, localVars] of Object.entries(this.functionLocalMaps)) {
                        console.log(`${funcName}():`, localVars.join(', '))
                        localVars.forEach((varName, idx) => {
                            console.log(`  local_${idx} → ${varName}`)
                        })
                    }
                    console.groupEnd()
                }
            } else {
                appendTerminalDebug('Failed to build AST line reference map: parse returned null')
                this.lineReferenceMap = null
                this.functionLocalMaps = null
                this.lineFunctionMap = null
            }
        } catch (error) {
            appendTerminalDebug('Error building AST line reference map: ' + error)
            this.lineReferenceMap = null
            this.functionLocalMaps = null
            this.lineFunctionMap = null
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

            // After stopping, if there is still a recorded trace available, mark the
            // start button as needing to be pressed (visual cue). Otherwise ensure
            // any special classes are removed.
            try {
                const replayStartBtn = $('replay-start')
                if (replayStartBtn) {
                    if (this.executionTrace) {
                        replayStartBtn.classList.remove('rewind')
                        replayStartBtn.classList.add('needs-start')
                        replayStartBtn.setAttribute('aria-label', 'Start replay')
                    } else {
                        replayStartBtn.classList.remove('rewind')
                        replayStartBtn.classList.remove('needs-start')
                        replayStartBtn.setAttribute('aria-label', 'No replay available')
                    }
                }
            } catch (e) { /* ignore */ }

            // Disable scrubber when not replaying
            try {
                const scrubber = $('replay-scrubber')
                if (scrubber) scrubber.disabled = true
            } catch (e) { /* ignore */ }

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
     * Translate local_N variables to real names using AST-based function maps
     * @param {Map} variables - Variable map from execution trace
     * @param {number} lineNumber - Current line number
     * @returns {Map} Translated variable map
     */
    translateLocalVariables(variables, lineNumber) {
        if (!variables || !this.functionLocalMaps || !this.lineFunctionMap) {
            return variables;
        }

        // Determine which function this line belongs to
        const functionName = this.lineFunctionMap.get(lineNumber);
        if (!functionName) {
            // Module level - no translation needed
            return variables;
        }

        // Get the local variable map for this function
        const localVarNames = this.functionLocalMaps[functionName];
        if (!localVarNames || localVarNames.length === 0) {
            return variables;
        }

        // Translate local_N to real names, filtering out unmapped locals (stack temporaries)
        const translated = new Map();
        for (const [key, value] of variables) {
            if (key.startsWith('local_')) {
                const index = parseInt(key.substring(6));
                const realName = localVarNames[index];
                if (realName) {
                    translated.set(realName, value);
                    console.log(`  🔄 Translated ${key} → ${realName} = ${value}`);
                }
                // else: Skip unmapped local_N (stack temporary) - don't include it
            } else {
                // Not a local_N variable - keep as is
                translated.set(key, value);
            }
        }

        return translated;
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

            appendTerminalDebug(`Displaying step ${this.currentStepIndex}: line ${step.lineNumber} in ${step.filename || '/main.py'}`)

            // DEBUG: Log execution step details
            console.group(`🎬 Step ${this.currentStepIndex}`)
            console.log('Line number:', step.lineNumber)
            console.log('Filename:', step.filename || '/main.py')
            console.log('Variables at this step:', Array.from(step.variables?.entries() || []).map(([k, v]) => `${k}=${v}`).join(', '))
            console.groupEnd()

            // Ensure we're viewing the correct Python code file for this step.
            // This prevents highlighting lines in non-code files like .txt data files.
            if (step.filename) {
                this.ensureCorrectFileIsActive(step.filename)
            }

            // Clear previous decorations
            this.lineDecorator.clearAllDecorations()

            // Highlight execution line
            this.lineDecorator.highlightExecutionLine(step.lineNumber)

            // Translate local_N variables to real names
            const translatedVariables = this.translateLocalVariables(step.variables, step.lineNumber)

            // Show variables if available
            if (translatedVariables && translatedVariables.size > 0) {
                this.lineDecorator.showVariablesAtLine(step.lineNumber, translatedVariables, this.executionTrace, this.currentStepIndex)
            }
        } catch (error) {
            appendTerminalDebug('Failed to display current step: ' + error)
        }
    }

    /**
     * Ensure the correct Python code file is active for replay. This prevents
     * highlighting lines in non-code files (like .txt data files).
     */
    ensureCorrectFileIsActive(targetFilename) {
        try {
            // Get the currently active file from TabManager
            const currentActiveFile = window.TabManager && typeof window.TabManager.getActive === 'function'
                ? window.TabManager.getActive()
                : null

            // Normalize target filename
            const normalizedTarget = targetFilename.startsWith('/') ? targetFilename : `/${targetFilename}`

            // Check if target is a Python code file (not a data file)
            const isTargetPythonFile = normalizedTarget.endsWith('.py')

            if (!isTargetPythonFile) {
                appendTerminalDebug(`Target file ${normalizedTarget} is not a Python file, defaulting to /main.py`)
                this.switchToFile('/main.py')
                return
            }

            // If current file is not a Python code file, or it's a different file than the target, switch
            const isCurrentPythonFile = currentActiveFile && currentActiveFile.endsWith('.py')

            if (!isCurrentPythonFile || currentActiveFile !== normalizedTarget) {
                appendTerminalDebug(`Switching from ${currentActiveFile || 'unknown'} to ${normalizedTarget} for replay`)
                this.switchToFile(normalizedTarget)
            } else {
                // Already on the correct file, just update our tracker
                this.currentFilename = normalizedTarget
            }
        } catch (error) {
            appendTerminalDebug('Failed to ensure correct file is active: ' + error)
            // Fall back to main.py on error
            try {
                this.switchToFile('/main.py')
            } catch (e) { /* ignore */ }
        }
    }

    /**
     * Switch to a different file tab
     */
    switchToFile(filename) {
        try {
            // Normalize the filename
            const normalizedFilename = filename.startsWith('/') ? filename : `/${filename}`

            // Try to switch to the tab using the TabManager
            if (window.TabManager && typeof window.TabManager.selectTab === 'function') {
                appendTerminalDebug(`Switching to file: ${normalizedFilename}`)
                window.TabManager.selectTab(normalizedFilename)
                this.currentFilename = normalizedFilename
            } else {
                appendTerminalDebug('TabManager not available for file switching')
            }
        } catch (error) {
            appendTerminalDebug('Failed to switch to file: ' + error)
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

        // Hide the inline start button and show the rewind button inside controls
        try {
            const inlineStart = $('replay-start-inline')
            if (inlineStart) {
                inlineStart.style.display = 'none'
                inlineStart.classList.remove('needs-start')
            }

            const rewindBtn = $('replay-rewind')
            if (rewindBtn) {
                rewindBtn.style.display = 'inline-flex'
                rewindBtn.disabled = false
                rewindBtn.setAttribute('aria-label', 'Rewind replay')
            }
        } catch (e) { /* ignore */ }

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

        // Clean up any start/rewind button visual state: hide rewind, clear inline state
        try {
            const rewindBtn = $('replay-rewind')
            if (rewindBtn) {
                rewindBtn.style.display = 'none'
                rewindBtn.classList.remove('rewind')
            }

            const inlineStart = $('replay-start-inline')
            if (inlineStart) {
                inlineStart.classList.remove('rewind')
                inlineStart.classList.remove('needs-start')
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Update UI controls state
     */
    updateUI() {
        // If not replaying, we don't update the per-step UI here; callers
        // should use updateReplayControls(hasRecording) to set the initial
        // disabled state. When replaying, update the buttons and scrubber.
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
                scrubber.disabled = false
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
        // Inline start button (shown next to Run when a recording exists)
        const inlineStart = $('replay-start-inline')
        if (inlineStart) {
            inlineStart.addEventListener('click', () => {
                if (!window.ExecutionRecorder?.hasActiveRecording()) {
                    appendTerminalDebug('No execution recording available for replay')
                    return
                }

                const trace = window.ExecutionRecorder.getTrace()
                // Start the replay and show controls (showReplayUI handles hiding inline)
                this.replayEngine.startReplay(trace)
            })
        }

        // Rewind button inside controls (visible when replaying)
        const rewindBtn = $('replay-rewind')
        if (rewindBtn) {
            rewindBtn.addEventListener('click', () => {
                // Rewind to start step
                this.replayEngine.jumpToStep(0)
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
        const inlineStart = $('replay-start-inline')
        const rewindBtn = $('replay-rewind')

        const stepBackBtn = $('replay-step-back')
        const stepForwardBtn = $('replay-step-forward')
        const scrubber = $('replay-scrubber')

        if (replayControls && inlineStart && rewindBtn) {
            if (hasRecording) {
                // Show the inline start button next to Run when not replaying
                if (!this.replayEngine.isReplaying) {
                    replayControls.style.display = 'none'
                    inlineStart.style.display = 'inline-flex'
                    inlineStart.classList.add('needs-start')
                    inlineStart.setAttribute('aria-label', 'Start replay')

                    if (stepBackBtn) stepBackBtn.disabled = true
                    if (stepForwardBtn) stepForwardBtn.disabled = true
                    if (scrubber) scrubber.disabled = true
                } else {
                    // When replaying, show controls (and the rewind button inside them)
                    replayControls.style.display = 'flex'
                    inlineStart.style.display = 'none'

                    if (stepBackBtn) stepBackBtn.disabled = this.replayEngine.currentStepIndex <= 0
                    if (stepForwardBtn) stepForwardBtn.disabled = this.replayEngine.currentStepIndex >= this.replayEngine.executionTrace.getStepCount() - 1
                    if (scrubber) scrubber.disabled = false

                    rewindBtn.style.display = 'inline-flex'
                    rewindBtn.setAttribute('aria-label', 'Rewind replay')
                }
            } else {
                // No recording: hide both inline and controls
                replayControls.style.display = 'none'
                inlineStart.style.display = 'none'
                rewindBtn.style.display = 'none'
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