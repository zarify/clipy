# stderr capture option — design notes

This document describes an alternative approach for deterministically capturing a program's stderr by redirecting it to a file in the runtime filesystem, then reading that file after execution. Keep this as a reference; the project currently uses streamed callbacks + heuristics, but this approach is useful as a fallback or for deterministic grading.

## Overview

Sequence:

1. Create/clear a file in the runtime FS (example: `/__clipy_stderr_<test-id>.txt`).
2. Run the user's code under a small wrapper that sets `sys.stderr` to that file (and flushes/close in a `finally` block).
3. After the run (normal completion / exception / timeout handling), read the file from the runtime FS and treat its contents as the canonical stderr output.

This produces a single canonical post-run stderr snapshot instead of relying on pattern matching in streamed output.

## Example wrapper

Write a small module such as `/__stderr_redirect.py` into the runtime FS and run it with `import __stderr_redirect`.

```python
# /__stderr_redirect.py
import sys
try:
    f = open('/__clipy_stderr.txt', 'w')
    sys.stderr = f
    # run the user's main
    import main
finally:
    try:
        sys.stderr.flush()
    except Exception:
        pass
    try:
        f.close()
    except Exception:
        pass
```

Notes:
- Writing this wrapper as a separate module keeps the user's `/main.py` intact so tracebacks still reference `/main.py` (with one extra wrapper frame).
- If you instead prepend the redirection lines into `/main.py`, tracebacks will point only to `/main.py` but line offsets will change.

## Integration sketch (iframe-runner)

- Before running a test:
  - writeFilesToFS({ '/__clipy_stderr.txt': '' })
  - writeFilesToFS({ '/__stderr_redirect.py': wrapperText })
- Execute: `await runtimeAdapter.run('import __stderr_redirect')` (wrap in try/catch as usual).
- After execution (or in timeout/interrupt handler), read the file:
  - `const stderrText = mpInstance.FS.readFile('/__clipy_stderr.txt', { encoding: 'utf8' })`
  - If non-empty, post a final `stderr` chunk and/or set `stderrBuf` to this value.
- Ensure cleanup: remove or clear the file at start of next run.

## Edge cases and pitfalls

- Buffering and crash: if the runtime aborts or the VM is terminated before the wrapper's `finally` runs, buffered data may be lost. The runner should still attempt to read the file after interrupts and treat partial contents as valid.
- Live streaming: redirecting stderr to a file prevents live stderr streaming to the host. If live UI is desired, keep the runtime stderr callback and use the file only post-run as a fallback.
- FS compatibility: confirm the target MicroPython/WebAssembly runtime supports file open/write and that `/` is writable. Different runtimes sometimes have subtle FS differences.
- Traceback noise: a wrapper that imports `main` adds one extra frame; a wrapper that uses `exec`/`compile` can create `File "<stdin>"` lines — prefer the separate-module import pattern to avoid `"<stdin>"` noise.
- Namespacing: use per-test filenames (e.g. `/__clipy_stderr_<id>.txt`) to avoid collision with user files.

## Pros and cons

Pros:
- Deterministic post-run stderr snapshot; easier to decide "is there stderr?" without pattern heuristics.
- Works when runtimes surface tracebacks in non-standard channels (e.g. rejected promises or stdout).

Cons:
- No live streaming unless combined with the existing streaming callbacks.
- May miss last buffered writes if the VM is force-terminated before flush.
- Slightly invasive: requires writing an extra module into the runtime FS.

## Recommended hybrid

Keep live stdout/stderr streaming via the runtime callbacks (best UX). Also write the stderr-redirect wrapper and, after run completion (or timeout/interrupt), read `/__clipy_stderr_<id>.txt`. Use the file contents only when streamed `stderr` is empty or to deterministically decide whether a traceback occurred. This gives live UX plus a reliable fallback for grading.

## When to use

- Use as a fallback when runtimes behave inconsistently and you need a single reliable source of stderr for grading.
- Use as a temporary diagnostic tool when debugging why tracebacks are not being surfaced.

---

End of design notes.
