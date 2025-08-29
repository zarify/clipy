````markdown
## Authoring program tests (Clipy)

This document describes the current author-tests contract and the runtime/host behaviour implemented by the built-in test runner.

### Where to put tests

Add an array of test objects to your configuration under `tests`. The Feedback UI and the programmatic runner read tests from `window.Config.current.tests`.

### High-level changes (what's new)

- Tests now run in a per-test sandboxed iframe to guarantee isolation of the VM and its global state.
- Stdout/stderr are streamed from the iframe to the host during test execution (live updates in the Feedback UI).
- Stdin is handled via an explicit postMessage handshake (`stdinRequest` / `stdinResponse`).
- Files in `setup` / `files` are written directly into the runtime FS before the test runs; inline `main` content is written to `/main.py` so tracebacks reference that filename.
- The harness is defensive about traceback delivery: tracebacks delivered via stdout are heuristically moved to stderr, and rejected runtime promises are captured and forwarded as stderr (noisy wrapper lines like `File \"<stdin>\"` are filtered).

### Test object shape (minimal)

Each test is a plain object. Minimal example:

```
{
  id: 't1',
  description: 'simple echo test',
  setup: { '/helper.py': 'def f(): return 1' },
  files: { '/lib.py': '...' },        // optional files written into runtime FS
  main: "print(input())",           // optional; written to /main.py for the run
  stdin: 'Alice',                    // string (split on newlines) or array of strings
  expected_stdout: 'Alice',          // string include or regex/object
  expected_stderr: null,             // optional
  timeoutMs: 30000,                  // optional per-test timeout
  show_stderr: false                 // optional author flag: when true host may render stderr
}
```

Key fields explained:
- `id`: stable identifier used in the UI and test results.
- `description`: human label shown in the Feedback UI.
- `setup` / `files`: objects mapping file paths -> contents. These are written into the runtime filesystem before the test runs.
- `main`: an inline program string written to `/main.py` for the test run (this keeps tracebacks referring to `/main.py`).
- `stdin`: optional. Can be a single string (split on newlines) or an array of strings. Values are fed to the runtime in order when it requests input.
- `expected_stdout` / `expected_stderr`: optional expectations. Accepts:
  - plain string (assert the captured output includes this substring)
  - an object `{ type: 'regex', expression: '...', flags: '' }` (runner converts to RegExp)
  - a RegExp when constructing tests programmatically
- `timeoutMs`: optional per-test timeout; the runner will mark `reason: 'timeout'` if exceeded.
- `show_stderr`: optional author hint (boolean). When false the UI hides stderr by default; when true the host may render it. (`show_stdout` opt-in is a planned enhancement.)

### Messaging / runtime handshake

The sandboxed test iframe and the host communicate using postMessage. The main message types are:

- `init` — host → iframe: initialize runtime; payload may include `runtimeUrl` (default `/vendor/micropython.mjs`) and an initial `files` snapshot.
- `loaded` / `ready` — iframe → host: lifecycle notifications.
- `runTest` — host → iframe: run the supplied test object.
- `stdinRequest` — iframe → host: runtime requested input (includes optional `prompt`).
- `stdinResponse` — host → iframe: reply to a pending stdin request with `value`.
- `stdout` / `stderr` — iframe → host: streamed output chunks as the runtime produces them.
- `testResult` — iframe → host: final per-test result object `{ id, passed, stdout, stderr, durationMs, reason? }`.
- `error` — iframe → host: non-test-level errors (load/timeout/etc.).

The host-side sandbox orchestration creates one iframe per test run, forwards streamed `stdout`/`stderr` to the Feedback UI, replies to `stdinRequest` messages with `stdinResponse`, and tears down the iframe after the test finishes.

### How stdin works (details)

- When the runtime requests input the iframe posts `stdinRequest` to the parent. The host resolves the next value from `test.stdin` (FIFO). The host replies with `stdinResponse` containing `{ value: '...' }`.
- If `stdin` is a single string it is split on newlines before use. Extra provided values are ignored; if the program requests more values than provided, remaining requests receive the empty string.

### Streaming stdout/stderr and chunk assembly

- The iframe posts `stdout` and `stderr` messages incrementally as the runtime emits output. The host appends each chunk into a per-test stream buffer and updates the Feedback UI live.
- To preserve line boundaries across chunked writes the runner and host use an assembly heuristic: if any chunk contains a newline, chunks are concatenated verbatim; otherwise a single `\n` is inserted between chunks. This reduces spurious line-joining when the runtime produces multiple small chunks.

### Tracebacks and stderr handling

- MicroPython runtimes differ: some send tracebacks to stderr, some to stdout, and some surface them via rejected promises. The harness uses multiple strategies to ensure tracebacks are visible in the host:
  - If stderr is empty but stdout contains a recognizable traceback prefix (e.g. `Traceback`), the harness moves the traceback portion into `stderr` before returning results.
  - Errors delivered as rejected promises are captured in the iframe, converted to text, filtered to drop wrapper noise (for example lines referencing `File \"<stdin>\"`), streamed to the host as `stderr` chunks, and then rethrown/handled so the test result marks failure.

### File isolation and cleanup

- Before running a test the harness writes `setup` and `files` into the runtime filesystem. If a `main` string is provided it is written to `/main.py` so tracebacks reference that file.
- The host wrapper snapshots the editor/filemanager state and restores it after the test run to avoid leaving transient test files in the author's workspace.

### Test result shape

Each test result object includes at least:

```
{ id, description?, passed: true|false, stdout, stderr, durationMs, reason? }
```

- `passed` is true when all supplied expectations matched. `reason` can be `'timeout'`, `'mismatch'`, `'setup_failed'`, or `'error'`.

### Host UI hooks (integration points)

The test-run sandbox forwards streamed output and results into the Feedback UI via small global hooks the UI exposes. Current hooks used by the harness include:

- `window.__ssg_append_test_output({ id, type: 'stdout'|'stderr', text })` — append a streamed chunk for a running test.
- `window.__ssg_set_test_results(results)` — set/replace the full test-results list.
- `window.__ssg_set_feedback_config(cfg)` — set feedback UI config (author flags like `show_stderr`).
- `window.__ssg_show_test_results()` / `window.__ssg_show_test_results_loading()` / `window.__ssg_close_test_results()` — modal helpers.

Hosts embedding the runner may implement these hooks differently; the default Feedback UI listens for streamed chunks and updates the test-results modal live.

### Triggering tests

- The Feedback UI's "Run tests" control runs `window.Config.current.tests`. The Run button is disabled when no tests are present.
- Programmatic runners are available under `src/js/test-runner.js` and the sandbox orchestration is implemented in `src/js/test-runner-sandbox.js`.

---
See also: `src/tests/runner.js`, `src/js/test-runner-sandbox.js`, and `src/js/feedback-ui.js` for the current implementation details and message contracts.

````
