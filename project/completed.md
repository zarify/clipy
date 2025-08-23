# Progress summary — current state

The repository now contains a working client-side playground scaffold with the following implemented features (minimal, pragmatic delivery focused on local development and testing):

## UI and editor

- `src/index.html` — main UI with an instructions panel, a CodeMirror editor host, terminal output area, and controls (Run, Commit snapshot, History, Clear storage).
- `src/style.css` — basic styles for editor, terminal, and modal UI.

## Editor UX

- CodeMirror integration (classic CodeMirror 5 from CDN) with Ctrl-Enter run binding.
- Autosave to `localStorage` (debounced) and a small saved indicator.
- Commit-like snapshots stored in `localStorage` with a simple modal UI to list/restore/delete snapshots.

## Runtime loading and execution

- Local vendoring support: prefer `./vendor/micropython.mjs` + `./vendor/micropython.wasm` when present.
- Two-path loader: (1) dynamic ESM import if available; (2) inline module bridge that imports the vendored `.mjs` and exposes exports on `window.__ssg_runtime` for non-module code.
- Probe that detects runtime globals (pyodide, MicroPy, micropython, and the bridge global) and creates a small adapter with a unified `run(code, input)` async API.
- If the vendored module exposes `loadMicroPython`, we call it and wire stdout/stderr to an in-page capture, exposing `runPython`/`runPythonAsync` as the runtime adapter.

## Feedback engine

- Regex-based feedback rules are implemented and configured in `src/config/sample.json` (targets: `code`, `input`, `output`).
- AST-based feedback remains a planned enhancement (placeholder present in config).

## Storage & tests

- `src/lib/storage.js` provides a small storage adapter and an in-memory implementation for tests.
- Tests added: `test/test_smoke.py` (Python unittest smoke tests) and `test/test_storage.js` (Node test for storage). Both have run locally and passed.

## Vendoring & CORS handling

- The loader prefers local vendored files to avoid CDN MIME/CORS issues. When running locally, serve the files over HTTP (e.g. `python -m http.server`) — file:// mode may block ESM/WASM.
- Fixed ESM module loading issues (ensured appended script tags are `type="module"` when necessary and added an inline bridge to support browsers that don't allow dynamic import from certain contexts).

## Runtime stdout handling

- Properly decode Uint8Array stdout chunks from the WASM runtime via `TextDecoder` and normalize newline handling so prints appear on separate lines and the literal "null" is not appended.

## Notes and limitations


## Recent updates
- Implemented iterative split-run fallback to support multiple sequential
	`input()` calls when the vendored runtime lacks an async runner. The UI
	prompts for each input in order and preserves interpreter state between runs.
- Replaced the naive regex transform with a tokenizer-aware rewrite that skips
	strings and comments and only rewrites real code occurrences of `input(...)`
	to `await host.get_input(...)`.

## Next major area: virtual filesystem (VFS)
- We will add an in-browser VFS backed by browser storage (IndexedDB preferred,
	with localStorage as fallback). The VFS will be exposed to the runtime as
	files under the Emscripten `FS` when available (or mapped into a small
	in-memory shim otherwise).

See `project/notes.md` for the VFS design and API plan.

- `src/index.html` — main UI
- `src/style.css` — styles
- `src/main.js` — runtime loader, adapter, editor wiring, feedback, autosave, snapshots
- `src/config/sample.json` — example config with runtime location and feedback rules
- `src/lib/storage.js` — storage adapter
- `test/test_smoke.py`, `test/test_storage.js` — basic tests

## How I verified

- Ran Python unit smoke tests (3 tests) and local Node storage test; both passed when run locally.
- Verified runtime initialization and printing in the browser (user-verified). Newline handling and trailing nulls were fixed.

## Next recommended steps (choose any)

- Gate diagnostic logs behind a `config.debug` flag (small change).
- Add a Playwright e2e test that loads the page, clicks Run, and asserts terminal output (recommended for regressions).
- Implement AST-based static feedback (JS AST or WASM-based Python AST) depending on preferences.

If you want a PR with tidied logs and one e2e test, tell me and I will prepare it.
