# TODO (Copilot) — Prioritized implementation plan

This document reorganizes the items in `project/TODO.md` into a practical, ordered implementation plan with acceptance criteria, data/contract notes, likely edge cases, and testing hints. After the plan there is a short list of clarifying questions so I can refine priorities or details.

---

## High-level goals
- Provide in-UI, authorable feedback (edit- and runtime-based) that highlights code and explains failures to students.
- Provide a light-weight program testing mechanism authors can define in config, run in the existing runtime, and show results in the Feedback area.
- Provide authoring tools and versioning for config files.
- Allow users to download workspace/snapshots as zip archives.

---

## 1) Feedback subsystem (core infra)
Priority: Highest
Why first: Core for many other features (UI feedback panel, test output hooking, clickable highlights).

Tasks
- Add a stable config schema for feedback entries (store in problem config). Example minimal feedback entry:
  - id: string
  - title: string
  - when: ["edit"|"run"|"test"]
  - pattern: { type: "regex" | "ast", target: "code"|"filename"|"stdout"|"stderr"|"stdin", expression: string }
  - message: string (can include placeholders from capture groups)
  - severity: [info|hint|warning|error]
  - visibleByDefault: boolean
  - action: optional object (e.g. open-file, highlight-line)

Acceptance criteria
- Config file parser validates feedback entries and rejects invalid types.
- A new `Feedback` JS module exports: `resetFeedback(config)`, `evaluateFeedbackOnEdit(code, path)`, `evaluateFeedbackOnRun(ioCapture)`, and emits events for UI to render.
- Feedback data is kept per-config and reset when code is run (per TODO).

Implementation notes
- Keep matching engine pluggable: a registry map for matcher types (`regex`, `ast`). Each matcher returns a list of matches { file?, line?, message, id }.
- For edit-time regexes that target filenames, match against a list of project files (localStorage mirror + FileManager API).
- Add a small `FeedbackStore` that maintains current matches and selected highlight.

Edge cases
- Expensive regexes or very frequent edit evaluation -> debounce and async evaluation (web worker if needed).
- Misbehaving capture groups in messages -> sanitize and escape before insertion.

Tests
- Unit tests for parser/validator, regex matcher, and that resetFeedback clears state.

Estimated effort: 2–3 days

---

## 2) Feedback UI panel & interactions
Priority: High
Why: Users and authors need a visible area for feedback and tests results.

Tasks
- Add a third side-tab (Feedback) next to Instructions/Terminal or a combined tab with subpanels for edit-time feedback and runtime/test feedback.
- Implement `FeedbackList` UI: list of feedback entries, severity icons, badge for match counts, click-to-highlight behavior.
- Highlighting behavior:
  - Clicking a feedback item opens the file (TabManager.openTab) and highlights the line (reuse `highlightMappedTracebackInEditor`).
  - Clicking an already-active feedback clears highlight.
- Add visibility toggle per feedback (visibleByDefault override in UI) with persistence in local UI preferences.

Acceptance criteria
- Feedback items appear when matches are found.
- Click behavior opens file + highlights; toggling behaves as described.

Edge cases
- Multiple matches for same feedback -> list expands to per-match entries.
- Highlighting across multiple files: switch tabs appropriately.

Tests
```markdown
# TODO (Copilot) — Prioritized implementation plan

This document reorganizes the items in `project/TODO.md` into a practical, ordered implementation plan with acceptance criteria, data/contract notes, likely edge cases, and testing hints.

---

## High-level goals
- Provide in-UI, authorable feedback (edit- and runtime-based) that highlights code and explains failures to students.
- Provide a lightweight program testing mechanism authors can define in config, run in the existing runtime, and show results in the Feedback area.
- Provide authoring tools and versioning for config files.
- Allow users to download workspace/snapshots as zip archives.

---

## 1) Feedback subsystem (core infra)
Priority: Highest
Why first: Core for many other features (UI feedback panel, test output hooking, clickable highlights).

Tasks
- Add a stable config schema for feedback entries (store in problem config). Example minimal feedback entry:
  - id: string
  - title: string
  - when: ["edit"|"run"|"test"]
  - pattern: { type: "regex" | "ast", target: "code"|"filename"|"stdout"|"stderr"|"stdin", expression: string }
  - message: string (can include placeholders from capture groups)
  - severity: [info|hint|warning|error]
  - visibleByDefault: boolean
  - action: optional object (e.g. open-file, highlight-line)

Acceptance criteria
- Config file parser validates feedback entries and rejects invalid types.
- A new `Feedback` JS module exports: `resetFeedback(config)`, `evaluateFeedbackOnEdit(code, path)`, `evaluateFeedbackOnRun(ioCapture)`, and emits events for UI to render.
- Feedback data is kept per-config and reset when code is run (per TODO).

Implementation notes
- Keep matching engine pluggable: a registry map for matcher types (`regex`, `ast`). Each matcher returns a list of matches { file?, line?, message, id }.
- For edit-time regexes that target filenames, match against a list of project files (localStorage mirror + FileManager API).
- Add a small `FeedbackStore` that maintains current matches and selected highlight.

Edge cases
- Expensive regexes or very frequent edit evaluation -> debounce and async evaluation (web worker if needed).
- Misbehaving capture groups in messages -> sanitize and escape before insertion.

Tests
- Unit tests for parser/validator, regex matcher, and that resetFeedback clears state.

Estimated effort: 2–3 days

---

## 2) Feedback UI panel & interactions
Priority: High
Why: Users and authors need a visible area for feedback and tests results.

Tasks
- Add a third side-tab (Feedback) next to Instructions/Terminal or a combined tab with subpanels for edit-time feedback and runtime/test feedback.
- Implement `FeedbackList` UI: list of feedback entries, severity icons, badge for match counts, click-to-highlight behavior.
- Highlighting behavior:
  - Clicking a feedback item opens the file (TabManager.openTab) and highlights the line (reuse `highlightMappedTracebackInEditor`).
  - Clicking an already-active feedback clears highlight.
- Add visibility toggle per feedback (visibleByDefault override in UI) with persistence in local UI preferences.

Acceptance criteria
- Feedback items appear when matches are found.
- Click behavior opens file + highlights; toggling behaves as described.

Edge cases
- Multiple matches for same feedback -> list expands to per-match entries.
- Highlighting across multiple files: switch tabs appropriately.

Tests
- Playwright tests that type code triggering a feedback regex and confirm highlight and UI updates.

Estimated effort: 2–3 days

---

## 3) Edit-time matchers: regex + filename matching
Priority: Medium-High
Why: Useful immediate guidance while students type.

Tasks
- Implement regex matcher that supports matching on "code" and on "filename" presence/absence.
- When matching filenames, evaluate against local mirror (`ssg_files_v1`) and FileManager API.
- For code matching, run on current editor contents (debounced) and on file save.

Acceptance criteria
- Feedback entries with `target: filename` return matches if filename exists/doesn't exist as specified.
- Feedback entries with `target: code` highlight the matching line(s).

Edge cases
- Multi-file projects; pattern authors should be explicit about file anchors.

Estimated effort: 1–2 days

---

## 4) Runtime/test-time matchers (stdout/stderr/stdin)
Priority: Medium
Why: Provides feedback from program output and tests.

Tasks
- Ensure program I/O capture is available to matchers (stdout/stderr/stdin). Hooks already exist; wrap them into `evaluateFeedbackOnRun`.
- Provide optional pattern flags for multi-line/regExp/ignore-case.
- Allow feedback to be conditionally visible only when matched.

Acceptance criteria
- Running programs produces feedback hits from stdout/stderr when patterns match.

Edge cases
- Large or binary stdout -> truncate when matching.

Estimated effort: 1 day

---

## 5) AST-based matching (edit-time)
Priority: Medium
Why: Enables structural feedback (e.g. missing return, wrong use of recursion) that regex can't reliably cover.

Tasks
- Pick a lightweight AST parser compatible with the target Python subset. Options:
  - Use an existing JS-based Python parser (if available), or
  - Run a small parser in the MicroPython runtime and return an AST summary (harder).
- Define a small query language for AST checks (e.g. check for presence/absence of nodes, name checks, function signatures).

Acceptance criteria
- Basic AST checks (presence of function defs, assignments, calls with names) work on simple student code.

Edge cases
- Full Python grammar support is heavy; restrict to patterns authors need.

Estimated effort: 3–5 days (depending on approach)

---

## 6) Program testing runner and integration (author-defined tests)
Priority: High (after Feedback core)
Why: Tests produce feedback and are central to assignments.

Tasks
- Add a new script area (or config section) where authors define tests. Test shape example:
  - id
  - description
  - setup: optional files or snapshot to load
  - stdin: optional inputs
  - expected_stdout/expected_stderr: string or regex
  - expected_return: optional object
  - timeoutMs: optional
- Runner contract:
  - Run each test in a fresh runtime state (clear runtime and filesystem or use a snapshot), capture stdout/stderr, and return pass/fail + diffs.
- Integrate test results into Feedback area with per-test feedback mappings.

Acceptance criteria
- Author-defined test suite runs when user requests "Run tests" and results appear in Feedback panel.
- Tests run reliably with timeouts and isolated state.

Edge cases
- Tests that require filesystem state: offer a way in test definition to provide starter files or a snapshot.
- Support flaky tests via retries optional in author config.

Tests
- Unit tests verifying runner captures stdout/stderr and returns accurate pass/fail.
- Playwright verifying UI flow for test run and result display.

Estimated effort: 3–6 days

---

## 7) Authoring tools & config versioning page
Priority: Medium-High
Why: Authors need a pleasant interface for building tests and feedback without hand-editing JSON.

Tasks
- New authoring page (separate route) that loads an existing config and exposes editors for:
  - instructions
  - feedback entries (form-based)
  - tests (form-based)
- Implement simple semantic versioning on save:
  - Maintain a `meta.version` field (semver string) in the config.
  - Automatically suggest a patch bump (e.g. 1.2.0 -> 1.2.1) for routine edits; allow the author to choose minor/major via an explicit selector when desired.
  - Do not attempt to implement a full history/audit UI at this stage (per clarified preference for a simple semantic bump).
- Provide preview / validation panel to show how feedback and tests will behave.

Acceptance criteria
- Authors can load, edit, validate, and save configs with automatic versioning.

Acceptance criteria (updated)
- Authors can load, edit, validate, and save configs; saving will update the `meta.version` field per semantic-version rules (auto-patch suggestion with optional manual override).
- No history UI is required for initial delivery; older versions may be stored as optional snapshots on demand but are not surfaced in a full audit trail UI.

Edge cases
- Conflicting saves: warn and allow merging or overwrite with warning.

Estimated effort: 4–6 days

---

## 8) Workspace/snapshot download as ZIP
Priority: Medium
Why: Useful for students to download their work or authors to archive snapshots.

Tasks
- Add UI actions: "Download workspace" (zips current files) and per-snapshot download link.
- Implement zipping client-side (JS) using a small library (JSZip) or simple in-browser zip creation.
- Respect storage limits and include a small manifest file inside the zip.

Acceptance criteria
- Downloads a zip containing all workspace files with correct paths and a manifest.
- Snapshot downloads are identical to snapshot state.

Edge cases
- Large workspaces hitting memory limits – warn the user and abort gracefully.

Estimated effort: 1–2 days

---

## 9) Misc / polish
- Accessibility: ensure Feedback/Terminal/Editor interactions are keyboard accessible and ARIA-labeled.
- Internationalization: messages in feedback should be localizable.
- Performance: profile feedback evaluation on large files; consider web worker offload.
- Tests: add unit + Playwright flows covering the end-to-end author-config -> student-run -> feedback -> highlight.

Estimated effort: ongoing across implementation

---

## Implementation & engineering notes
- Contracts:
  - Feedback matcher returns: [{ file?: '/path', line?: number, message: string, id: string }]
  - Feedback UI consumes that and allows highlight + toggle.
- Data storage:
  - Keep author configs in `project/configs` or in a centralized server if integrated later. For now, store in local config files and mirror to `localStorage` for runtime tests.
- Safety & sandboxing:
  - Tests and runs must be executed in the same MicroPython runtime page but in a cleared state. Avoid running multiple tests concurrently in the same runtime unless you snapshot/restore.
- Testing approach:
  - Unit tests for each matcher and the parser.
  - Playwright tests for the full flow (edit-time feedback, run-time feedback, test runner UI).

---

## Progress log — what I've implemented so far

Below is a concise record of the work completed in this session so it can be reflected in the TODO and used for follow-up tasks.

- Feedback core API
  - Added `src/js/feedback.js` (core): exports and implements `resetFeedback(config)`, `evaluateFeedbackOnEdit(code, path)`, `evaluateFeedbackOnRun(ioCapture)`, and event emitter `on`/`off` used by UI and app orchestration.
  - Store shape updated to maintain `editMatches` and `runMatches` separately and emit combined `matches` events.
  - Behavior: edit evaluation clears runMatches; run evaluation sets runMatches; resetFeedback clears both.

- Feedback UI
  - Added/updated `src/js/feedback-ui.js`: renders Feedback panel with two sections (Editor feedback / Run-time feedback), shows titles for `visibleByDefault` entries, renders messages only when matched, shows severity icons (💡 ℹ️ ⚠️) and CSS classes, attaches click event that emits `ssg:feedback-click` with payload.
  - Exposed UI hooks: `window.__ssg_set_feedback_config` and `window.__ssg_set_feedback_matches` and `initializeFeedbackUI`.

- Editor integration and evaluation
  - Editor debounce flow triggers `evaluateFeedbackOnEdit` after edits (debounced ~300ms) in `src/js/editor.js`.
  - Execution flow calls `Feedback.evaluateFeedbackOnRun(...)` after runtime output is appended to the terminal, with a short delayed re-evaluation to handle streaming output (`src/js/execution.js`).

- Styling
  - `src/style.css` updated with feedback panel styles, severity color hints, `.feedback-entry`, `.feedback-msg`, and related classes.

- Traceback & highlights
  - `src/js/code-transform.js` contains `highlightMappedTracebackInEditor` and `clearAllErrorHighlights` that store highlights in `window.__ssg_error_highlights_map` and apply to CodeMirror lines when a tab is selected.
  - Fixed a regression where programmatic tab switching cleared highlights: `src/js/tabs.js` now suppresses highlight clearing while `selectTab` performs `cm.setValue(content)` so stored highlights persist across tab switches until a real user edit occurs.

- Tests and test fixes
  - Added and updated Playwright tests around Feedback behavior: `tests/playwright_feedback_run.spec.js`, `tests/playwright_feedback_live.spec.js`, and test harness adjustments.
  - Hardening changes made to tests so they explicitly re-open the Feedback tab when needed and wait for attached + visible states (avoids flakiness when Run activates Terminal).
  - Ran full test suite and iterated until focused flaky tests were stabilized; traces were inspected to diagnose timing races.

Files changed (high level)
- src/js/feedback.js — core feedback store and evaluation
- src/js/feedback-ui.js — feedback panel rendering and hooks
- src/js/execution.js — call evaluateFeedbackOnRun after terminal append + delayed re-eval
- src/js/editor.js — debounce hook to evaluate edits
- src/js/code-transform.js — highlight mapping and storage (existing, exercised/validated)
- src/js/tabs.js — preserve highlights across programmatic tab switches (added suppression flag)
- src/style.css — new panel styles and severity colors
- tests/playwright_feedback_run.spec.js — added/hardened run-time feedback test
- tests/playwright_feedback_live.spec.js — adjusted expectations and robust waits

Status: core flows implemented, UI renders config titles and matches, edit/run separation and semantics implemented, tests updated and passing locally.

---

## Next implementation task (my recommendation)

I recommend implementing the click-to-open-and-highlight feature next. This closes a visible UX gap and enables a natural feedback->editor flow, and it's a small, well-contained task with clear acceptance tests.

Why this next
- It is high-value for student UX: clicking a feedback item should open the file and focus the exact line, which makes feedback actionable.
- Low risk: code paths already exist for highlighting (highlightMappedTracebackInEditor) and for opening tabs (`TabManager.openTab` / `selectTab`). We need to wire the feedback UI click payload to those helpers and ensure the highlight is re-applied reliably.

Planned changes
- Update `src/js/feedback-ui.js` click handler to dispatch the existing `ssg:feedback-click` (already done) and implement a central listener in `src/app.js` (or a new `feedback-click` handler module) that:
  - Receives the feedback entry and its match info (file and line if present).
  - If a `file`/`line` is present: call `TabManager.openTab(file)` then `TabManager.selectTab(file)` and then `highlightMappedTracebackInEditor(file, line)`.
  - If only an id is present, optionally open the doc/help or show the message inline.
- Add a Playwright test that:
  - Installs a feedback rule that anchors to a specific file/line.
  - Opens Feedback panel, clicks the feedback entry, and asserts that the correct tab is active and that the editor line has `cm-error-line` class applied.

Acceptance criteria
- Clicking a feedback entry with a mapped `file` + `line` opens/selects that tab and applies an editor line highlight that persists while the tab is active and until an edit occurs.
- The highlight is reapplied when switching back to the tab (uses `__ssg_error_highlights_map`).
- Playwright test verifies the flow end-to-end.

Estimated effort: 1 day (implementation + test)

If you want I can implement that now: I'll wire the app-level event listener to call `TabManager.openTab` / `selectTab` and `highlightMappedTracebackInEditor`, then add the Playwright test and run the suite.

---

If you'd prefer a different next task, the other good candidates are:
- Add unit tests for the feedback core (validator and matcher) — high ROI for correctness.
- Implement a minimal test-runner UI integration (author-defined tests -> Feedback) — larger but high value.

Tell me which of the above you want me to pick and I'll start the implementation immediately.

```
