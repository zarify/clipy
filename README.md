# Clipy

Clipy is a browser-hosted educational environment for writing and running Python code. It combines an editor, an in-browser MicroPython runtime, a terminal UI for stdin/stdout, and authoring tools for tests and automated feedback.

This README focuses on practical usage and hosting. For a module-level breakdown of the runtime JavaScript, see `docs/architecture.md`.

## Hosting locally

Clipy is a static web app. Serve the repository root with any simple static file server and open it in a modern browser.

Examples (from the repository root):

```bash
# Simple Python server
python3 -m http.server 8000

# Or a Node static server
# npx serve -s . -l 8000
```

Open http://localhost:8000/ in your browser.

## Browser & platform notes

- Requires a modern browser with ES module and WebAssembly support (Chrome, Firefox, Edge, Safari).
- No server-side runtime is required; the app runs entirely client-side.
- The repository includes a WebAssembly MicroPython runtime in `src/vendor/` used to execute user code in the browser.

## Configuration & authoring

- Configuration is intended to be managed through the in-app Authoring UI (use `?author=true` or the Author page). Hand-editing JSON files is discouraged; sample JSON files in the repo are examples only.

## Storage

- Clipy uses browser storage for persistence:
   - `localStorage` is used for autosave and a lightweight files mirror.
   - `IndexedDB` is used for authoring drafts with a localStorage fallback.

## Project layout (high level)

- `src/` — application source code (UI wiring, runtime glue, modules). See `docs/architecture.md` for details.
- `src/vendor/` — third-party libraries and WebAssembly assets (MicroPython, py-ast, etc.).
- `src/tests/` — iframe runner and fixtures used by integration tests.
- `tests/` and `test/` — Playwright and unit tests.

## Core capabilities (what the app actually does)

- Edit Python code in a browser-based editor.
- Run user code client-side using a WebAssembly MicroPython runtime and display stdout/stderr in an integrated terminal.
- Provide stdin support for interactive programs via the terminal UI.
- Let authors define automated tests and expected outputs that run against user code.
- Show test results and configured feedback messages in a feedback panel.
- Capture snapshots and autosaves so users' work persists in the browser.
- Provide AST-based analysis utilities used by authoring tools and AST-based tests.

## What Clipy does not assume or require

- It does not require a server backend to run the client UI or run the user's code.
- Configuration is intended to be managed through the Authoring UI rather than hand-editing JSON files.

## Contributing & development pointers

- See `docs/architeture.md` for an authoritative module list.
- To run a quick local server, use `python3 -m http.server` or any static server.
- Playwright specs and integration tests live under `tests/` — run them if you change runner/iframe behavior.

## License

See `LICENSE` in the repository root.
