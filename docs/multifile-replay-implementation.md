# Multi-File Record-Replay Feature Implementation

## Summary

Fixed the record-replay debugging feature to support tracing execution across multiple Python files in a student's workspace. Previously, only execution in `main.py` was visible during replay. Now, when students import and call functions from other Python files (e.g., `dice.py`), the replay system automatically switches to show execution in those files.

## Problem

When using workspaces with multiple files (e.g., `main.py` importing from `dice.py`), the record-replay feature only showed basic information:

```
Line 1: roll = <function roll at 0x28bf0>
Line 4: roll = <function roll at 0x28bf0>
Line 4: roll = <function roll at 0x28bf0>
```

Students and instructors couldn't see what happened inside imported modules, making it impossible to debug multi-file programs effectively.

## Solution

### 1. Extended ExecutionStep to Include Filename

**File:** `src/js/execution-recorder.js`

- Added `filename` parameter to `ExecutionStep` constructor
- Updated `recordStep()` method to accept and store filename
- Updated execution hooks to pass filename through the recording chain

```javascript
export class ExecutionStep {
    constructor(lineNumber, variables = new Map(), scope = 'global', timestamp = null, filename = null) {
        this.lineNumber = lineNumber
        this.variables = variables
        this.scope = scope
        this.timestamp = timestamp || performance.now()
        this.stackDepth = 0
        this.executionType = 'line'
        this.filename = filename || '/main.py'  // NEW: Track which file
    }
}
```

### 2. Updated Instrumentor to Track Filename

**File:** `src/js/python-instrumentor.js`

- Modified `instrumentCode()` to accept `filename` parameter
- Updated injected Python tracing code to include filename in trace data
- Modified `_trace_execution()` to accept and pass filename
- Updated JavaScript callback to extract and forward filename

```python
# Injected into each instrumented file
_trace_filename = "/dice.py"  # File-specific

def _trace_execution(line_no, vars_dict, filename):
    # ... trace code includes filename in JSON output
    trace_data = {"__TRACE__": {"line": line_no, "vars": vars_dict, "file": filename}}
```

### 3. Instrumented All Workspace Python Files

**File:** `src/js/execution.js`

- Created new `instrumentAllPythonFiles()` function
- Modified `syncVFSBeforeRun()` to instrument all `.py` files except `main.py`
- `main.py` is still instrumented separately (handles transformations properly)
- Each file gets its own instrumentation with the correct filename

```javascript
async function instrumentAllPythonFiles(recordingEnabled, recorder, currentRuntimeAdapter) {
    const files = FileManager.list()
    const pythonFiles = files.filter(f => f.endsWith('.py') && f !== MAIN_FILE)
    
    for (const filepath of pythonFiles) {
        const sourceCode = FileManager.read(filepath)
        const instrResult = await instrumentor.instrumentCode(sourceCode, currentRuntimeAdapter, filepath)
        fs.writeFile(filepath, instrResult.code)  // Write instrumented version
    }
}
```

### 4. Updated Trace Parsing

**File:** `src/js/micropython.js`

- Modified trace JSON parsing to extract `file` field
- Updated `recordExecutionStep()` to accept and forward filename
- Ensured backward compatibility with old trace format (defaults to `/main.py`)

```javascript
if (traceData.__TRACE__) {
    const { line, vars, file } = traceData.__TRACE__
    const filename = file || '/main.py'
    recordExecutionStep(line, variables, 'traced', filename)
}
```

### 5. Enhanced Replay UI for Multi-File Support

**File:** `src/js/replay-ui.js`

- Added `currentFilename` tracking to `ReplayEngine`
- Created `switchToFile()` method to change tabs during replay
- Modified `displayCurrentStep()` to switch tabs when step is from a different file
- Integrates with existing `TabManager` for seamless tab switching

```javascript
displayCurrentStep() {
    const step = this.executionTrace.getStep(this.currentStepIndex)
    
    // Switch to the file if needed
    if (step.filename && step.filename !== this.currentFilename) {
        this.switchToFile(step.filename)
    }
    
    // Show execution line and variables in the correct file
    this.lineDecorator.highlightExecutionLine(step.lineNumber)
    this.lineDecorator.showVariablesAtLine(step.lineNumber, step.variables)
}
```

## Test Case

### Example Workspace

**main.py:**
```python
from dice import roll

for i in range(3):
    print(roll(3))
```

**dice.py:**
```python
import random
random.seed(42)

def roll(n):
    rolls = [random.randint(1, 6) for i in range(n)]
    return rolls
```

### Expected Replay Behavior

1. **Step 1 (main.py:1):** Import statement, shows `roll` function
2. **Step 2 (dice.py:1):** *Tab switches to dice.py*, shows `import random`
3. **Step 3 (dice.py:2):** Shows `random.seed(42)` execution
4. **Step 4 (dice.py:4-6):** Shows function definition
5. **Step 5 (main.py:3):** *Tab switches back to main.py*, shows loop start
6. **Step 6 (dice.py:5):** *Tab switches to dice.py*, shows inside `roll()` function with variables
7. **Step 7 (main.py:4):** *Tab switches back*, shows print statement

The replay seamlessly moves between files as execution flows through them!

## Files Changed

1. **src/js/execution-recorder.js** - Extended ExecutionStep with filename
2. **src/js/python-instrumentor.js** - Updated to track and pass filename
3. **src/js/execution.js** - Instruments all workspace Python files
4. **src/js/replay-ui.js** - Auto-switches tabs during replay
5. **src/js/micropython.js** - Updated trace parsing for filename

## Testing

- ✅ All existing record-replay tests pass
- ✅ Backward compatible (old traces without filename still work)
- ✅ Test file created: `test-multifile-replay.html`

## Benefits

1. **Complete Visibility:** Instructors can see execution flow across all student files
2. **Better Debugging:** Students can trace into their own imported modules
3. **Seamless UX:** Tab switching is automatic and follows execution flow
4. **Scalable:** Works with any number of Python files in the workspace

## Future Enhancements

Potential improvements for the future:
- Show call stack in the replay UI
- Highlight the calling line when execution is in another file
- Support for filtering by filename in replay
- Breadcrumb trail showing file execution history
