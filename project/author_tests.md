## Authoring program tests (Clipy)

This document explains the kinds of program-level tests you can add to a configuration and how the built-in test runner executes them.

### Where to put tests

Add an array of test objects to your configuration under `tests`. The Run-tests UI button and the programmatic runner will pick them up from `window.Config.current.tests`.

### Test object shape (minimal)

Each test is a plain object. Minimal example:

```
{
  id: 't1',
  description: 'simple echo test',
  setup: { '/helper.py': 'def f(): return 1' },
  main: "print(input())",       // optional; writes to /main.py
  stdin: 'Alice',                // string or array
  expected_stdout: 'Alice',      // string include or regex/object
  expected_stderr: null,         // optional
  timeoutMs: 30000              // optional per-test timeout
}
```

Key fields explained:
- `id` (recommended): stable identifier used in UI and results.
- `description`: human-friendly label shown in the Feedback UI.
- `setup`: optional object mapping file paths -> contents. These files are written before the test runs.
- `main`: optional string to write into `/main.py` for the test run (overrides current MAIN_FILE during the run).
- `stdin`: optional. Can be a string (split on newlines) or an array of strings. Values are fed to the program in order when the runtime requests input.
- `expected_stdout` / `expected_stderr`: optional expectations. Accepts:
  - plain string (assert the captured output includes this substring)
  - an object `{ type: 'regex', expression: '...', flags: '' }` (runner converts to RegExp)
  - a RegExp if constructing tests programmatically
- `timeoutMs`: optional per-test timeout (runner will mark `reason: 'timeout'` if exceeded).

### How stdin is handled

- The runner watches for the runtime to request input via the established `window.__ssg_pending_input` contract and resolves it in FIFO order using the values from `stdin`.
- If the program prompts fewer times than number of values provided, extra values are ignored.
- If the program prompts more times than provided values, remaining prompts receive the empty string.
- Optionally your runtime can check `promptText` to assert that a particular prompt was shown (the runner/executor can surface prompt text when available).

### Isolation and side-effects

- Before a test run the adapter snapshots the current FileManager (file list and contents) and restores it when the test finishes. This keeps the authoring workspace unchanged after tests.
- Notifier suppression is used while mutating files to avoid triggering UI echo/save loops.
- Caveat: concurrent snapshot saves initiated by the user while a test is running could capture transient test files. For absolute isolation consider using an ephemeral in-memory backend (future enhancement).

### What the runner returns

Each test result object includes at least:

```
{ id, description, passed: true|false, stdout, stderr, durationMs, reason }
```

- `passed` true when all supplied expectations matched.
- `reason` can be `'timeout'`, `'mismatch'`, `'setup_failed'`, or `'error'`.

### Example config fragment

```
tests: [
  { id: 'echo', description: 'echo input', main: "print(input())", stdin: 'Bob', expected_stdout: 'Bob' }
]
```

### Triggering tests

- The Feedback UI contains a "Run tests" control. Clicking it runs `window.Config.current.tests` and updates the Test results section.
- Programmatically the runner is available via the adapter factory exported in `src/js/test-runner-adapter.js` and `src/js/test-runner.js`.

---
See also: `src/js/test-runner.js` and `src/js/test-runner-adapter.js` for implementation details and options.
