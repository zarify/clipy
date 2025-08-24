# Test Directory

This directory contains various test utilities and documentation for the Clipy project.

## Current Files

- `test_smoke.py`: Basic smoke tests verifying scaffold files exist and key functionality
- `test_storage.js`: Tests for the storage adapter functionality
- `vfs_test.js`: Tests for the VFS (Virtual File System) implementation
- `vfs_dir_behavior_test.js`: Tests for VFS directory behavior and nested file handling
- `traceback_mapper_test.js`: Tests for Python traceback line number mapping
- `test_server.py`: Development HTTP server utility
- `tests.md`: Test documentation and instructions
- `untested.md`: Documentation of functionality that needs manual testing

## Running Tests

### Python Smoke Tests
```bash
python -m unittest test/test_smoke.py
```

### Node.js Tests
```bash
node test/test_storage.js
node test/vfs_test.js
node test/vfs_dir_behavior_test.js
node test/traceback_mapper_test.js
```

### Playwright Browser Tests
Start a static server at the repo root and run the Firefox-only Playwright tests:

```bash
python -m http.server 8000
npm run test:playwright
```

Tests are located in the `tests/` directory and exercise tabs, VFS mounting, stdin handling, and run persistence.

## Notes

The main application now uses asyncify-enabled MicroPython for input handling, which eliminates the need for browser prompts and provides a seamless terminal-like experience. All input handling is done directly in the main thread without Web Workers.
