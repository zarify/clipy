# Notes: Client-side Python Playground

Date: 2025-08-19

These are my notes and clarifying questions based on the project instructions in `overview.md`.

## Extracted requirements (checklist)

- [ ] Entirely client-side web page; no server-backed runtime (libraries may be loaded remotely)
- [ ] Must work when served statically or opened from local filesystem
- [ ] UI components:
  - [ ] CodeMirror editor with local browser storage and version history
  - [ ] Python runtime (WASM), optionally MicroPython for faster load
  - [ ] Terminal area for IO
  - [ ] Instructions area (supports images/videos/attachments)
  - [ ] Feedback mechanism (static analysis and regex/pattern matching)
- [ ] Configuration via JSON in `src/config` with:
  - [ ] config version
  - [ ] starter code
  - [ ] scenario instructions
  - [ ] links/attachments
  - [ ] feedback rules (static analysis)
  - [ ] feedback rules (regex/patterns)
- [ ] Project layout rules:
  - [ ] All web and config files in `src`
  - [ ] Config files in `src/config`
  - [ ] `project/completed.md` must list implemented features
  - [ ] `test` folder for automated tests
  - [ ] `test/tests.md` describes tests and coverage
  - [ ] `test/untested.md` lists what's not covered and manual test notes
  - [ ] Keep `project` folder for project notes only; only necessary files in `src`

Status: all items above are recorded; implementation decisions and priorities need your confirmation.

## Clarifying questions (please answer so I can start implementation)

1. Which Python runtime do you prefer initially: full CPython-in-WASM (e.g., Pyodide) or MicroPython-in-WASM (smaller, faster but limited stdlib)?
2. Do you have a preferred static-analysis toolset or rule language for the feedback mechanism (e.g., AST rules in JS/TS, a Python-based linter shipped in WASM, or custom matchers)?
3. How should versioned editor history be exposed in the UI? (simple autosave + undo stack, named snapshots, or full commit-like history?)
4. Are attachments referenced in config expected to be stored alongside `src` (e.g., `src/assets`) or may be external links?
5. Do you need offline-first behaviour beyond working from the filesystem (e.g., Service Worker caching, asset prefetching)?
6. Target browsers / minimum supported feature set (e.g., old IE not supported obviously) and any constraints (mobile vs desktop)?
7. Do you want tests to run in CI (GitHub Actions) or only locally/manual? Any preferences for test frameworks? (e.g., Playwright for browser e2e, Jest, pytest)
8. Any accessibility (a11y) or localization requirements to consider from the start?

## Assumptions I'm making (tell me if any are wrong)

- The project will be a small static site served from `src` (HTML/CSS/JS) and not a framework-specific app unless you request one.
- CodeMirror will be used as the in-browser editor (as mentioned) and runtime will be loaded as a WASM bundle from a CDN or `src/vendor`.
- Initial implementation will prioritise a minimal working demo (editor, runtime, terminal, config load) before adding advanced features (history UI, elaborate static analysis).

## Next steps (what I'll do after you answer the questions)

1. Confirm runtime choice and feedback approach.
2. Create an initial `src` scaffold with a minimal HTML page, CodeMirror editor, and WASM runtime loader.
3. Implement config loader reading JSON from `src/config` and wire starter code + instructions.
4. Add simple feedback rule evaluation (regex-based) and a placeholder for static-analysis rules.
5. Add minimal automated tests (smoke tests) and update `project/completed.md` as features are implemented.

---

## Current status update (2025-08-19)

- Implemented editor UI and CodeMirror integration with autosave and snapshot commits.
- Implemented runtime loader that prefers local vendored MicroPython ESM and falls back to an inline module bridge.
- Implemented a runtime adapter that initializes MicroPython via its `loadMicroPython` API when available and exposes a uniform `run(code, input)` method.
- Fixed output decoding (TextDecoder) and newline normalization to present runtime prints correctly in the in-page terminal.
- Implemented regex-based feedback rules; AST-based rules are still a placeholder.
- Added basic smoke tests (`test/test_smoke.py`, `test/test_storage.js`) and storage adapter (`src/lib/storage.js`).

## Short-term next steps

1. Decide whether to gate diagnostic logs (e.g., `Bridge exports:`) behind a `config.debug` flag. I recommend enabling the flag during development and disabling it for production builds.
2. Add a small Playwright e2e test that starts a static server, opens `src/index.html`, clicks Run, and asserts terminal output; this prevents regressions in runtime boot and basic execution.
3. Decide AST approach for feedback: JS-side AST visitor vs WASM/Python AST in the runtime. I can implement a minimal JS AST rule engine quickly if you prefer.

If you want, I can implement any of the short-term next steps now — tell me which and I will proceed.

---

## New requested features (user request)

Two features to add to the roadmap and implementation notes:

- Interactive user input support: programs can call Python's `input()` and receive text entered by the user in the page UI (the terminal or a modal). Current behaviour blocks or locks the page in some cases because the default runtime prompt is synchronous.
- Virtual filesystem: a small in-memory filesystem (backed by the runtime's `FS`) so student programs can open/read/write files (and optionally persist them to `localStorage` or IndexedDB between runs).

Below are recommended approaches, tradeoffs, and a small implementation contract for each feature.

### 1) Interactive input (stdin) — problem and recommended solutions

Problem: many WASM runtimes and Emscripten-based builds expect a synchronous `stdin` provider. Browser-native prompts (window.prompt) are blocking and freeze the page, which is a poor UX. We need a way to supply input to the runtime without freezing the UI and to support both single-shot (one or more pre-supplied inputs) and interactive console-style input.

Two recommended approaches (pragmatic -> advanced):

- A. Pre-prompt (robust, simplest)
  - Behaviour: Before running, scan the student's code for uses of `input(` (simple regex or AST). If any are found, show a non-blocking modal that asks the user to provide one (or multiple) input lines. Buffer the provided input(s) and inject them synchronously into the runtime's `stdin` implementation (a simple char queue) before starting execution.
  - Why: This avoids runtime blocking and works reliably with synchronous WASM syscalls because the runtime will see an already-filled buffer and will not attempt to call window.prompt.
  - Implementation sketch:
    - Provide an `inputQueue = []` and a synchronous `stdin()` callback passed to `loadMicroPython({ stdin })` where `stdin()` returns the next character (or -1/null for EOF) from the queue.
    - When user supplies text (e.g., via a modal), push characters (including a trailing `\n`) into `inputQueue`.
    - When runtime runs, its synchronous reads will drain `inputQueue` and proceed normally.
  - Tradeoffs: Input must be provided ahead of blocking reads; not fully interactive (you can't type mid-run in response to a runtime prompt), but it is simple and reliable.

- B. Interactive streaming stdin (advanced, better UX)
  - Behaviour: Provide a terminal UI that can accept user input while the program executes. When the runtime reads from stdin and the queue is empty, the runtime needs a way to pause and wait for user input without freezing the UI; once the user types, the runtime receives characters and continues.
  - Technical summary: This requires the runtime to be built/used with an async-friendly syscall strategy (e.g., Emscripten Asyncify or an emscripten-friendly `stdin` hook that cooperates with runPythonAsync). The general pattern is:
    1. Provide a synchronous `stdin` implementation that checks a queue; if empty, it triggers a JS-level pause or yields control by using the runtime's async/continuation hooks (only works if the runtime supports asyncify/async runner).
    2. Show the input prompt in the page UI (not window.prompt), wait for the user to type, push chars into the queue, and then resume the runtime's continuation.
  - Implementation complexity: Moderate to high. It depends on how the vendored MicroPython was built (asyncify enabled vs not). If `runPythonAsync` truly supports asynchronous syscalls, this can be done without freezing the page. If not, it is fragile or impossible without rebuilding the runtime with asyncify.
  - When to choose: choose this only if you want a true interactive console and are willing to confirm (or rebuild) the runtime with the necessary flags.

Recommendation: implement A (pre-prompt) immediately to unblock classrooms; plan B as a medium-term improvement if you want live interactivity.

Edge cases and notes for input handling

- Multi-line input: Always append a trailing `\n` to user-supplied lines so `input()` returns expected text.
- Multiple `input()` calls: allow the modal to accept multiple lines or loop the modal until the buffer is filled (UI choice).
- Timeouts: consider adding a runtime-side timeout or max-length to avoid runaway memory if students paste huge input.
- Blocking detection: if the runtime still blocks, add diagnostics (console + terminal logs) to detect whether the runtime invoked `window.prompt` or used Module.stdin directly.

### Implementation contract for input (pre-prompt)

- Inputs: code text (string), optional `providedInput` string or array-of-lines from the modal UI.
- Outputs: runtime stdout/stderr captured and shown in the terminal; `input()` calls return provided lines in order.
- Error modes: if fewer lines are supplied than `input()` calls, subsequent `input()` returns EOF (raises `EOFError` in Python) or empty string depending on runtime; we should document this behaviour.

### 2) Virtual filesystem (VFS)

Goal: allow student programs to open/read/write files under POSIX-like paths so exercises can include reading data files, saving output, and using file-based tasks.

Approach (straightforward):

- Use the runtime's `Module.FS` (Emscripten virtual FS) exposed via the MicroPython module instance returned by `loadMicroPython`. The vendored runtime already exposes a `FS` object.
- Before running student code, create or populate files using `mpInstance.FS.writeFile('/data/example.txt', content)` or `mpInstance.FS.createDataFile(...)` so Python `open('/data/example.txt')` works.
- After execution, read back files using `mpInstance.FS.readFile('/path', { encoding: 'utf8' })` and persist to `localStorage` or IndexedDB if persistence is desired.

UI / UX

- Provide a small Files sidebar where authors/students can create, upload, rename, and delete files. When files are edited or uploaded, write them into the runtime FS before `run()`.
- After run, display newly created/modified files in the UI and offer a download or persist option.

Persistence options

- `localStorage` (simple): store a JSON map of paths -> contents. Works for small files, easy to implement.
- `IndexedDB` (recommended for larger files): store blobs keyed by scenario id + path.

Edge cases

- Binary files: use ArrayBuffer/Uint8Array and Emscripten's FS APIs accordingly.
- Path escape: restrict allowed write locations to a sandbox prefix (e.g., `/sandbox/` or `/home/web_user/`) to avoid confusing paths.

Implementation contract for VFS

- Inputs: list of file entries {path: string, content: string|Uint8Array} to pre-populate before run.
- Outputs: after run, a list of changed files with content and metadata to show in UI and optionally persist.
- Error modes: FS write/read errors reported in terminal and safe-fail (do not crash the page).

How these two features integrate with the current loader

- `loadMicroPython` accepts `stdin`, `stdout`, `stderr` options. For the pre-prompt approach, pass a synchronous `stdin` callback that returns characters from a prepared queue.
- Use the `mpInstance.FS` object (returned by `loadMicroPython`) to write files before run and to read files after run.

Next steps I can implement for you

1. Wire a simple pre-prompt UI: detect `input()` usage, open a modal, collect lines, push chars into `inputQueue`, pass `stdin` to `loadMicroPython` and run — small change in `src/main.js`.
2. Add a small Files sidebar UI and the pre/post-run wiring to `mpInstance.FS` to populate and persist files.
3. Investigate whether the vendored MicroPython build supports true async stdin (to implement interactive streaming) and, if so, wire a streaming console.

Tell me which of the three next steps you want implemented now (1, 2, or 3) and I will proceed.

## Placeholder for your answers

1. Runtime choice: Option to run either Pyodide (full CPython-in-WASM) or MicroPython-in-WASM (user choice)
2. Feedback tool preference: AST-based simplified format for authoring feedback, plus separate regex rules for pattern-matching cases
3. History UI preference: Commit-like history (named commits/snapshots) with a clear UI to create/restore/clear commits; storage-clearing option and version-mismatch prompt
4. Attachment storage preference: External links only (no bundled assets in config)
5. Offline behaviour needed? (yes/no + details): Yes — explain implications of Service Worker caching below; the app must still work when opened from the filesystem without a service worker (service worker optional for improved offline performance)
6. Target browsers / constraints: Desktop only; must work in non-Chromium browsers (e.g., Firefox)
7. CI test preference: Local tests only; no CI required. No strong preference for test framework.
8. A11y/localization requirements: Yes — accessibility and localisation required; default to English initially.

### Service Worker: short explanation and implications

Service Workers are a browser feature that lets a site intercept network requests and cache assets, enabling offline operation and faster repeat loads. Key implications for this project:

- Pros:
  - Offline-first behaviour: cached JS/WASM/CSS can let the app run without network after first load.
  - Faster subsequent loads and fine-grained control of cached versions.
- Cons / considerations:
  - Complexity: service workers add lifecycle management (install/activate/update) and edge cases (stale caches, update prompts).
  - Local filesystem limitation: when the user opens the page directly from file://, many browsers do not allow service workers, so the app should work without one.
  - Debugging: service workers can cache old resources and require explicit update/clear steps during development.

Recommendation: make service worker optional. Implement a small, well-documented service worker that can be enabled for hosted deployments. For local file use, the app should detect the absence of a service worker and continue to function normally.

---

If you want I can start by scaffolding `src/index.html`, a minimal `src/config/sample.json`, and a tiny demo using MicroPython WASM — say "go" and tell me answers for questions 1 and 4 (runtime and attachments) and I'll create the initial scaffold and tests.

## Asyncify plan: Option A (try wiring existing vendored bundle) and Option B (rebuild with Asyncify)

Summary

- We inspected the vendored runtime at `src/vendor/micropython.mjs` and found async-capable entry points already present: `runPythonAsync`, `mp_js_do_exec_async`, and `replProcessCharWithAsyncify`. That means the current build already exposes hooks suitable for Promise/async interoperability between JS and MicroPython.

Option A — Wire the existing vendored bundle (preferred first step)

- Idea: Avoid rebuilding. Use `loadMicroPython()` to create the runtime, then register a small JS module (via `mp.registerJsModule(name, module)`) which exposes a function like `get_input()` that returns a JavaScript Promise. In Python, run an `async` coroutine that `await`s that JS-returned thenable. Use `runPythonAsync()` to run the coroutine.
- Why this works: the vendored runtime already maps JS Promises / thenables into Python `PyProxyThenable` objects and handles continuation plumbing (`js_then_continue` / `proxy` helpers exist in the bundle). That enables `await` on a JS-provided Promise from inside MicroPython without using a Worker or SharedArrayBuffer.
- What I implemented for testing: an isolated test page `test/asyncify_optionA_test.html` + `test/asyncify_optionA_test.js` (keeps it away from the main app). The test registers a `host.get_input()` JS function that returns a Promise resolved by the page's input box. The Python test code uses `asyncio.run(main())` and `await host.get_input()` to receive the data.
- Pros:
  - Works on vanilla static hosts (e.g., GitHub Pages) because it doesn't require cross-origin-isolation or special headers.
  - Quick to iterate — no toolchain change.
- Cons / caveats:
  - Requires writing the Python snippet as async (using `asyncio`) rather than calling the blocking builtin `input()` directly. We can wrap or monkeypatch `input` in Python to call the async interface, but that changes the calling style.
  - If you want `input()` (synchronous-looking) to keep working for arbitrary user code without editing it, you may still need a runtime built with Asyncify configured at C level to suspend/resume native code paths. But many teaching examples can be adapted to the async style very easily.

Option B — Rebuild MicroPython with Asyncify (full in-page blocking support)

- Idea: Recompile the MicroPython Emscripten build with Asyncify enabled (either globally or using a whitelist of imported/symbolic functions). That lets native C-level blocking calls (e.g., the normal `input()` code path) suspend and resume on JS Promises, so unmodified Python code that calls `input()` would work synchronously from the user's perspective.
- Tooling required:
  - emscripten SDK (emsdk) installed and activated on a machine with a C toolchain.
  - MicroPython build configuration that targets Emscripten.
  - Link flags like `-sASYNCIFY=1` or `-sASYNCIFY_IMPORTS='["js_wait_for_input"]'` / `-sASYNCIFY_FUNCTIONS='["_mp_js_do_exec_async","_replProcessCharWithAsyncify"]'` depending on how selective you want the transformation to be.
- Pros:
  - Lets arbitrary Python code using the normal `input()` call run in-page (no worker, no COOP/COEP headers).
  - Cleaner API for teachers and students; no need to rewrite examples as coroutines.
- Cons:
  - Requires a non-trivial native build step and toolchain. Harder to automate for some contributors.
  - Asyncify increases binary size and can add runtime overhead; using a whitelist reduces that.

Recommendation and next steps

- Try Option A first (we already implemented the test page). It keeps hosting simple and will tell us whether the vendored runtime's promise/thenable plumbing is sufficient for your teaching scenarios.
- If Option A proves insufficient (you must support plain `input()` in arbitrary student code), then do Option B and rebuild MicroPython with Asyncify. I can prepare a reproducible build script for that.

Notes from inspection of `src/vendor/micropython.mjs`

- The bundle exposes `loadMicroPython()` and returns an object with `runPython()`, `runPythonAsync()`, `registerJsModule(name, module)`, and `pyimport(name)`.
- The runtime contains C entrypoints `mp_js_do_exec_async` and `mp_js_do_exec` and also has `replProcessCharWithAsyncify`; these names are suitable for Asyncify whitelist flags if we rebuild.
- The proxy glue already supports converting JS Promises/thenables into Python `PyProxyThenable` objects and arranging for continuation via helpers like `js_then_continue`.

Files added for Option A testing (isolated)

- `test/asyncify_optionA_test.html` — minimal page that loads `test/asyncify_optionA_test.js` and provides UI.
- `test/asyncify_optionA_test.js` — script that:
  - loads `loadMicroPython` from `src/vendor/micropython.mjs`,
  - calls `loadMicroPython({ url: '../src/vendor/micropython.wasm', stdout, stderr })`,
  - registers `host.get_input()` as a JS function that returns a Promise,
  - runs an async Python snippet via `mp.runPythonAsync(code)` that uses `asyncio` and `await host.get_input()`.

Testing instructions


1. Start a local static server from repo root (no special headers required):

  python -m http.server 8000

1. Open the isolated test page:

  `http://127.0.0.1:8000/test/asyncify_optionA_test.html`

1. Click 'Load Runtime / Run' then use the input box to send values. The page will display stdout/stderr and debug messages.

If you want, I'll now create the isolated test files and wire them up (I already did). Run the page and report what you see; I'll iterate quickly (logging, monkeypatching `input()` for sync-like behavior, or preparing the Asyncify build script if Option A falls short).

## Final approach adopted

- Chosen strategy: source-transform + offset-aware traceback mapping.
  - Before execution we transform user source to replace `input(...)` calls with `await host.get_input()` and wrap the program in an async runner. This allows the vendored MicroPython runtime's `runPythonAsync` and JS-Promise interop to provide interactive input without requiring cross-origin-isolation or a rebuild.
  - To keep tracebacks meaningful we map runtime-file line numbers back to the original student source by subtracting the number of header lines inserted by the transform. The UI also offers a "Show raw traceback" checkbox to view the unmodified runtime trace for debugging.

- Where to find the changes:
  - `src/main.js`: helpers for transforming code, mapping tracebacks, and wiring the mapped output into the terminal.
  - `src/index.html`: added a "Show raw traceback" toggle near the run controls.
  - `test/asyncify_optionA_test.*`: experimental harness used during development; kept for reference.

- Why this approach:
  - Works on vanilla static hosts with zero server config changes.
  - Avoids the heavier Asyncify rebuild unless truly necessary.

- When to consider Asyncify rebuild instead:
  - If you need to run arbitrary, unmodified third-party Python code that expects blocking `input()` semantics without transforming the source, plan a rebuild of the MicroPython wasm with Asyncify and a small whitelist of functions. This is documented earlier in this file under the Asyncify plan.

## VFS design notes (new)

- Goal: provide an in-browser virtual filesystem so student programs can create,
  read, update and delete text files and Python modules, with optional binary
  support later. Persist files to IndexedDB (preferred) with localStorage as a
  simple fallback.

- Author-attached files: config manifests may include an `attached_files` array.
  Each entry should include:
  - `path` (string): path inside the VFS (e.g. `/data/input.txt`)
  - `source` (string | url | base64): initial content or a URL to fetch
  - `permissions` (string): one of `'ro'`, `'rw'`, `'deletable'` (controls UI and API permissions)
  - `type` (string): `'text'` | `'py'` | `'binary'`

- JS API (`src/lib/vfs.js` recommended):
  - `vfs.init(manifest)` -> Promise: initialize DB and seed files from manifest
  - `vfs.read(path)` -> Promise<string|Uint8Array>
  - `vfs.write(path, data)` -> Promise
  - `vfs.delete(path)` -> Promise
  - `vfs.list(prefix)` -> Promise<Array<{path,size,mtime,permissions}>>
  - `vfs.mountToEmscripten(FS)` -> Promise: write stored files into Emscripten FS

- UI: Files sidebar that lists files and supports Create (text/.py), Open,
  Download, and Delete (if deletable). Opening a file loads it into the editor.

- Persistence: store files per-workspace/project namespace in IndexedDB; include
  a small snapshots store that copies file contents when the user saves a code
  snapshot.

- Runtime integration:
  - If `mpInstance.FS` exists, call `FS.writeFile(path, data)` before running.
  - After run, read back any files generated by the program via `FS.readFile`.
  - If no Emscripten FS is present, use a small shim object exposing `readFile`/`writeFile` used by the runtime adapter.

- Security and policy:
  - No executable files are supported. `.py` files are plain-text modules that
    can be imported by student code but are not executed directly as binaries.
  - Permissions are enforced by the VFS API and reflected in the UI.

- Implementation plan (phases):
  1. Implement `src/lib/vfs.js` with IndexedDB-backed storage and a
     localStorage fallback.
  2. Add Files UI in `src/index.html` and wiring in `src/main.js` to create,
     open, and delete files based on permissions.
  3. Wire `vfs.mountToEmscripten(mpInstance.FS)` during runtime initialization.
  4. Hook snapshots to persist VFS state alongside code snapshots.

I'll implement phase 1 (VFS core) next unless you prefer a different order.
