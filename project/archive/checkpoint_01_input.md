
# Checkpoint 01 — cleanroom reimplementation guide for interactive input

Date: 2025-08-20

Purpose
This document describes a minimal, executable approach to supporting interactive
Python input() in a client-side MicroPython playground that runs on plain
static hosts. It focuses on a working solution used in this project:

- source transform that rewrites input() to await a JS Promise (host.get_input)
- Promise-based host module registered with the vendored MicroPython runtime
- a split-run fallback for runtimes that lack async runner support

# Checkpoint 01 — cleanroom reimplementation guide for interactive input

Date: 2025-08-20

Purpose

This file documents a minimal, repeatable approach to support interactive
Python input() in a client-side MicroPython playground that runs on static
hosts. It describes the approach used in this project: source transform that
rewrites input() to await a JS Promise, a Promise-based `host` JS module, a
split-run fallback for runtimes without async support, and traceback remapping
so errors point back to original user source.

Key ideas

- Replace `input()` calls with `await host.get_input()` via a source transform.
- Register a JS module `host` whose `get_input(prompt)` returns a Promise that
	the UI resolves when the user submits a line.
- Prefer `runPythonAsync` to execute transformed async code. If unavailable,
	use a split-run fallback to simulate an interactive session.
- Remap tracebacks by subtracting the number of header lines inserted by the
	transform (`headerLines`) to show original user line numbers.

Assumptions

- You have an ES module loader `micropython.mjs` and `micropython.wasm`.
- The loader exposes an initializer like `loadMicroPython()` that yields an
	instance with `runPythonAsync` (preferred), `runPython` (optional), and
	`registerJsModule`.

Preferred flow (brief)

1. Load the vendored runtime with `loadMicroPython({ url, stdout, stderr, linebuffer: true })`.
2. Register a host JS module:

	 host.get_input = function(prompt='') {
		 return new Promise(resolve => { window.__ssg_pending_input = { resolve, prompt }; });
	 }

	 and register via `mp.registerJsModule('host', host)` when available.

3. Transform user source: replace `input(` with `await host.get_input(`, wrap in
	 an async `__ssg_main()` and add a small compatibility header that binds a
	 `_run(coro)` helper using `asyncio`/`uasyncio` if present.
4. Execute the transformed code with `runPythonAsync`.

Split-run fallback (single-input emulation)

If async execution is not supported, run the prefix up to the first `input()`
to surface prints, prompt the user in-terminal, then run the suffix after
replacing the first `input(...)` with a safe literal or injecting an input list
and an `input()` shim. Track offsets to remap tracebacks for the suffix run.

Traceback mapping

Provide a `mapTraceback(rawText, headerLines)` utility that finds patterns like
`File "<stdin>", line N` and replaces `N` with `max(1, N - headerLines)`. Show
small source context (±2 lines) from the original user code where helpful.

UI wiring

- When a host.get_input promise is pending, focus the stdin field.
- On Enter or Send, call the pending resolver `window.__ssg_pending_input.resolve(value)`,
	clear and refocus the input field, and delete the pending resolver.

Notes and gotchas

- Regex-based transforms may alter `input(` inside strings or comments. For
	production use prefer a tokenizer/AST rewrite.
- MicroPython builds differ in async API availability; use a small shim that
	tries `asyncio.run`, then `uasyncio.run`, then `loop.run_until_complete`.

Next steps (optional)

- Replace regex transform with an AST/token-based rewriter.
- Implement iterative split-run for multiple inputs.
- Add automated e2e browser tests (Playwright) to verify interactive flows.

VFS next steps (brief)

- Requirement: students must be able to create, read, update, and delete text
	files in a virtual filesystem backed by IndexedDB (fall back to localStorage
	if IndexedDB is unavailable). Files should be mountable into the runtime's
	FS (Emscripten `FS` when present) before program execution.
- Author-provided files: config files must be able to declare files to be
	injected into student workspaces with per-file permissions: read-only,
	read/write, deletable. Executables are explicitly unsupported; imported
	Python modules (text .py files) are allowed for import by student code.
- Data model: a manifest in the config will list attached files with fields:
	- path (string): path within the VFS
	- source (string | base64): initial contents or a URL to fetch
	- permissions (enum): 'ro' | 'rw' | 'deletable'
	- type (enum): 'text' | 'py' | 'binary' (binary later)
- UI: students will see a file browser showing their files, be able to create
	and delete files (subject to permissions), and open files into the editor.
- Persistence: changes are persisted to IndexedDB per project/session; snapshots
	will capture a copy of files alongside code snapshots.



