# Tests

- test_smoke.py: basic smoke tests verifying scaffold files exist and simple runtime/config wiring. Confidence: medium (checks only static files and key strings).

Run locally:

```bash
python -m unittest test/test_smoke.py
```

Playwright browser tests (Firefox)
---------------------------------

Start a static server at the repo root and run the Firefox-only Playwright tests:

```bash
python -m http.server 8000
npm run test:playwright
```

Tests are located in the `tests/` directory and exercise tabs, VFS mounting, and run persistence.
