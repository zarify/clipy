// MicroPython runtime management and interrupt system
import { appendTerminal, appendTerminalDebug } from './terminal.js'

// Global state
let runtimeAdapter = null
let executionState = {
  isRunning: false,
  currentAbortController: null,
  timeoutId: null
}

export function setExecutionRunning(running) {
  executionState.isRunning = running
  const runBtn = document.getElementById('run')
  const stopBtn = document.getElementById('stop')
  
  if (runBtn) {
    runBtn.disabled = running
    runBtn.textContent = running ? 'Running...' : 'Run'
  }
  if (stopBtn) {
    stopBtn.disabled = !running
  }
}

export function interruptMicroPythonVM() {
  let success = false
  
  // Clear pending input first
  if (window.__ssg_pending_input) {
    try {
      if (window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function') {
        appendTerminalDebug('Resolving pending input with empty string...')
        window.__ssg_pending_input.resolve('')
        delete window.__ssg_pending_input
      }
    } catch (err) {
      appendTerminalDebug('Failed to clean up pending input:', err)
    }
  }

  // Try v3.0.0 interrupt methods first
  if (runtimeAdapter && runtimeAdapter.hasYieldingSupport && runtimeAdapter.interruptExecution) {
    try {
      runtimeAdapter.interruptExecution()
      appendTerminalDebug('✅ VM interrupt sent via interruptExecution()')
      success = true
    } catch (err) {
      appendTerminalDebug('❌ interruptExecution() failed:', err)
    }
  }

  // Fallback to AbortController
  if (executionState.currentAbortController) {
    try {
      executionState.currentAbortController.abort()
      appendTerminalDebug('✅ AbortController.abort() called')
      success = true
    } catch (err) {
      appendTerminalDebug('❌ AbortController.abort() failed:', err)
    }
  }

  return success
}

// Enhanced interrupt and yielding functions for v3.0.0
export function setupMicroPythonAPI() {
  try {
    // Store interrupt function globally for easy access
    window.__ssg_interrupt_vm = interruptMicroPythonVM

    // User-friendly interrupt function
    window.interruptPython = function () {
      appendTerminal('🛑 Interrupting Python execution...', 'runtime')
      const success = interruptMicroPythonVM()
      if (!success) {
        appendTerminal('⚠️  Interrupt may not be fully supported. Try stopping and running again.', 'runtime')
      }
      return success
    }

    // Yielding control functions
    window.setMicroPythonYielding = function (enabled) {
      if (!runtimeAdapter) {
        console.log('❌ No runtime adapter available')
        return false
      }

      if (!runtimeAdapter.hasYieldingSupport) {
        console.log('❌ Runtime does not support yielding')
        return false
      }

      if (!runtimeAdapter.setYielding) {
        console.log('❌ setYielding function not available')
        return false
      }

      try {
        runtimeAdapter.setYielding(enabled)
        console.log(`✅ Yielding ${enabled ? 'enabled' : 'disabled'}`)
        window.__ssg_yielding_enabled = enabled
        return true
      } catch (err) {
        console.log('❌ Failed to set yielding:', err)
        return false
      }
    }

    // Clear interrupt state
    window.clearMicroPythonInterrupt = function () {
      try {
        // Clear execution state
        setExecutionRunning(false)
        if (window.__ssg_pending_input) delete window.__ssg_pending_input

        // Clear any abort controllers
        if (executionState.currentAbortController) {
          executionState.currentAbortController = null
        }
        if (executionState.timeoutId) {
          clearTimeout(executionState.timeoutId)
          executionState.timeoutId = null
        }

        // Try all available reset methods
        if (runtimeAdapter && runtimeAdapter.clearInterrupt) {
          runtimeAdapter.clearInterrupt()
          console.log('✅ v3.0.0 interrupt cleared')
        }

        // Re-enable yielding if available
        if (runtimeAdapter && runtimeAdapter.setYielding) {
          try {
            runtimeAdapter.setYielding(true)
            window.__ssg_yielding_enabled = true
            console.log('✅ Yielding re-enabled after interrupt clear')
          } catch (err) {
            window.__ssg_yielding_enabled = false
            console.log('❌ Failed to re-enable yielding:', err)
          }
        }

        console.log('✅ MicroPython interrupt state cleared')
        return true
      } catch (err) {
        console.log('❌ Failed to clear interrupt state:', err)
        return false
      }
    }

    // State clearing function to reset Python globals between runs
    window.clearMicroPythonState = function () {
      if (!runtimeAdapter || !runtimeAdapter._module) {
        console.log('❌ No runtime adapter or module available for state clearing')
        return false
      }

      try {
        // Access MicroPython instance globals
        const mpInstance = runtimeAdapter._module
        if (!mpInstance.globals || !mpInstance.globals.__dict__) {
          console.log('❌ Unable to access MicroPython globals.__dict__')
          return false
        }

        const globalsDict = mpInstance.globals.__dict__
        const builtins = ['__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__']
        
        // Get all keys and filter out built-ins
        const userKeys = Object.keys(globalsDict).filter(key => 
          !builtins.includes(key) && !key.startsWith('_')
        )

        // Delete user-defined variables
        let cleared = 0
        for (const key of userKeys) {
          try {
            delete globalsDict[key]
            cleared++
          } catch (err) {
            console.log(`❌ Failed to clear variable '${key}':`, err)
          }
        }

        console.log(`✅ Cleared ${cleared} user variables from Python globals`)
        return true
      } catch (err) {
        console.log('❌ Failed to clear MicroPython state:', err)
        return false
      }
    }

    // Status function to show what interrupt methods are available
    window.getMicroPythonInterruptStatus = function () {
      const status = {
        runtimeLoaded: !!runtimeAdapter,
        hasYieldingSupport: !!(runtimeAdapter?.hasYieldingSupport),
        hasLegacyInterrupt: !!(runtimeAdapter?._module?.ccall),
        isExecuting: executionState.isRunning,
        availableMethods: []
      }

      if (status.hasYieldingSupport) {
        status.availableMethods.push('v3.0.0 interruptExecution()')
      }
      if (status.hasLegacyInterrupt) {
        status.availableMethods.push('legacy mp_sched_keyboard_interrupt()')
      }
      if (status.availableMethods.length === 0) {
        status.availableMethods.push('AbortController (non-VM)')
      }

      console.log('MicroPython Interrupt Status:', status)
      return status
    }
  } catch (_e) { }
}

export function setRuntimeAdapter(adapter) {
  runtimeAdapter = adapter
}

export function getRuntimeAdapter() {
  return runtimeAdapter
}

export function getExecutionState() {
  return executionState
}
