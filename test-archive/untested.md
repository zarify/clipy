# Untested

- End-to-end execution with the actual MicroPython WASM loader in different browsers (needs manual testing).
- AST-based feedback engine (placeholder only).
- Accessibility (a11y) compliance testing — UI is minimal and not fully audited.
- Mobile/browser compatibility beyond desktop Firefox/Chromium.

Manual test notes:
- Open `src/index.html` in Firefox and load the runtime via CDN to validate execution.
- Verify snapshots stored in `localStorage` behave as expected.
