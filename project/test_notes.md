
# New Test Suite Plan for Clipy (updated)

This document contains the original testing intent and an updated, practical recommendation based on the repository architecture.

## Overview

Two-tier testing remains the right approach:
- Lightweight Node tests for core logic and modules.
- Playwright E2E tests for browser flows and runtime integration.

Below are architecture observations, implications for test tooling, and concrete recommended steps.

## Architecture summary and constraints

- Module style: the codebase uses modern ESM-style `import` / `export` across `src/js/*.js`.
- Browser globals: many modules access `window`, `document`, `localStorage`, `indexedDB`, and set `window.*` during module initialization (import-time side effects).
- package.json: currently does not declare `"type": "module"` and includes Playwright scripts.
- Vendor code: some shipped vendor files use `.mjs` and Node-specific require() internally, but the app is browser-first.

Implication: tests that import app modules in Node must provide a `window`/DOM-like environment before (or at) import time, or import modules dynamically after stubbing window. ESM vs CommonJS behavior also affects test runner choice and configuration.

## Recommended test-runner options (short)

1) Jest + jsdom — Recommended for this repo
- Why: jsdom provides `window`/`document` at import time, which keeps the existing modules working without invasive refactors. Jest provides rich features (mocks, snapshots, coverage) and a stable ecosystem.
- Caveats: modern Jest supports ESM but needs a small config file for robust ESM behavior in some setups. We'll add a tiny `jest.config.cjs` and keep transforms minimal.

2) Node built-in test runner (node --test)
- Why: zero external deps, native ESM support (when `"type": "module"` is set). Good for logic-only modules and minimalism.
- Caveats: because many modules access `window` at import time, tests will need to set `globalThis.window` before importing the module (dynamic import after stubbing). This is workable but more manual.

3) Vitest
- Can work (it supports jsdom), but previously caused friction in this workspace. If you prefer Vitest we can try to fix the issues, but Jest is the safer path given the heavy DOM imports.

## Concrete recommendation

- Use Jest with the `jsdom` test environment for Node/unit tests. It gives the least friction for a browser-first codebase and keeps tests readable and maintainable.
- Use Playwright (already present) for E2E/browser tests.

## Quick setup snippets (Jest + jsdom)

1) Install dev deps:

```bash
npm install --save-dev jest@^29 jest-environment-jsdom
```

2) Add script to `package.json`:

```json
"scripts": {
  "test": "jest"
}
```

3) Create `jest.config.cjs` at repo root (CJS config file works even if project is ESM):

```js
module.exports = {
  testEnvironment: 'jsdom',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
};
```

4) Example test `src/js/__tests__/sanity.test.js`:

```js
import { someFn } from '../utils.js';
test('someFn basic', () => {
  expect(someFn(1)).toBe(2);
});
```

Notes: If you later switch the whole repo to ESM via `"type": "module"` in `package.json`, keep `jest.config.cjs` (Jest supports that). We can add small extra mappings (e.g., stub CSS imports) if tests import non-JS assets.

## Quick setup snippets (Node built-in runner — minimal-deps alternative)

1) Make `package.json` ESM-aware (if you choose this route):

```json
"type": "module"
```

2) Add script:

```json
"scripts": {
  "test:node": "node --test --test-reporter=spec"
}
```

3) Example node:test file that stubs window and dynamically imports module:

```js
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('vfs-client dynamic import', () => {
  it('can be imported after stubbing window', async () => {
    globalThis.window = { /* minimal window stubs used by the module */ };
    const mod = await import('../../src/js/vfs-client.js');
    assert.ok(typeof mod.initializeVFS === 'function');
  });
});
```

## Notes / gotchas

- Many modules set `window.*` at import time. When using Node runner you must stub `globalThis.window` before import (use dynamic imports in tests). With Jest+jsdom this is automatic.
- Some vendor files are `.mjs` and include Node-specific code; they generally do not affect Jest/jsdom tests but watch for runtime differences when running tests in Node.
- If you plan to refactor modules for easier testing, prefer small DI helpers (for example `getWindow()` wrappers or exported initialization functions) so tests don't need heavy stubbing.

## Next steps (pick one)

- A) I implement Jest + jsdom: install deps, add `jest.config.cjs`, add a sample `src/js/__tests__/sanity.test.js`, and run the tests once to report outcomes.
- B) I implement Node built-in runner: set `"type": "module"`, add `test:node` script, add sample dynamic-import test that stubs window, and run it once.

Tell me which option to implement and I'll make the changes and run a smoke test.

---

Revision date: 2025-09-08
