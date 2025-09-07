## Test normalization and verification codes

Purpose
-------
This document explains, in practical terms, what in a test (or a test suite) affects the verification code that students receive when their submission passes all tests.

Audience: authors who write tests. You don't need to understand hashing internals — this explains what you can and can't change without affecting the verification code.

Quick summary
-------------
- A verification code is produced from three things: a canonical fingerprint of the test suite, the student identifier, and the current date (YYYY-MM-DD).
- Anything that changes the canonical fingerprint of the test suite will change the verification code for every student.
- Some fields are intentionally ignored (UI text, failure messages, conditional display flags), so changing them does not affect codes.

What the system uses to build the test-suite fingerprint
-------------------------------------------------------
Before creating a fingerprint the system runs a normalization step to produce a canonical, deterministic representation of your tests. That representation is what gets hashed. The normalization does the following (high level):

- Parses `tests` whether you provide them as an array or as a grouped object (`{ groups: [...], ungrouped: [...] }`).
- For each test it keeps only a small set of fields that matter for verification and discards UI-only fields.
- Sorts groups and tests by identifier so ordering changes do not affect the fingerprint.
- Recursively sorts object keys so JSON key order never changes the canonical string.

Fields that DO affect the fingerprint (and therefore the verification code)
----------------------------------------------------------------------
These are the fields included in the canonical representation for each test:

- `id` — test identifier. Changing the id will always change the fingerprint.
- `description` — the author-supplied description text.
- `stdin` — any input provided to the test.
- `expected_stdout` — what the test expects. This may be a string or a regex object (see below).
- `expected_stderr` — expected error output, if present.
- `timeoutMs` — the timeout used when running the test (defaults to 5000ms if omitted).
- `ast` — for AST-style tests that include AST rule objects, the `ast` object is included and any changes to it (rule, matcher, file target, etc.) change the fingerprint.

Notes on regexes and structured expected values
---------------------------------------------
- If `expected_stdout` is a regex object (for example `{ type: 'regex', expression: '.+', flags: '' }`) the entire object is canonicalized and included — changing `expression` or `flags` will change the fingerprint.

Fields that DO NOT affect the fingerprint
----------------------------------------
- `failureMessage` — this is only shown to students and is ignored for hashing.
- `conditional` (per-test or per-group) — run-if flags used by the test runner are ignored for hashing.
- `collapsed`, UI state, editor-only metadata — these are not part of the canonical representation.

Grouped tests and ordering
-------------------------
- If you use grouped tests (`groups` + `ungrouped`), the normalizer includes each group's `id` and `name`, and the group's tests (cleaned as above).
- Groups and tests are sorted by id (with `name` as a fallback) so reordering groups or reordering tests in the editor does not change the fingerprint, as long as ids are stable.

Normalization details that affect whether a change matters
--------------------------------------------------------
- `null` vs missing: `expected_stdout` and `expected_stderr` that are `null` or omitted are normalized to an empty value — switching between `null` and omitted usually does not change the fingerprint.
- Defaults: if `timeoutMs` is omitted it defaults to 5000; explicitly setting `timeoutMs: 5000` is equivalent to omitting it.
- Key ordering: object keys are sorted before hashing, so changing the order of keys (for instance in an AST rule object) will not change the fingerprint.

Practical guidance for authors
------------------------------
- Use stable `id` values for tests and groups. Changing ids is the most direct way to change the fingerprint.
- You can safely update `failureMessage`, presentation text, `conditional` flags and other UI fields without changing verification codes.
- Be careful changing `expected_stdout`, `stdin`, `description`, `timeoutMs`, or AST rule contents — these will change the fingerprint.
- For AST tests, keep the rule definitions deterministic and avoid adding ephemeral or runtime-generated fields to the `ast` object.

Debugging and verification (how to inspect the canonical representation)
------------------------------------------------------------------------
If you want to see exactly what the system hashes, you can run a short Node script that uses the same normalization routine the app uses. Save the following as `show-test-hash.js` in the project root and run `node show-test-hash.js`.

```javascript
// Example script (save as show-test-hash.js)
import fs from 'fs'
import { normalizeTestsForHash, canonicalizeForHash } from './src/js/normalize-tests.js'
import crypto from 'crypto'

const raw = JSON.parse(fs.readFileSync(process.argv[2] || 'tmp/debug_test_config.json', 'utf8'))
const normalized = normalizeTestsForHash({ tests: raw })
const canonical = canonicalizeForHash(normalized)
const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16)

console.log('Canonical JSON:\n', canonical)
console.log('\nTest-suite hash (first 16 hex chars):', hash)

// Final verification code uses: `${hash}:${studentId}:${YYYY-MM-DD}` then SHA-256+map to words
```

Notes
-----
- The verification code also depends on the student identifier and the current date (UTC-local date string, YYYY-MM-DD). Even with an unchanged fingerprint, changing student id or generating the code on a different day will produce a different verification code.
- The system purposely ignores UI-only fields so teachers can tune messages and display settings without invalidating student codes.
