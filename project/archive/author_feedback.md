## Authoring feedback rules (Clipy)

Clipy supports two broad kinds of feedback rules: edit-time and run-time. These rules let course authors provide targeted hints, line highlights, and actionable messages to learners.

### Where to put feedback rules

Feedback rules live in the configuration under the `feedback` array. The Feedback subsystem exposes `window.Feedback` and emits `matches` events that the UI consumes.

### Feedback entry shape

Each feedback rule is an object. Example:

```
{
  id: 'f1',
  title: 'Missing comment',
  when: ['edit'],          // 'edit' | 'run' or both
  severity: 'hint',        // 'hint' | 'info' | 'warning'
  pattern: { type: 'regex', target: 'code', expression: 'TODO', flags: '' },
  message: 'Please add a comment explaining this function.',
  visibleByDefault: true,
  action: { type: 'open-file', path: '/helper.py' }
}
```

Fields explained:
- `id`: stable identifier for the rule (used to map matches to UI entries).
- `title`: short human title.
- `when`: array indicating when this rule should be evaluated: `edit` (on editor changes), `run` (after program execution), or both.
- `severity`: affects iconography and styling in the UI.
- `pattern`: how to match. Supported shapes:
  - `{ type: 'regex', target: 'code'|'stdout'|'stderr'|'filename', expression: '...', flags: '' }` — regular expression matching against the chosen target. For `filename`, the runner accepts either a string, array or newline-joined list.
  - Other matcher types may be supported in future; regex is the primary current option.
- `message`: text shown to learners. Capture groups from regex patterns can be inserted using `$1` style placeholders.
- `visibleByDefault`: if true, the rule's UI entry is shown even when not matched (helps authors provide guidance proactively).
- `action`: optional object describing an action to take when a learner clicks the UI entry. Example actions:
  - `{ type: 'open-file', path: '/helper.py' }` — open/select the given file and highlight a mapped line if present.

### Edit-time feedback

Edit-time rules are evaluated when the editor contents change. Typical uses:
- Detect TODO markers, missing docstrings, or banned constructs in the current file.
- Provide hints attached to specific files/lines by using the `pattern.target = 'code'` matcher and converting to a mapped file/line using the Feedback UI click handlers.

Behavior notes:
- Edit matches are stored separately from run-time matches so the UI can communicate both simultaneously.
- Clicking an edit-time match will attempt to open the file and highlight the relevant line if the rule provides `file/line` or the pattern yields a mapped location.

### Run-time feedback

Run-time rules are evaluated after program execution and receive program captures such as `stdout`, `stderr`, and `filename` lists. Typical uses:
- Match specific runtime errors or expected output strings.
- Surface file-specific runtime errors by matching `stderr` and mapping tracebacks to file/line locations.

Behavior notes:
- The execution engine gathers terminal output and the last-mapped traceback (if any) and calls the feedback evaluator with `{ stdout, stderr, filename }`.
- Run-time matches can be used to trigger editor highlights associated with files mentioned in the runtime (e.g. when your matcher targets `filename`).

### Click-to-open and highlights

- The Feedback UI entries are clickable. When clicked, the UI emits a `ssg:feedback-click` event with the entry and match payload.
- The application listens for this event and will attempt to open/select the file and apply a highlight via `highlightFeedbackLine(file, line)`.
- Programmatic tab switches suppress highlight-clearing logic so feedback highlights persist across automatic tab changes.

### Precedence & clearing behavior

- Feedback highlights are separate from persistent error highlights (used for tracebacks). When feedback highlights are cleared, persistent error highlights may be re-applied so the user doesn't lose important error markers.
- Edit or run evaluations typically clear previous feedback highlights before re-applying new ones.

### Examples

- Edit rule to find TODOs:

```
{ id: 'todo', title: 'TODO found', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: 'TODO', flags: '' }, message: 'Remember to implement this.' }
```

- Run rule to detect a failing assertion printed to stdout:

```
{ id: 'assert', title: 'Assertion failure', when: ['run'], pattern: { type: 'regex', target: 'stderr', expression: 'AssertionError:(.*)', flags: '' }, message: 'Your program raised: $1' }
```

### Implementation pointers

- The Feedback core is implemented in `src/js/feedback.js` and the UI in `src/js/feedback-ui.js`.
- Use `window.Feedback.resetFeedback(cfg)` to load new feedback rules at runtime, and `window.Feedback.evaluateFeedbackOnRun({ stdout, stderr, filename })` to push run-time captures into the evaluator.

---
This document is a living guide. If you'd like authoring helpers (linting for feedback rules, previewing matches, or richer match types), I can add tooling and examples.
