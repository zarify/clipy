// Real execution instrumentation for record/replay debugging
import { appendTerminalDebug } from './terminal.js'
import { getPythonASTAnalyzer } from './python-ast-analyzer.js'

/**
 * Instrument Python source code to capture execution traces
 */
export class PythonInstrumentor {
    constructor() {
        this.hooks = null
        this.lineCounter = 0
        this.variableState = new Map()
        this.astAnalyzer = getPythonASTAnalyzer()
        this.sourceCode = ''
    }

    /**
     * Set execution hooks for recording
     */
    setHooks(hooks) {
        this.hooks = hooks
        this.lineCounter = 0
        this.variableState.clear()
    }

    /**
     * Instrument Python source code to add tracing
     */
    async instrumentCode(sourceCode, runtimeAdapter = null) {
        try {
            appendTerminalDebug('Instrumenting Python code for execution tracing')

            this.sourceCode = sourceCode

            // First, analyze the AST to understand variable usage per line
            // This now uses JavaScript AST analysis instead of Python
            await this.astAnalyzer.analyzeSource(sourceCode, runtimeAdapter)

            const lines = sourceCode.split('\n')
            const instrumentedLines = []

            // Add tracing setup at the start
            instrumentedLines.push('# Execution tracing setup')
            instrumentedLines.push('import sys')
            instrumentedLines.push('_trace_vars = {}')
            instrumentedLines.push('')

            // Add trace function with multiple communication methods
            instrumentedLines.push('def _trace_execution(line_no, vars_dict):')
            instrumentedLines.push('    try:')
            instrumentedLines.push('        # Method 1: Try MicroPython js module')
            instrumentedLines.push('        try:')
            instrumentedLines.push('            import js')
            instrumentedLines.push('            if hasattr(js, "_record_execution_step"):')
            instrumentedLines.push('                js._record_execution_step(line_no, vars_dict)')
            instrumentedLines.push('                return')
            instrumentedLines.push('        except: pass')
            instrumentedLines.push('        ')
            instrumentedLines.push('        # Method 2: Print structured data that can be parsed')
            instrumentedLines.push('        import json')
            instrumentedLines.push('        trace_data = {"__TRACE__": {"line": line_no, "vars": vars_dict}}')
            instrumentedLines.push('        print("__EXECUTION_TRACE__" + json.dumps(trace_data))')
            instrumentedLines.push('    except Exception as e:')
            instrumentedLines.push('        pass  # Silently ignore tracing errors')
            instrumentedLines.push('')

            // Record how many header lines we've added before the user's code
            const headerLinesBeforeUserCode = instrumentedLines.length

            // Instrument each line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                const originalLineNumber = i + 1 // Keep original line numbers for display

                if (line === '' || line.startsWith('#')) {
                    instrumentedLines.push(lines[i])
                    continue
                }

                // Add the original line
                instrumentedLines.push(lines[i])

                // Add tracing call after executable lines
                if (this.isExecutableLine(line)) {
                    const indent = this.getIndentation(lines[i])

                    // Capture local variables and trace with ORIGINAL line number
                    instrumentedLines.push(`${indent}try:`)
                    instrumentedLines.push(`${indent}    _trace_vars = {k: repr(v) for k, v in locals().items() if not k.startswith('_')}`)
                    instrumentedLines.push(`${indent}    _trace_execution(${originalLineNumber}, _trace_vars)`)
                    instrumentedLines.push(`${indent}except: pass`)
                }
            }

            const instrumentedCode = instrumentedLines.join('\n')
            appendTerminalDebug(`Instrumented ${lines.length} lines of Python code`)

            // Calculate the actual headerLines by finding where the first user line appears
            // in the final instrumented code
            const instrumentedCodeLines = instrumentedCode.split('\n')
            const firstUserLine = lines[0]
            let actualHeaderLines = headerLinesBeforeUserCode

            // Find where the first user line actually appears in the instrumented code
            for (let i = headerLinesBeforeUserCode; i < instrumentedCodeLines.length; i++) {
                try {
                    if (instrumentedCodeLines[i].trim() === String(firstUserLine).trim()) {
                        actualHeaderLines = i
                        break
                    }
                } catch (_e) { }
            }

            // Build an explicit instrumented-line -> original-line mapping so
            // callers can accurately map tracebacks back to the user's source
            // even when instrumentation inserts extra lines between user lines.
            const instrumentedToOriginal = {}
            try {
                // More robust mapping: search for the trimmed original line text
                // within the instrumented code lines. This handles indentation
                // and wrapper/header differences that change leading whitespace.
                let searchPos = 0
                for (let origIdx = 0; origIdx < lines.length; origIdx++) {
                    const target = String(lines[origIdx] || '').trim()
                    if (!target) continue // skip blank original lines
                    for (let i = searchPos; i < instrumentedCodeLines.length; i++) {
                        try {
                            if (String(instrumentedCodeLines[i] || '').trim() === target) {
                                instrumentedToOriginal[i + 1] = origIdx + 1
                                searchPos = i + 1
                                break
                            }
                        } catch (_e) { }
                    }
                }
            } catch (_e) { /* best-effort; ignore mapping failures */ }

            appendTerminalDebug(`Instrumentation: ${headerLinesBeforeUserCode} lines before user code, first user line found at position ${actualHeaderLines}`)
            appendTerminalDebug(`Total instrumented lines: ${instrumentedCodeLines.length}, original lines: ${lines.length}`)

            // Debug: show the instrumented code
            if (window.__SSG_DEBUG) {
                console.log('=== INSTRUMENTED CODE ===')
                console.log(instrumentedCode)
                console.log('=== END INSTRUMENTED CODE ===')
            }

            // Return both the instrumented code and how many header lines were
            // prepended so callers (traceback mapping) can adjust line numbers.
            // Also return an explicit instrumented->original line map for
            // accurate mappings when tracing has injected extra lines.
            return { code: instrumentedCode, headerLines: actualHeaderLines, lineMap: instrumentedToOriginal }

        } catch (error) {
            appendTerminalDebug('Failed to instrument Python code: ' + error)
            return sourceCode // Return original on error
        }
    }

    /**
     * Check if a line is executable (not just a comment or empty)
     */
    isExecutableLine(line) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '') return false
        if (trimmed.startsWith('#')) return false

        // Skip control flow keywords that don't execute immediately
        const skipKeywords = ['def ', 'class ', 'if ', 'elif ', 'else:', 'try:', 'except:', 'finally:', 'with ', 'for ', 'while ']
        for (const keyword of skipKeywords) {
            if (trimmed.startsWith(keyword)) return false
        }

        // Include assignment statements, function calls, and expressions
        const includePatterns = [
            /^\w+\s*=/, // assignment
            /^print\s*\(/, // print calls
            /^\w+\(/, // function calls
            /^return\s+/, // return statements
        ]

        for (const pattern of includePatterns) {
            if (pattern.test(trimmed)) return true
        }

        // If it's not a skip keyword and looks like an expression, include it
        return trimmed.length > 0 && !trimmed.endsWith(':')
    }

    /**
     * Get indentation level of a line
     */
    getIndentation(line) {
        const match = line.match(/^(\s*)/)
        return match ? match[1] : ''
    }

    /**
     * Set up JavaScript callback for receiving trace data
     */
    setupTraceCallback() {
        // Create a global function that Python can call
        window._record_execution_step = (lineNumber, varsDict) => {
            try {
                if (!this.hooks) return

                // Convert Python variables dict to Map
                const allVariables = new Map()
                if (varsDict && typeof varsDict === 'object') {
                    for (const [name, value] of Object.entries(varsDict)) {
                        // Filter out system variables and tracing internals
                        if (!name.startsWith('_') &&
                            !['sys', 'gc', 'json', 'ast'].includes(name) &&
                            name !== 'k' && name !== 'name') {
                            allVariables.set(name, value)
                        }
                    }
                }

                // Use AST analyzer to get only relevant variables for this line
                const relevantVariables = this.astAnalyzer.getRelevantVariables(lineNumber, allVariables)

                appendTerminalDebug(`Trace: Line ${lineNumber}, Variables: ${JSON.stringify(Object.fromEntries(relevantVariables))}`)

                // Call the recording hook with filtered variables
                if (this.hooks.onExecutionStep) {
                    this.hooks.onExecutionStep(lineNumber, relevantVariables, 'global')
                }

            } catch (error) {
                appendTerminalDebug('Error in trace callback: ' + error)
            }
        }

        appendTerminalDebug('Python trace callback setup complete')
    }

    /**
     * Clean up tracing
     */
    cleanup() {
        delete window._record_execution_step
        this.hooks = null
        this.variableState.clear()
        this.astAnalyzer.clear()
        this.sourceCode = ''
        // Clear any exported mapping helper
        try { delete this._lastLineMap } catch (_e) { }
        appendTerminalDebug('Python instrumentation cleanup complete')
    }
}

// Global instance
let globalInstrumentor = null

/**
 * Get the global Python instrumentor
 */
export function getPythonInstrumentor() {
    if (!globalInstrumentor) {
        globalInstrumentor = new PythonInstrumentor()
    }
    return globalInstrumentor
}