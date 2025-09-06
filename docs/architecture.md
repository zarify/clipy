## Modular architecture — JS modules (src/)

This document lists the primary JavaScript modules used by the running application (files under `src/`), with a short, factual description of each module's responsibility and the main exports/side-effects authors should be aware of.

Scope & assumptions
- Files under `src/tests/` are intentionally excluded (they are test harnesses and fixtures).
- `src/vendor/*` contains third-party libraries (not described in detail here).
- Descriptions are concise and focused on runtime responsibilities. If you want a deeper API surface for any module I can expand it.

Top-level app

- `src/app.js`
	- Main application entrypoint / orchestrator. Imports and wires the UI, VFS, runtime loader and feature subsystems. Responsible for startup sequence, configuration loading, exposing a few debug helpers on `window`, and coordinating module initialization.

Core utilities

- `src/js/utils.js`
	- Small DOM and general-purpose helpers: `$` DOM lookup, debounce timer, string/markdown helpers, and a few small transformation utilities used across the app.

- `src/js/logger.js`
	- Centralized logging wrapper (debug/info/warn/error) used by modules to keep log behavior consistent and filterable.

- `src/js/config.js`
	- Configuration loader and normalizer. Responsible for loading config from URL, file, or local storage and providing helpers to access/validate the current config.

UI primitives and controls

- `src/js/modals.js`
	- Accessible modal management: open/close helpers, focus trap and keyboard handling, and small modal helper functions used by authoring and other UI flows.

- `src/js/terminal.js`
	- Terminal UI glue for printing program output and debug output. Handles terminal DOM updates and the append/clear helpers used by the execution/test runner.

- `src/js/editor.js`
	- Code editor initialization and editor-related helpers (editor instance lifecycle, applying highlights for tracebacks/feedback, and editor event hooks).

- `src/js/tabs.js`
	- Tab manager for opened files: open/close/switch tabs, pending-tabs flush used by the VFS notification system.

Persistence & storage

- `src/js/storage.js`
	- Small storage adapter (localStorage-backed by default) used by autosave and snapshot features. Exposes a programmatic adapter usable in tests.

- `src/js/storage-manager.js`
	- Higher level storage helpers that wrap/guard localStorage usage (quota-safe writes, safeSetItem, diagnostics).

- `src/js/snapshots.js`
	- Snapshot (save/load) support used by the UI to snapshot code states and restore them.

VFS (virtual filesystem) and file management

- `src/js/vfs-client.js`
	- Client-facing FileManager and VFS integration. Maintains localStorage mirror, exposes `FileManager`-style APIs (list/read/write/delete), implements expected-write consumption and a `waitForFile` helper. Also exposes `MAIN_FILE` constant.

- `src/js/vfs-backend.js`
	- Runtime-side VFS backend (bridges runtime FS to the client-side mirror). Used when the WebAssembly MicroPython runtime is active.

- `src/js/vfs-glue.js`
	- Runtime glue between the wasm runtime and the client VFS; small coordination helpers (file currently contains minimal/placeholder glue in the repo).

Runtime and execution

- `src/js/micropython.js`
	- MicroPython runtime loader and initialization helpers. Loads `vendor/micropython.mjs`, wires stdio/input hooks and exposes runtime control functions (load, reset, interrupt handling).

- `src/js/execution.js`
	- High-level execution helper that prepares code for the runtime and calls the runtime runner. Exposes `runPythonCode` used by interactive run and by test runners.

- `src/js/input-handling.js`
	- Stdin/stdout integration: feeding input to the runtime, managing pending input promises, and echoing input into the terminal when necessary.

Test runner integration (runtime-agnostic runner used by UI)

- `src/js/test-runner.js`
	- Generic, runtime-agnostic test harness. Exposes `runTests(tests, options)` which accepts an injected `runFn` to actually execute programs. Provides matching logic for expected stdout/stderr and helpful mismatch diagnostics.

- `src/js/test-runner-adapter.js`
	- Factory that builds a `runFn` used by `test-runner.js`. It wires the FileManager, the `runPythonCode` helper, stdin feeders, and performs file snapshot/restore around tests. Also short-circuits AST tests by delegating to the AST analyzer if `astRule` is present.

- `src/js/test-runner-sandbox.js`
	- Sandbox orchestration for running tests inside isolated iframes. The sandbox creator returns a `runFn` that posts messages to iframe runners, used by Playwright smoke pages and by the app for per-iframe test execution.

Authoring and feedback systems

- `src/js/feedback.js`
	- Runtime feedback evaluation hooks. Provides `resetFeedback`, `evaluateFeedbackOnEdit`, `evaluateFeedbackOnRun` and wiring to run-time rules against program output or code edits.

- `src/js/feedback-ui.js`
	- UI for displaying feedback and test results. Renders configured feedback items and test results, and exposes a Run-tests control used by authors and the app.

- `src/js/author-feedback.js`
	- Authoring helpers for creating/editing feedback entries (small UI helper that keeps the feedback JSON textarea in sync with interactive edits).

- `src/js/author-tests.js`
	- Authoring UI helpers for test definitions (grouping, ordering, and editing author tests) used by the authoring pages.

- `src/js/author-page.js`
	- Page-level glue for the authoring UI (wires autosave, author-storage, the feedback editor, and test editing UI into a single page flow).

- `src/js/author-storage.js`
	- Persistent storage helpers for authoring data: localStorage helpers and an IndexedDB-backed draft store with fallbacks to localStorage.

AST & test-building utilities

- `src/js/ast-analyzer.js`
	- AST analysis wrapper used by test-runner adapters and author tools. Parses Python source (via bundled `py-ast` vendor lib), supports queries such as function existence, variable usage and other educational analyses.

- `src/js/ast-rule-builder.js` and `src/js/ast-test-builder.js`
	- Small UI/authoring helpers that help authors construct AST rules and embed them into tests/feedback.

Misc helpers

- `src/js/code-transform.js`
	- Transforms author code before execution (wrapping, instrumenting for input prompts, and mapping tracebacks). Also provides helpers to highlight mapped traceback lines in the editor.

- `src/js/traceback_mapper.js`
	- Maps low-level runtime/microPython tracebacks to source file locations so the UI can highlight the correct editor line.

- `src/js/download.js`
	- Utilities to export code or configuration as downloadable artifacts (zip/export buttons etc.).

- `src/js/autosave.js`
	- Autosave integration: periodically saves current editor contents to storage and restores autosaves on load.

- `src/js/snapshots.js`
	- Snapshot capture/restore system used by the app to let authors save/restore code states.

Files intentionally not described here
- Anything under `src/tests/` (test harnesses, runner.html, runner.js, stubs and smoke pages) — these are test fixtures and are used by Playwright and other integration tests; keep them in place.
- `src/vendor/*` third-party libraries (e.g. `py-ast`) — these are external dependencies.

Next steps
- If you want, I can expand any entry above with exported function signatures and common call patterns (useful for contributors). I can also generate a small `src/README.md` with the same content copied near the codebase.

Notes
- Descriptions were compiled from the source code and the app's imports; small wording assumptions were made for some modules where the implementation is split across multiple files (e.g. editor / terminal details). Ask if you'd like strictly line-cited summaries per file.
