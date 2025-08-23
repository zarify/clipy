# Asyncify and runtime approaches for blocking `input()` in the browser

Purpose
- Short, self-contained reference describing two practical ways to get synchronous/blocking-style `input()` behavior for an in-browser Python interpreter: 1) Asyncify (Emscripten suspend/resume) and 2) interpreter-level yield/resume. Includes prototype JS, build hints, trade-offs, and recommended next steps.

## Summary / recommendation
- Recommended: use Asyncify (rebuild the wasm with Asyncify enabled) and wire a small JS host shim that suspends the wasm while the UI collects input. This requires rebuilding the `vendor` wasm but does not require workers or cross-origin isolation.
- Alternative: modify the MicroPython VM to yield/resume on host calls. This is robust but more invasive and requires C-level changes and maintenance.

---

## Checklist (for a simple Asyncify delivery)
- [ ] Rebuild wasm with Asyncify enabled (Emscripten SDK required).
- [ ] Ensure the wasm export/import names include the host function used by the Python host module (e.g., `host.get_input`).
- [ ] Add JS shim in `src/main.js` to register a `host.get_input` that uses Asyncify.handleAsync (or equivalent) to suspend/resume wasm.
- [ ] Drop rebuilt wasm into `vendor/micropython.wasm` and test in the browser.

## 1) Asyncify approach (recommended)
What it does
- Lets wasm suspend its stack while JS handles asynchronous work. From Python's point of view, a host call (e.g. `host.get_input()`) can behave like a synchronous blocking call: execution suspends, UI collects input, then execution resumes with the supplied string.

Advantages
- No worker or SAB/Atomics needed.
- Gives true blocking semantics for `input()` without source transforms.
- Deterministic for Playwright/automated tests.

Costs and cautions
- Requires rebuilding the wasm with Asyncify (Emscripten). Asyncify increases some overhead and requires listing async imports in some setups.
- The exact JS helper API can vary depending on how the loader is generated; the examples below are the common patterns.

Where to drop the rebuilt artifact
- Replace `vendor/micropython.wasm` in this repo with the Asyncify-built wasm.

### Sample build guidance (conceptual)
- Install emsdk and activate it (follow Emscripten docs).
- Build MicroPython with emcc/emconfigure/emmake or your project build system. Example conceptual flags:

```bash
# Example (adapt to your MicroPython repo/build wrapper)
# Enable Asyncify and list the import name(s) that will be suspended from wasm
emcc ... -sASYNCIFY=1 -sASYNCIFY_IMPORTS="['host_get_input']" -o micropython.js
# Or set ASYNCIFY with array form, depending on emscripten version
# Copy the resulting .wasm to vendor/micropython.wasm
```

Notes:
- The exact import name you expose from JS (the host module) must match the name used by the MicroPython embedding or the module registration (e.g., `host.get_input`).
- Some MicroPython builds include a JS loader wrapper; inspect the generated wrapper to find the correct Asyncify helper (`Asyncify.handleAsync`, `Module.Asyncify.handleAsync`, etc.).

### JS prototype (to register `host.get_input`) — add to `src/main.js` when runtime is present
```javascript
// host.get_input implemented with Asyncify.handleAsync
const hostModule = {
  get_input: function(promptText = '') {
    // Asyncify.handleAsync receives a function(fn) and returns the result when resumed
    return Asyncify.handleAsync(function(wake) {
      // store resolver that will call wake(value) when the UI submits
      window.__ssg_pending_input = {
        resolve: function(v) { try { wake(v) } catch (e) { } },
        promptText: promptText
      }
      // enable UI input and focus
      try { setTerminalInputEnabled(true, promptText || '') } catch (_e) {}
      try { document.getElementById('stdin-box')?.focus() } catch (_e) {}
    })
  }
}
// Register with runtime if it supports registerJsModule('host', hostModule)
// or otherwise expose as window.__ssg_host for the runtime bridge to pick up.
```

UI submit handler (existing code in this project): on submit call `window.__ssg_pending_input.resolve(value)` which will call the `wake` function provided by Asyncify and resume wasm.

### Typical runtime differences
- You might need to call `mpInstance.registerJsModule('host', hostModule)` or provide the import table so wasm finds the `host.get_input` import at link time.
- The Asyncify helper location may be `Asyncify.handleAsync`, or accessed from the module instance (e.g., `Module.Asyncify.handleAsync`) depending on the generated loader. Inspect the generated JS wrapper.

---

## 2) Interpreter-level yield/resume (VM changes)
What it is
- Modify MicroPython's `input()` implementation (or the VM call path) so it yields the interpreter's state back to the host and can resume later with a supplied value.

Pros
- Cleanest semantics and efficient; no Asyncify overhead.
- Works without Emscripten-specific tooling once implemented.

Cons
- Requires C changes to MicroPython and an in-depth understanding of VM state save/restore.
- More invasive and fragile across runtime upgrades.

When to pick
- Choose this only if you plan to maintain your own MicroPython fork or need maximum control/performance.

Notes to implementers (high level)
- Identify the native `builtins.input` implementation in MicroPython source.
- Change it to return a special ‘yield-to-host’ status, storing the current frame and stack state.
- Host receives the request, collects input, then asks the runtime to resume from the saved frame with the provided value.
- Careful memory management and error handling are required.

---

## Practical next steps (fast path)
1. I can add the Asyncify-compatible JS host shim to `src/main.js` for you now. It will be inert until you rebuild and install an Asyncify-enabled wasm.
2. If you want, I can prepare precise `emsdk` + `emconfigure` + `emmake` build commands tailored to the MicroPython vendor build in this repo — tell me whether you build locally on macOS or in CI (Linux) and I will prepare step-by-step commands.
3. If you prefer VM-level changes, I can draft a patch outline for MicroPython's C sources showing the insertion points for yielding/resuming.

---

## Troubleshooting notes
- If you see an exception that Asyncify can't instrument a call, inspect the generated JS/wrapper for the symbol name of Asyncify helpers.
- If the host import name doesn't match at link time, wasm will fail to instantiate or calls will trap; ensure the import table keys match (module and export names).
- Test incrementally: first confirm the wasm loads and a trivial Asyncify-suspended call resumes, then wire the UI.

---

If you want the JS shim added to the repo now, say "add shim" and I will create a small patch that registers `host.get_input` using Asyncify.handleAsync and wires the existing submit handler to call the Asyncify wake path. If you want the build steps, say which host (macOS/Linux/CI) and I will produce exact emsdk/emconfigure/emmake commands.
