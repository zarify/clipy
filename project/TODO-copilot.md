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

## Gaps or enhancements I recommend
- Capture of source code locations from AST matchers so messages can be anchored to exact nodes rather than line guesses.
- A simple author preview panel that runs their regex/AST checks against a sample code input to show matches instantly.
- A small migration utility to convert older configs to new schema (helpful once we iterate schema changes).
- Consider feedback templating with capture-based placeholders (e.g. `{{1}}` for regex group 1) to make messages more informative.
- Consider server-side optional execution for heavy AST parsing or complex test suites if client performance becomes an issue.

Note on versioning: per your preference for a simple semantic-version bump (clarifying question 5), I recommend implementing the auto-patch suggestion + manual override approach above. We can add a lightweight snapshot-on-save option later if you want the ability to store individual snapshots without building a full audit UI.

---

## Clarifying questions
1. Where should author configs be stored/managed long-term? (local repo files, server backend, or both?)
- Author configs should be downloaded.
- Problem configs should be able to be loaded via a URL parameter, so that a page+params can be bookmarked or linked to. This also lets us store configs locally and load them via URL param
2. Do you want feedback patterns to support capture-group substitution in messages (e.g. show `Found unexpected variable: \1`)?
- Yes, as long as it doesn't come at too high an authoring complexity cost. If it becomes too complex, consider a 'feedback builder' function that assembles the rules for an author.
3. For AST-based matching: do you prefer a JS-side Python parser, or should we attempt to run AST checks inside the MicroPython runtime and expose a small IPC? (trade-offs documented above)
- Since the runtime is modified I would prefer a JS Python parser that will work on the student code, not the code that is actually running in the runtime
4. For program testing, should tests run in an isolated clone of the current workspace (snapshot) or be ok to run in-place if we `clearMicroPythonState()` between tests?
- They should be ok to run in-place as long as state is cleared. However we will need to suppress the regular output and FS state in the UI while running the tests and just show the results.
5. Do we need user-visible versioning history for configs (audit trail), or is a simple semantic-version bump enough?
- Simple semantic version bump is enough.
6. Any specific size limits or UX expectations for zipping/downloading workspaces/snapshots?
- I would not expect any size limit issues, and at the end of the day it's the student's machine. Perhaps just put a sensible high end limit like 10MB or something.

---

If that order/priority looks good I will create `project/TODO-copilot.md` (already created) and can start implementing the top-priority items — tell me which one you'd like me to start with and I'll create specific implementation tasks and PR-style changes.
