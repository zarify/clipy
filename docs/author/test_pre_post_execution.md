# Test Pre and Post Execution

This feature allows test authors to include special setup (`__pre.py`) and verification (`__post.py`) files that execute before and after the user's main code during test execution. These files share the same Python runtime environment, enabling advanced test patterns like environment preparation and post-execution verification.

## Overview

When you include `__pre.py` and/or `__post.py` files in your test configuration:

1. **`__pre.py`** executes first (if present)
2. **`main.py`** (the user's code) executes second
3. **`__post.py`** executes last (if present)

All three files:
- Run in the same Python interpreter instance
- Share the same module namespace and runtime state
- Share the same stdin, stdout, and stderr streams
- Can import from each other (e.g., `__post.py` can `import main` - but generally shouldn't need to)

## When to Use This Feature

### Use `__pre.py` for:
- Setting random seeds for deterministic testing
- Initializing global state
- Configuring test environment
- Pre-loading data or resources

### Use `__post.py` for:
- Verifying function behavior by importing and/or calling user functions
- Checking variable values or types after execution
- Validating global state changes

## Configuration

Include `__pre.py` and/or `__post.py` in `files` section of your test:

```json
{
  "id": "test-with-files",
  "description": "Test with pre and post in files",
  "files": {
    "__pre.py": "import random\nrandom.seed(42)",
    "__post.py": "from main import result\nprint(f'Final result: {result}')"
  }
}
```

## Execution Behavior

### Shared Namespace

All three files share the same Python module namespace. Variables, functions, and classes defined in one file are accessible in subsequent files:

```python
# __pre.py
test_value = 42

# main.py (user code)
import __pre
print(__pre.test_value)  # Access pre-defined value

def my_function():
    return "Hello"

# __post.py
from main import my_function
print(my_function())  # Call user's function
```

### Stdin Consumption

The stdin stream is consumed sequentially across all three files:

```json
{
  "stdin": ["first", "second", "third"]
}
```

```python
# __pre.py
x = input()  # Receives "first"

# main.py
y = input()  # Receives "second"

# __post.py
z = input()  # Receives "third"
```

### Stdout and Stderr

All output from all three files is concatenated into single stdout and stderr streams. Test expectations match against the combined output:

```python
# __pre.py
print("Starting test")

# main.py
print("Running code")

# __post.py
print("Verification complete")

# Combined stdout: "Starting test\nRunning code\nVerification complete\n"
```

## Error Handling

### Pre-Execution Failures

If `__pre.py` fails:
- The test fails immediately
- `main.py` and `__post.py` do NOT execute
- **Author mode**: Shows detailed error with file name and traceback
- **User mode**: Shows generic message "Test configuration error. Please contact your instructor."

### Main Execution Failures

If `main.py` fails:
- The test fails (normal test failure)
- `__post.py` is still run

### Post-Execution Failures

If `__post.py` fails:
- The test fails
- **Author mode**: Shows detailed error with file name and traceback, notes if main also failed
- **User mode**: Shows generic message "Test configuration error. Please contact your instructor."

### Author vs User Mode

**Author mode** is detected when:
- The parent page is served from a `/author/` path, OR
- The parent page URL includes an `author` query parameter

Note: The detection checks the parent window's location (not the iframe's location) since tests run in an isolated iframe.

In author mode, failures in `__pre.py` show:
```
❌ Test setup failed (__pre.py)

Traceback (most recent call last):
  File "/__pre.py", line 2, in <module>
    import nonexistent
ImportError: no module named 'nonexistent'
```

In author mode, failures in `main.py` when using pre/post files show enhanced context:
```
⚠️  Test execution failed in main.py

📋 Execution context: __pre.py → main.py → __post.py
   ✓ __pre.py executed successfully
   ✗ main.py failed (see error below)
   ℹ️  __post.py was still executed but may have encountered issues due to main.py failure

──────────────────────────────────────────────────

Traceback (most recent call last):
  File "/main.py", line 2, in <module>
    result = __pre.test_var
AttributeError: module '__pre' has no attribute 'test_var'
```

In author mode, failures in `__post.py` show:
```
❌ Test verification failed (__post.py)

📋 Execution context: __pre.py → main.py → __post.py
   ✓ __pre.py executed successfully
   ✓ main.py executed successfully
   ✗ __post.py failed during verification

──────────────────────────────────────────────────

Traceback (most recent call last):
  File "/__post.py", line 1, in <module>
    from main import calculate
ImportError: cannot import name 'calculate'
```

In user mode, all configuration errors show the same generic message:
```
Test configuration error. Please contact your instructor.
```

This protects test infrastructure from student inspection while giving authors the debugging information they need.

## Common Patterns

### Pattern 1: Deterministic Random Testing

Test code that uses randomness with a fixed seed:

```json
{
  "id": "random-test",
  "description": "Test random number generation with fixed seed",
  "setup": {
    "/__pre.py": "import random\nrandom.seed(42)"
  },
  "expected_stdout": "Random numbers: 1, 4, 7"
}
```

```python
# main.py (user code)
import random
nums = [random.randint(1, 10) for _ in range(3)]
print(f"Random numbers: {', '.join(map(str, nums))}")
```

### Pattern 2: Function Verification

Verify that user-defined functions work correctly:

```json
{
  "id": "function-test",
  "description": "Verify calculate function",
  "setup": {
    "/__post.py": "from main import calculate\nresult = calculate(5, 3)\nif result != 8:\n    raise AssertionError(f'Expected 8, got {result}')\nprint('✓ Function works correctly')"
  },
  "expected_stdout": "✓ Function works correctly"
}
```

```python
# main.py (user code)
def calculate(a, b):
    return a + b
```

### Pattern 3: Type Checking

Verify that variables have the correct types:

```json
{
  "id": "type-test",
  "description": "Verify data types",
  "setup": {
    "/__post.py": "from main import numbers, total\nif not isinstance(numbers, list):\n    raise AssertionError('numbers must be a list')\nif not isinstance(total, int):\n    raise AssertionError('total must be an int')\nprint('✓ Types are correct')"
  },
  "expected_stdout": "✓ Types are correct"
}
```

```python
# main.py (user code)
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
```

### Pattern 4: State Verification

Check that global state or variables have expected values:

```json
{
  "id": "state-test",
  "description": "Verify counter state",
  "setup": {
    "/__post.py": "from main import counter\nprint(f'Final counter value: {counter}')\nif counter != 10:\n    raise AssertionError(f'Expected counter=10, got {counter}')"
  },
  "expected_stdout": {
    "type": "regex",
    "expression": "Final counter value: 10"
  }
}
```

```python
# main.py (user code)
counter = 0
for i in range(10):
    counter += 1
```

### Pattern 5: Exception Testing

Verify that functions raise expected exceptions:

```json
{
  "id": "exception-test",
  "description": "Verify exception handling",
  "setup": {
    "/__post.py": "from main import divide\ntry:\n    divide(10, 0)\n    raise AssertionError('Function should raise ZeroDivisionError')\nexcept ZeroDivisionError:\n    print('✓ Correctly raises ZeroDivisionError')"
  },
  "expected_stdout": "✓ Correctly raises ZeroDivisionError"
}
```

```python
# main.py (user code)
def divide(a, b):
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b
```

### Pattern 6: Multiple Input Verification

Verify function behavior with multiple test cases:

```json
{
  "id": "multiple-cases-test",
  "description": "Test function with multiple inputs",
  "setup": {
    "/__post.py": "from main import is_even\ntest_cases = [(2, True), (3, False), (0, True), (-4, True)]\nfor num, expected in test_cases:\n    result = is_even(num)\n    if result != expected:\n        raise AssertionError(f'is_even({num}) returned {result}, expected {expected}')\nprint('✓ All test cases passed')"
  },
  "expected_stdout": "✓ All test cases passed"
}
```

```python
# main.py (user code)
def is_even(n):
    return n % 2 == 0
```

## Best Practices

1. **Keep it Simple**: Use `__pre.py` and `__post.py` for specific test needs, not as a replacement for clear test design.
You might also need to test for program structure (e.g. with an AST test) prior to using `__post.py` tests to check for things like a specific function's definition.

2. **Fail Fast**: Use assertions in `__post.py` to provide clear error messages:
   ```python
   if result != expected:
       raise AssertionError(f"Expected {expected}, got {result}")
   ```

3. **Provide Feedback**: Print verification messages in `__post.py` for successful checks:
   ```python
   print("✓ Function behaves correctly")
   ```

4. **Avoid Side Effects**: Don't modify the user's code or global state in ways that could confuse test results.

5. **Test Incrementally**: Use multiple tests with different `__post.py` verifications rather than one complex verification script.

6. **Document Intent**: Use clear variable names and comments in `__post.py` so future maintainers understand the verification logic.

## Limitations

1. **Runtime Tests Only**: This feature only works with runtime tests (tests that execute Python code). It does not apply to AST tests that analyze code structure.

2. **Sandboxed Execution Only**: This feature only works in the sandboxed iframe-based test runner, not in the user's workspace runner.

3. **No State Reset**: The Python interpreter state is not reset between pre/main/post. If you need isolation, use separate test cases.

## Troubleshooting

### "Module not found" errors

If `__post.py` cannot import from `main.py`:
- Check that the user's code runs without syntax errors
- Remember that if `main.py` fails, `__post.py` still runs but imports may fail

### Stdin not working as expected

If stdin consumption seems wrong:
- Remember that stdin is consumed sequentially: pre → main → post
- Check that each file calls `input()` the expected number of times

### Tests passing when they should fail

If verification in `__post.py` isn't working:
- Ensure you're raising exceptions for failures, not just printing messages
- Check that your expected output matches the combined stdout from all files
- Verify your verification logic in author mode first

## Related Documentation

- [Test Basics](tests_basics.md) - General test configuration
- [AST Rules](ast_rules.md) - Code structure testing
- [Conditional Test Runs](tests_conditional_runs.md) - Test dependencies
- [Test Groups](tests_groups.md) - Organizing tests
