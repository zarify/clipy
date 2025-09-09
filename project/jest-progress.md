## Jest test coverage gaps — checklist

Replace this file with the list of source files lacking direct unit tests (checked items mean tests exist).

- [x] src/js/ast-analyzer.js  (tests added: src/js/__tests__/ast-analyzer.test.js)
- [x] src/js/ast-rule-builder.js  (tests added: src/js/__tests__/ast-rule-builder.test.js)
- [x] src/js/ast-test-builder.js  (tests added: src/js/__tests__/ast-test-builder.test.js, src/js/__tests__/ast-test-builder.edgecases.test.js)
- [ ] src/js/author-feedback.js
- [x] src/js/author-page.js  (tests added: src/js/__tests__/author-page.test.js)
- [x] src/js/author-storage.js
- [x] src/js/author-tests.js  (tests added: src/js/__tests__/author-tests.test.js, src/js/__tests__/author-tests.edgecases.test.js, src/js/__tests__/author-tests.expand.test.js, src/js/__tests__/author-tests.modal-editor.test.js)
- [ ] src/js/author-verification.js
- [ ] src/js/autosave.js
- [x] src/js/autosave.js  (tests added: src/js/__tests__/autosave.test.js)
- [ ] src/js/download.js
- [x] src/js/editor.js
- [ ] src/js/feedback-ui.js
- [ ] src/js/feedback.js
- [x] src/js/input-handling.js
- [ ] src/js/logger.js
- [ ] src/js/modals.js
- [ ] src/js/normalize-tests.js
- [ ] src/js/storage.js
- [ ] src/js/tabs.js
- [x] src/js/test-runner-adapter.js
- [x] src/js/test-runner-sandbox.js
- [x] src/js/test-runner.js
- [x] src/js/test-runner extra coverage (tests added: src/js/__tests__/test-runner.extra.test.js)
- [ ] src/js/traceback_mapper.js
- [ ] src/js/vfs-glue.js
- [ ] src/js/zero-knowledge-verification.js

---

For each file above, add focused subtasks describing recommended tests. Keep tests small and runnable under Jest (jsdom) where possible. Below are recommended subtasks per file.

- src/js/ast-analyzer.js
	- [ ] unit: parse small AST snippets and verify returned analysis shape
	- [ ] unit: edge cases (empty input, invalid nodes)
	- [ ] integration: feed analyzer output to `ast-rule-builder` to assert end-to-end rules

- src/js/ast-rule-builder.js
	- [ ] unit: build rules from fixtures and assert expected matcher functions
	- [ ] unit: invalid rule definitions produce helpful errors
	- [ ] integration: combined with `ast-test-builder` to verify rule enforcement on test examples

- src/js/ast-test-builder.js
	- [ ] unit: transform test ASTs into runnable test objects
	- [ ] unit: boundary tests for deeply nested/large ASTs

- src/js/author-feedback.js
	- [ ] unit: formatting of feedback messages, sanitization, and truncation logic
	- [ ] integration: simulate receiving runtime errors and assert produced feedback payload

- src/js/author-page.js
	- [ ] unit: page-level helper functions (URL params, restore state)
	- [ ] e2e-ish: mount simple DOM and assert UI wiring (using jsdom)

- src/js/author-storage.js
	- [ ] unit: read/write abstraction tests using an in-memory/localStorage mock
	- [ ] edge: storage quota / serialization failures handling

- src/js/author-tests.js
	- [ ] unit: test import/export of author-defined tests and meta-data handling
	- [ ] integration: run author tests against a sample runner stub to assert pass/fail mapping

- src/js/author-verification.js
	- [ ] unit: correctness of verification algorithm on known-good/bad inputs
	- [ ] integration: wire into zero-knowledge verification stubs to validate expected calls

- src/js/autosave.js
	- [ ] unit: timer-based save scheduling, debouncing behavior
	- [ ] unit: cancel/restore logic when document changes rapidly

- src/js/download.js
	- [ ] unit: blob / data URL creation and filename handling
	- [ ] integration: mock anchor click to verify download trigger

- src/js/editor.js
	- [ ] unit: cursor/selection helpers and serialization
	- [ ] unit: undo/redo buffer behavior (small sequences)
	- [ ] integration: mount editor component in jsdom and simulate basic edits

- src/js/feedback-ui.js
	- [ ] unit: rendering logic given different feedback payloads (errors, hints)
	- [ ] integration: simulate user actions that dismiss/expand feedback and verify state

- src/js/feedback.js
	- [ ] unit: feedback aggregation and severity ordering
	- [ ] integration: ensure runtime errors produce correct feedback objects

- src/js/input-handling.js
	- [ ] unit: stdin buffering, line-oriented reads, and EOF handling
	- [ ] unit: concurrent read requests and queuing behavior
	- [ ] integration: couple with a fake runtime adapter to validate host<->VM input exchange

- src/js/logger.js
	- [ ] unit: log level filtering, message formatting
	- [ ] integration: assert that certain modules call logger with expected messages (use spies)

- src/js/modals.js
	- [ ] unit: modal open/close state transitions and focus trapping helpers
	- [ ] integration: keyboard interactions (Escape to close) in jsdom

- src/js/normalize-tests.js
	- [ ] unit: normalization rules for test fixtures and edge cases (duplicate names, missing fields)
	- [ ] integration: verify normalized tests feed into test-runner with expected structure

- src/js/storage.js
	- [ ] unit: read/write/delete operations with a mock backend (IndexedDB/localStorage abstraction)
	- [ ] edge: simulate backend failures and verify retry/failure paths

- src/js/tabs.js
	- [ ] unit: tab activation, close, and reordering logic
	- [ ] integration: assert UI updates in jsdom when switching tabs

- src/js/test-runner-adapter.js
	- [ ] unit: adapter contract compliance (run, runPythonAsync, interrupt, setYielding)
	- [ ] integration: load vendored runtime stub and exercise API surface in a child process (spawn)

- src/js/test-runner-sandbox.js
	- [ ] unit: sandbox initialization, message dispatch, and teardown
	- [ ] integration: spawn a worker/child and assert messages are marshalled correctly

- src/js/test-runner.js
	- [ ] unit: orchestration logic (start/stop suite, per-test lifecycle hooks)
	- [ ] integration: run a tiny test suite with a stubbed adapter and assert reporter events

- src/js/traceback_mapper.js
	- [ ] unit: mapping of runtime stack traces to source locations; test with synthetic traces
	- [ ] edge: partial/garbled trace inputs

- src/js/vfs-glue.js
	- [ ] unit: glue layer between runtime FS and host VFS client (path normalization, error translation)
	- [ ] integration: simulate runtime writes and assert host notifications are emitted

- src/js/zero-knowledge-verification.js
	- [ ] unit: verification steps, deterministic outputs for fixed inputs
	- [ ] integration: verify interaction with author-verification and reporter stubs


### Suggested next steps

1. Prioritize `src/js/editor.js`, `src/js/input-handling.js`, and the `test-runner*` files for tests.
2. Add small unit tests first (API surface + edge cases), then add a couple of focused integration tests where necessary.
3. Mark items as done by checking the box when tests are added and committed.
