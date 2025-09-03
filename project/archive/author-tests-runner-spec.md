# Author Tests Runner Spec

Purpose

This document specifies a safe, isolated, and practical method for running author-provided tests in Clipy. It captures the design, data shapes, message protocol, failure modes, and an incremental implementation plan (Phase 1 = minimal iframe-based sandbox). Use this file as the canonical reference while we implement the sandboxed test runner.

## Requirements (short checklist)

- Isolate tests completely from the user so tests cannot modify editor state, the visible VFS, runtime, or terminal.
- Support the author test shapes and features described in `project/author_tests.md` (stdin support, per-test isolation, setup/main, expected stdout/stderr, timeouts).
- Provide robust watchdogs and recovery so a hung test or runtime interrupt doesn't leave the UI unusable.
- Allow integration with the existing `runTests(tests, { runFn })` API (i.e., produce a `runFn` backed by the sandbox).

## High-level approach

- Run tests in a sandboxed iframe (one iframe per test by default). The iframe loads a minimal harness page that loads the MicroPython runtime and an in-iframe harness script.
- Parent (main app) communicates with the iframe via `postMessage` using a small JSON protocol. The iframe reports stdout/stderr, requests stdin, and returns per-test results.
- Use per-test-per-iframe isolation by default for correctness. Optionally support per-run single-iframe + snapshot/restore for speed.
- Parent owns timeouts/watchdog logic and can destroy the iframe to recover from irrecoverable hangs.

Rationale for iframe vs alternatives

- Iframe provides real global isolation (separate JS globals, separate WASM instance and memory) and is simple to destroy & recreate.
- WebWorker-based approaches are possible but more complex when vendor `.mjs` loaders and wasm module initialization rely on DOM/script loading semantics; iframe is pragmatic and compatible across browsers.

## Files and new assets

- `project/author-tests-runner-spec.md` (this doc)
- `tests/runner.html` — minimal HTML loaded inside each iframe. Loads `tests/runner.js` and the same MicroPython loader used by the app (vendor runtime).
- `tests/runner.js` — harness that receives postMessage events, initializes runtime, runs tests and posts back streams and results.
- `src/js/test-runner-sandbox.js` — parent-side helper to create/destroy iframes and implement a `runFn(test)` that `runTests()` can consume.
- `src/js/test-runner-adapter.js` remains the same API contract but can be replaced by a sandbox-backed adapter during rollout.

## Message protocol (JSON shapes)

Parent -> iframe
- `{ type: 'init', files: {"/main.py": "...", ...}, config: {...}, runtimeUrl: '/vendor/micropython.mjs' }`
- `{ type: 'runTest', test: { id, main, setup, stdin, timeoutMs } }`
- `{ type: 'stdinResponse', value: '...' }`
- `{ type: 'terminate' }` — force-stop and cleanup.

Iframe -> Parent
- `{ type: 'ready' }` — runtime initialized
- `{ type: 'stdout'|'stderr'|'runtime'|'debug', text }` — streaming output events
- `{ type: 'stdinRequest', prompt?: string }` — runtime asked for input
- `{ type: 'testResult', id, stdout, stderr, durationMs, passed, reason? }` — per-test final result
- `{ type: 'error', error }` — unrecoverable iframe-side error
- `{ type: 'heartbeat' }` — optional for liveness

Notes
- All messages are JSON-serializable. Send large files only at `init` time or chunk them if necessary.
- Parent should validate origin & source of messages to avoid spoofing.

## Test data shape (per author test)

Align with `author_tests.md` and existing `runTests` usage:
```
{ id: string,
  description?: string,
  setup?: {"/some-lib.py": "..."},
  main?: string,
  stdin?: string | string[],
  expected_stdout?: string | { type: 'regex', expression: '...' },
  expected_stderr?: ...,
  timeoutMs?: number }
```

## Isolation policy options

- Strict (recommended): one iframe per test. Parent creates iframe, sends `init` with a snapshot of files, sends `runTest`, waits for `testResult`, then destroys iframe. Pros: foolproof isolation. Cons: startup overhead.
- Faster (optional): single iframe per test-run. Parent sends a `snapshot` then for each test writes test files into FS and runs, restoring snapshot between tests. Pros: faster. Cons: requires reliable snapshot/restore inside iframe.

Default: implement strict per-test-per-iframe first (Phase 1). Optimize later.

## Stdin handling

- Iframe signals `stdinRequest` to parent. Parent resolves from queued `test.stdin` values and posts `stdinResponse` immediately.
- Include a short fallback timeout inside the iframe (e.g., 20s): if no response arrives, resolve input as empty string and send a warning event to parent.

## Timeouts, watchdogs, and recovery

- Parent enforces per-test `timeoutMs` (from test or config). When timeout occurs:
  1. Parent posts an interrupt request (`postMessage({type:'interrupt'})`) — iframe tries to call `runtimeAdapter.interruptExecution()` if available.
  2. Wait a short grace period (e.g., 200–500ms) to let the runtime unwind.
  3. If still not done, parent destroys the iframe and returns `timeout` result for the test.
- Global watchdog: If iframe stops responding (no heartbeat) for X seconds, parent destroys and marks remaining tests as failed.

## Terminal & UI behavior

- Do not append test-run output to the visible terminal DOM. All test output streams should be displayed in the `Feedback` "Tests" UI only.
- While tests run, either hide terminal or keep it visible but unchanged. Avoid stealing focus from the user's editor.
- Tests UI should show progress, per-test stdout/stderr, and an Abort button that destroys the running iframe(s).

## Security

- Use `<iframe sandbox="allow-scripts allow-same-origin">` to isolate iframe. Limit capabilities.
- Only accept postMessage events from same-origin source.
- Prevent test code from calling parent functions — only JSON postMessage is allowed.

## Performance considerations

- Creating a MicroPython runtime per test can be expensive. Start with per-test iframes for correctness.
- If a suite is large, provide a per-run snapshot/restore optimization or a server-side test runner.

## Backwards compatibility

- Keep `runTests(tests, { runFn })` API same.
- Provide `createSandboxedRunFn(...)` that returns a compatible `runFn` using the sandbox.
- Make sandboxed mode feature-flagged with `window.__ssg_use_sandboxed_tests = true`.

## Implementation plan (Phase 1 = minimal runnable prototype)

Phase 1 goals
- Implement working per-test-per-iframe sandbox harness and parent adapter.
- Ensure tests run with stdin and return results; ensure the main app state remains unchanged.
- Add a Playwright spec that reproduces the user's flow and validates UI responsiveness.

Phase 1 steps
1. Add `tests/runner.html` and `tests/runner.js`.
   - `runner.html` loads `vendor/micropython.mjs` and `tests/runner.js`.
   - `tests/runner.js` listens for `init` and `runTest` messages. On `init` it loads the runtime and posts `ready`.
   - On `runTest` it writes files into an in-memory FS, runs the program (using runtimeAdapter.run/runPythonAsync), captures stdout/stderr, responds to `input` by posting `stdinRequest` and waiting for `stdinResponse`.
   - When done, post `testResult` with stdout/stderr/duration.
   - Implement an internal timeout fallback and try to clear asyncify state on interrupt if possible.

2. Add `src/js/test-runner-sandbox.js`.
   - API: `createSandboxedRunFn({ files, runtimeUrl, getConfig })` -> returns `runFn(test)`.
   - When called, it creates an iframe (hidden), posts `init` with files & runtimeUrl, waits for `ready`.
   - `runFn(test)` posts `runTest` to iframe and wires stdin responses from `test.stdin` queue.
   - Implements watchdog: if test times out or iframe stops responding, destroy iframe and return `timeout` result.

3. Wire `app.js` run-tests path behind a feature flag.
   - If sandbox flag is enabled, build `runFn` via sandbox helper and call `runTests(tests, { runFn })`.
   - Tests UI reads results and shows them; main terminal is not appended to.

4. Add tests
   - Node unit tests for `createSandboxedRunFn` using jsdom or Playwright headless.
   - Playwright E2E spec that runs tests in private Firefox and verifies UI remains responsive.

## Edge cases & gotchas

- Private mode IndexedDB / localStorage failures: sandbox should use in-memory runtime FS and avoid relying on persistent storage. Wrap any persistent backend writes with try/catch; do not allow them to throw to parent.
- Vendor runtime behavior: ensure `tests/runner.html` uses the same vendor loader as the app and that the runtime is initialized with input/stdio hooks.
- Large files may impact postMessage; for big repos use chunking or a temporary upload mechanism.
- Asyncify state: prefer `runtimeAdapter.interruptExecution()` when available; otherwise iframe destruction is required.

## API pseudo-code (parent)

```js
// create a sandbox-backed runFn for runTests
const runFn = createSandboxedRunFn({ files: snapshotFiles, runtimeUrl: '/vendor/micropython.mjs' })
const results = await runTests(tests, { runFn })
```

Internal `createSandboxedRunFn` behavior

- create iframe -> wait for `ready`
- for each test:
  - post `runTest`
  - handle `stdinRequest` by posting `stdinResponse` from queued values
  - accumulate stdout/stderr messages until `testResult` or timeout
  - return result
- destroy iframe when finished

## Acceptance tests (smoke)

- Run a test that uses `input()` and assert the test result contains the provided stdin value.
- Run a deliberately hung test and assert the watchdog fires and UI remains responsive (no stuck modal or blocked tabs).
- Run in Firefox private mode and assert the app doesn't show "out of memory" and tests are cleaned up properly.

## Rollout & feature gating

- Implement behind `window.__ssg_use_sandboxed_tests` flag.
- Merge to a feature branch and run Playwright tests (including private-mode reproduction) before toggling default.

## Next steps (if you want me to implement Phase 1)

- I can implement `tests/runner.html` + `tests/runner.js` and `src/js/test-runner-sandbox.js` with a per-test-per-iframe runner and wire `app.js` behind a feature flag.
- I will also add a Playwright spec that runs the four steps you requested (open Feedback, click Run tests, try to click Terminal/Instructions) using private Firefox to validate the fix.

---

End of spec.
