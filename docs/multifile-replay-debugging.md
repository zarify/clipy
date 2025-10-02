# Multi-File Replay Debugging Guide

## Problem Summary

The multi-file replay feature wasn't working because:
1. **Instrumented files were being overwritten** - The VFS mount operation was overwriting the instrumented Python files with the original uninstrumented versions
2. **File switching logic was correct** but had no instrumented files to switch to

## The Fix

Moved the `instrumentAllPythonFiles()` call to AFTER the VFS mount operation:

**Before:**
```javascript
// Write files to runtime FS (uninstrumented)
// Instrument files in runtime FS ✅
// Mount VFS (overwrites instrumented files!) ❌
```

**After:**
```javascript
// Write files to runtime FS (uninstrumented)
// Mount VFS
// Instrument files in runtime FS (now they stay!) ✅
```

## How to Test

### 1. Create Test Workspace

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

### 2. Enable Debug Terminal

Open the browser developer console to see debug messages.

### 3. Run the Code

Click "Run" and watch the terminal debug output. You should see:

```
[DEBUG] Found 1 Python files to instrument (excluding /main.py): /dice.py
[DEBUG] Instrumenting /dice.py...
[DEBUG] Successfully instrumented and wrote /dice.py to runtime FS
[DEBUG] Finished instrumenting all Python files
```

### 4. Start Replay

After execution completes, click "Start Replay". You should see:

```
[DEBUG] Recorded step 1: line 1 in /main.py, 0 vars
[DEBUG] Recorded step 2: line 1 in /dice.py, 0 vars  <-- Now in dice.py!
[DEBUG] Recorded step 3: line 2 in /dice.py, 1 vars
[DEBUG] Recorded step 4: line 4 in /dice.py, 1 vars
[DEBUG] Recorded step 5: line 3 in /main.py, 2 vars
[DEBUG] Recorded step 6: line 5 in /dice.py, 2 vars  <-- Back in dice.py!
...
```

### 5. Step Through Replay

Use the step forward/backward buttons. Watch for:

```
[DEBUG] Displaying step 0: line 1 in /main.py
[DEBUG] Displaying step 1: line 1 in /dice.py
[DEBUG] Switching to file: /dice.py  <-- Tab should switch!
[DEBUG] Displaying step 2: line 2 in /dice.py
...
```

## Expected Behavior

### Replay Steps Should Show:

1. **Step 1 (main.py:1):** `from dice import roll`
   - Tab: **main.py**
   - Variables: `roll` = `<function>`

2. **Step 2 (dice.py:1):** `import random`
   - Tab switches to: **dice.py** ✨
   - Variables: `random` = `<module>`

3. **Step 3 (dice.py:2):** `random.seed(42)`
   - Tab: **dice.py**
   - Variables: `random` = `<module>`

4. **Step 4 (dice.py:4-6):** Function definition
   - Tab: **dice.py**
   - Variables: `roll` = `<function>`, `random` = `<module>`

5. **Step 5 (main.py:3):** `for i in range(3):`
   - Tab switches to: **main.py** ✨
   - Variables: `i` = `0`, `roll` = `<function>`

6. **Step 6 (dice.py:5):** Inside `roll()` function
   - Tab switches to: **dice.py** ✨
   - Variables: `n` = `3`, `rolls` = `[...]`

7. **Step 7 (main.py:4):** `print(roll(3))`
   - Tab switches to: **main.py** ✨
   - Variables: `i` = `0`, `roll` = `<function>`

And so on...

## Troubleshooting

### If You Still See Only main.py Steps:

1. **Check Debug Output** - Look for:
   ```
   [DEBUG] Found 0 Python files to instrument
   ```
   This means `dice.py` isn't in the FileManager.

2. **Verify File Exists** - Make sure `dice.py` is actually created and saved in the workspace.

3. **Check Recording is Enabled** - Look for:
   ```
   [DEBUG] Execution recording enabled for this run
   ```

4. **Check Instrumentation** - Look for:
   ```
   [DEBUG] Instrumenting /dice.py...
   [DEBUG] Successfully instrumented and wrote /dice.py to runtime FS
   ```

### If Tabs Don't Switch:

1. **Check TabManager** - Look for:
   ```
   [DEBUG] Switching to file: /dice.py
   ```
   
2. **Verify TabManager.selectTab exists** - In browser console:
   ```javascript
   window.TabManager && window.TabManager.selectTab
   ```
   Should return a function.

3. **Check if tab exists** - The file must have an open tab to switch to it.

## Debug Commands

Run these in the browser console:

```javascript
// Check if recording has multi-file steps
window.ExecutionRecorder.getTrace().steps.map(s => s.filename)

// Should show array with both /main.py and /dice.py

// Check step count
window.ExecutionRecorder.getTrace().getStepCount()

// Should be > 4 (not just the 4 steps you were seeing)

// Check TabManager
window.TabManager

// Should exist and have selectTab method
```

## Success Criteria

✅ Debug output shows instrumentation of `dice.py`
✅ Recording shows steps from both files
✅ Replay automatically switches tabs
✅ Line highlights appear in the correct file
✅ Variables are shown for each step
✅ Can step through execution across files seamlessly
