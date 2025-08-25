// Main execution engine for running Python code
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled } from './terminal.js'
import { getRuntimeAdapter, setExecutionRunning, getExecutionState } from './micropython.js'

export async function executeWithTimeout(executionPromise, timeoutMs, safetyTimeoutMs = 5000) {
  const executionState = getExecutionState()
  
  // Create abort controller for this execution
  const abortController = new AbortController()
  executionState.currentAbortController = abortController

  return new Promise((resolve, reject) => {
    let completed = false
    let timeoutId = null
    let safetyTimeoutId = null

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
      executionState.currentAbortController = null
      executionState.timeoutId = null
    }

    const complete = (result, isError = false) => {
      if (completed) return
      completed = true
      cleanup()
      if (isError) reject(result)
      else resolve(result)
    }

    // Main timeout
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        complete(new Error(`Execution timeout after ${timeoutMs}ms`), true)
        try { abortController.abort() } catch (_e) { }
      }, timeoutMs)
      executionState.timeoutId = timeoutId
    }

    // Safety timeout (shorter, for UI responsiveness)
    if (safetyTimeoutMs > 0 && safetyTimeoutMs < timeoutMs) {
      safetyTimeoutId = setTimeout(() => {
        appendTerminalDebug(`⚠️ Safety timeout reached (${safetyTimeoutMs}ms), attempting interrupt...`)
        try { abortController.abort() } catch (_e) { }
      }, safetyTimeoutMs)
    }

    // Handle abort signal
    abortController.signal.addEventListener('abort', () => {
      complete(new Error('Execution aborted'), true)
    })

    // Execute the promise
    executionPromise
      .then(result => complete(result))
      .catch(error => complete(error, true))
  })
}

export async function runPythonCode(code, cfg) {
  const runtimeAdapter = getRuntimeAdapter()
  
  if (getExecutionState().isRunning) {
    appendTerminal('>>> Execution already in progress...', 'runtime')
    return
  }

  setExecutionRunning(true)
  appendTerminal('>>> Running...', 'runtime')

  // Clear Python state before each execution to ensure fresh start
  try {
    if (window.clearMicroPythonState) {
      window.clearMicroPythonState()
    }
  } catch (err) {
    appendTerminalDebug('⚠️ State clearing failed:', err)
  }

  // Get timeout from config (default 30 seconds)
  const timeoutSeconds = cfg?.execution?.timeoutSeconds || 30
  const timeoutMs = timeoutSeconds * 1000

  // Safety timeout for infinite loops (default 5 seconds, configurable)
  const safetyTimeoutSeconds = cfg?.execution?.safetyTimeoutSeconds || 5
  const safetyTimeoutMs = Math.min(safetyTimeoutSeconds * 1000, timeoutMs)

  try {
    if (runtimeAdapter) {
      // Try asyncify execution first (v3.0.0 preferred path)
      if (runtimeAdapter.hasYieldingSupport && runtimeAdapter.runAsync) {
        try {
          const result = await executeWithTimeout(runtimeAdapter.runAsync(code), timeoutMs, safetyTimeoutMs)
          const runtimeOutput = result === undefined ? '' : String(result)
          if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
        } catch (asyncifyErr) {
          const errMsg = String(asyncifyErr)
          
          if (errMsg.includes('aborted') || errMsg.includes('timeout')) {
            appendTerminal('Execution stopped.', 'runtime')
            
            // Clean up any pending input state
            try {
              if (window.__ssg_pending_input) {
                appendTerminalDebug('Cleaning up pending input state...')
                delete window.__ssg_pending_input
              }
              setTerminalInputEnabled(false)
            } catch (_e) { }
          } else if (errMsg.includes('EOFError')) {
            appendTerminal('Input Error: Input operation was interrupted.', 'runtime')
            appendTerminal('This is normal when stopping execution during input().', 'runtime')

            // Try to clean up input state
            try {
              if (window.__ssg_pending_input) {
                appendTerminalDebug('Cleaning up pending input state...')
                delete window.__ssg_pending_input
              }
              setTerminalInputEnabled(false)
            } catch (_e) { }
          } else {
            // For Python errors, show the clean traceback without "Asyncify" prefix
            if (errMsg.includes('Traceback')) {
              appendTerminal(errMsg, 'stderr')
            } else {
              // For non-Python errors, show with context
              appendTerminal('Execution error: ' + errMsg, 'runtime')
              throw asyncifyErr
            }
          }
        }
      } else {
        // Traditional transformed execution
        const out = await executeWithTimeout(runtimeAdapter.run(code), timeoutMs, safetyTimeoutMs)
        const runtimeOutput = out === undefined ? '' : String(out)
        if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
      }
    } else {
      appendTerminal('[error] no runtime adapter available')
    }
  } catch (e) {
    appendTerminal('Transform/run error: ' + e, 'runtime')
    try { setTerminalInputEnabled(false) } catch (_e) { }
  } finally {
    // Always reset execution state
    setExecutionRunning(false)
  }
}
