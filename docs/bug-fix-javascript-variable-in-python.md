# Bug Fix: JavaScript Variable in Python Code

## Issue

After implementing multi-file replay support, there was a bug where JavaScript variable names were appearing in the generated Python code, causing a `NameError`:

```
Traceback (most recent call last):
  File "/main.py", line 11, in <module>
  File "/main.py", line 219, in roll
NameError: name 'originalLineNumber' isn't defined
```

## Root Cause

In the Python instrumentor (`src/js/python-instrumentor.js`), when generating Python f-strings for error messages, I incorrectly used the JavaScript template literal syntax `${originalLineNumber}` inside the Python f-string.

**Incorrect code:**
```javascript
instrumentedLines.push(`${indent}    print(f"[TRACE CAPTURE ERROR] Line ${originalLineNumber}: {_trace_err}")`)
```

This generated invalid Python code like:
```python
print(f"[TRACE CAPTURE ERROR] Line originalLineNumber: {_trace_err}")
```

The variable `originalLineNumber` is a JavaScript variable (the loop counter), not a Python variable.

## Solution

The Python f-string should have the actual numeric value interpolated by the JavaScript template literal, not try to reference a JavaScript variable name. The JavaScript template literal interpolation happens OUTSIDE the Python f-string.

**Correct code:**
```javascript
instrumentedLines.push(`${indent}    print(f"[TRACE CAPTURE ERROR] Line ${originalLineNumber}: {_trace_err}")`)
```

This generates valid Python code:
```python
print(f"[TRACE CAPTURE ERROR] Line 5: {_trace_err}")  # where 5 is the actual line number
```

## Additional Issue Found

While fixing this, I also discovered that one of the `_trace_execution()` calls (in the return statement handling) was missing the `_trace_filename` parameter.

**Fixed:**
```javascript
instrumentedLines.push(`${indent}    _trace_execution(${originalLineNumber}, _trace_vars, _trace_filename)`)
```

## Files Changed

- `src/js/python-instrumentor.js` - Fixed f-string interpolation in 2 locations and added missing `_trace_filename` parameter in 1 location

## Testing

- ✅ All existing unit tests pass (16/16)
- ✅ Created verification test (`test-instrumentation-fix.js`) that confirms:
  - No JavaScript variable names in generated Python code
  - All `_trace_execution()` calls include the `_trace_filename` parameter
  - Generated Python code is syntactically correct

## Lesson Learned

When generating code in one language (Python) from another language (JavaScript), be very careful about:
1. Template literal boundaries
2. Which variables belong to which language context
3. When variable names vs values should be used
