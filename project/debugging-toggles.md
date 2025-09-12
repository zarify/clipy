# Filesystem & Debugging Toggles

This page documents the runtime flags and debug toggles introduced to help debug VFS / MicroPython filesystem issues while preserving good runtime performance for students.

## Purpose

- Explain the available toggles and what they do.
- Show where the toggles are used in the codebase.
- Provide quick console snippets and recommended workflows.

## High-level summary

- Tracing and heavy VFS bookkeeping are disabled by default to avoid slowdowns (notably visible when running `os.listdir()` in student code).
- Tracing can be enabled temporarily for instructor/developer debugging.
- A heuristic is used to skip an expensive full VFS sync after short read-only runs.

## Toggles (runtime window flags)

- `window.__ssg_enable_fs_tracing` (boolean)
  - Purpose: Enables a lightweight tracer that wraps filesystem methods and records calls to `window.__ssg_fs_call_log`.
  - Default: `false` (disabled)
  - When to enable: debugging a sequence of FS calls or investigating permission/guard behavior.
  - How to enable (browser console):
    - `window.__ssg_enable_fs_tracing = true`

- `window.__ssg_debug_logs` (boolean)
  - Purpose: Enables broader debug logging across VFS code. This also enables the FS tracer because tracing checks this flag as well.
  - Default: `false`
  - How to enable: `window.__ssg_debug_logs = true`

- `window.__ssg_skip_sync_after_run` (boolean)
  - Purpose: When set, the expensive post-execution full sync from the runtime FS back to the host backend is skipped.
  - How it's set: The runner will set this automatically for short/read-only snippets (e.g. simple `os.listdir()` runs). You can set it manually to force skipping.
  - How to enable manually: `window.__ssg_skip_sync_after_run = true`

- `window.__ssg_system_write_mode` (boolean)
  - Purpose: Existing global that allows system operations to bypass read-only guards (unchanged, included for completeness).
  - Use carefully and only for controlled operations.

## Code references (where toggles are wired)

- FS tracer install and call logging
  - `src/js/micropython.js` — the runtime `installRuntimeFsGuards` function installs the tracer. The tracer is now installed only when `window.__ssg_enable_fs_tracing` or `window.__ssg_debug_logs` is truthy.

- Full filesystem traversal and sync logic
  - `src/js/vfs-backend.js` — `listFilesFromFS()` and `syncFromEmscripten()` were adjusted:
    - `listFilesFromFS()` avoids expensive `readdir()`-fallback checks where possible (uses `lookupPath`/node mode) and reduces per-entry overhead.
    - `syncFromEmscripten()` now throttles full scans (full scan only every 30s) and performs a quick sync of priority files otherwise.

- Runner / execution sync skip
  - `src/js/execution.js` — runner detects short/read-only snippets and sets `window.__ssg_skip_sync_after_run` to skip expensive post-run syncs.

## Performance implications

- Default (tracing disabled):
  - Fast execution for common student operations (e.g. `os.listdir()`), low memory and CPU overhead.

- Tracing enabled (`__ssg_enable_fs_tracing`):
  - Per-filesystem-call overhead: each FS call is wrapped, arguments previewed and pushed into `window.__ssg_fs_call_log`.
  - Can produce large logs and noticeable slowdowns for code that issues many FS calls or a full FS traversal.

- Skipping sync (`__ssg_skip_sync_after_run`):
  - Avoids the expensive traversal + readback after a run. Safe for read-only runs. If writes occurred, skipping may prevent host-side persistence of new files until the next full sync.

## Recommended workflows

- Instructor debugging (temporary tracing):
  1. Open browser console on the app page.
 2. Enable tracing: `window.__ssg_enable_fs_tracing = true` (or `window.__ssg_debug_logs = true`).
 3. Run the student's code that reproduces the issue.
 4. Inspect `window.__ssg_fs_call_log` for the sequence of FS calls and timestamps.
 5. Disable tracing when finished: `window.__ssg_enable_fs_tracing = false` and clear the log: `window.__ssg_fs_call_log = []`.

- Quick performance testing (no tracer):
  - Ensure both `window.__ssg_enable_fs_tracing` and `window.__ssg_debug_logs` are `false` and run the snippet.

## Example console snippets

- Enable full debug logging and tracer:

```js
window.__ssg_debug_logs = true
window.__ssg_enable_fs_tracing = true
```

- Inspect recent FS calls:

```js
(window.__ssg_fs_call_log || []).slice(-50)
```

- Force skip of post-run sync (unsafe if you wrote files and need them persisted immediately):

```js
window.__ssg_skip_sync_after_run = true
```

## Caveats and notes

- Enabling tracing on production or student sessions will slow down file-heavy code and may fill memory with logs. Always re-disable after debugging.
- Skipping the sync after runs can make writes invisible to host-side storage until the next scheduled full sync. Do not enable this permanently if students will be writing files that must persist.

## Suggested UI improvement (future)

- Add an instructor-only debug panel to temporarily toggle `__ssg_debug_logs` / `__ssg_enable_fs_tracing` and to view/clear `__ssg_fs_call_log` without using the dev console.

## When to contact core maintainers

- If you find a case where even with tracing disabled the app is slow, gather a short reproduction (steps + minimal code) and open an issue attaching timings and the environment.

---

Document created automatically by the dev assistant.
