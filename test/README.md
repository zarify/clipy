Interactive stdin test
=====================

This test demonstrates running the vendored MicroPython runtime inside a Web Worker so
the main page stays responsive while the runtime blocks waiting for input.

How to run
----------

1. Serve the repository root over HTTP (needed for WASM imports):

```bash
python -m http.server 8000
```

2. Open the test page in your browser:

http://localhost:8000/test/interactive_stdin_test.html

3. Use the UI:
- Click "Start program" to initialize and run the sample program inside a Worker.
- Type a line in the input box and click "Send" to deliver input to the running program.
- The terminal area will display stdout/stderr and worker status messages. The tick
  counter demonstrates the page remains responsive while the runtime runs.

Notes
-----
- SharedArrayBuffer is used to wake the Worker atomically (Atomics.wait/notify). Some
  browsers require cross-origin-isolation for SharedArrayBuffer to be available; if it is
  unavailable the Worker still runs but uses a non-blocking fallback.
- If you want to wire this into the main app, see `src/micropy_worker.js` and the
  modifications to `src/main.js` which run user code inside a Worker by default.

Browser (Playwright) tests
---------------------------

We include Playwright tests (Firefox only) to exercise UI and VFS behavior. These
are intended for local developer use (no CI required).

Start a static server at the repo root:

```bash
python -m http.server 8000
```

Run Playwright (Firefox):

```bash
npm run test:playwright
```

The tests live under `tests/` and include checks for tabs, file creation, autosave,
run persistence, and VFS mounting.
