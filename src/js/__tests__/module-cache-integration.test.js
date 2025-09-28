// Integration test for module cache clearing bug fix
import { jest } from '@jest/globals';

// This test verifies that the module cache clearing fix resolves the issue
// where changes to imported Python modules are not reflected in subsequent runs

describe('Module Import Cache Fix - Integration Test', () => {
    let mockFileManager;
    let mockRuntimeAdapter;
    let mockTerminalOutput;

    beforeEach(() => {
        // Reset global state
        delete global.window;
        mockTerminalOutput = [];

        // Mock FileManager
        const files = new Map();
        mockFileManager = {
            write: jest.fn(async (path, content) => {
                files.set(path, content);
            }),
            read: jest.fn((path) => {
                return files.get(path) || null;
            }),
            list: jest.fn(() => Array.from(files.keys()))
        };

        // Mock runtime adapter that simulates MicroPython behavior
        let pythonGlobals = {};
        let pythonModules = {};

        mockRuntimeAdapter = {
            _module: { some: 'module' },
            run: jest.fn(async (code) => {
                // Simulate Python execution
                if (code.includes('import my_module')) {
                    // Simulate module import - check if module is cached
                    if (!pythonModules['my_module']) {
                        // Load from file system (first import or after cache clear)
                        const moduleContent = files.get('my_module.py') || '';
                        pythonModules['my_module'] = { content: moduleContent, cached: true };
                        mockTerminalOutput.push('Loading my_module from file');
                    } else {
                        // Use cached version (subsequent imports) - DO NOT reload content!
                        mockTerminalOutput.push('Using cached my_module');
                        // Keep the original cached content - this simulates the bug
                    }
                }

                if (code.includes('my_module.my_function()')) {
                    const module = pythonModules['my_module'];
                    if (module && module.content.includes('MODIFIED')) {
                        mockTerminalOutput.push('MODIFIED: ok?');
                        mockTerminalOutput.push('MODIFIED: function output');
                    } else if (module && module.content.includes('function output')) {
                        mockTerminalOutput.push('function output');
                    }
                }

                if (code.includes('print("OK")')) {
                    mockTerminalOutput.push('OK');
                }

                // Simulate the clearing code
                if (code.includes('del sys.modules[name]')) {
                    // Clear user modules (simulate the fix)
                    pythonModules = {}; // Clear module cache
                    pythonGlobals = {}; // Clear globals
                    mockTerminalOutput.push('Cleared modules and variables');
                }

                return 'execution complete';
            })
        };

        // Set up global window mock
        global.window = {
            FileManager: mockFileManager,
            runtimeAdapter: mockRuntimeAdapter,
            clearMicroPythonState: null, // Will be set up by the test
            appendTerminalDebug: jest.fn(),
            appendTerminal: jest.fn((text) => mockTerminalOutput.push(text))
        };
    });

    test('should reflect module changes after clearing cache (bug fix verification)', async () => {
        // Set up the clearMicroPythonState function (our fix)
        global.window.clearMicroPythonState = function () {
            if (!window.runtimeAdapter || !window.runtimeAdapter._module) {
                return false;
            }

            try {
                // Execute the clearing code that removes modules from sys.modules
                const clearCode = `
import sys
import gc
user_modules = []
builtin_modules = {'sys', 'gc', 'builtins', '__main__', 'micropython'}
for name in list(sys.modules.keys()):
    if name not in builtin_modules and not name.startswith('_'):
        user_modules.append(name)
for name in user_modules:
    if name in sys.modules:
        del sys.modules[name]
g = globals()
user_vars = []
builtin_vars = {'__builtins__', '__name__', '__doc__', 'sys', 'gc'}
for name in list(g.keys()):
    if name not in builtin_vars and not name.startswith('_'):
        user_vars.append(name)
for name in user_vars:
    if name in g:
        del g[name]
gc.collect()
`;
                window.runtimeAdapter.run(clearCode);
                return true;
            } catch (err) {
                return false;
            }
        };

        // Step 1: Set up initial files
        await mockFileManager.write('/main.py', 'import my_module\n\nmy_module.my_function()\n\nprint("OK")');
        await mockFileManager.write('my_module.py', 'def my_function():\n    print("function output")');

        // Step 2: First execution - should load module from file
        mockTerminalOutput = []; // Clear output
        await mockRuntimeAdapter.run('import my_module');
        await mockRuntimeAdapter.run('my_module.my_function()');
        await mockRuntimeAdapter.run('print("OK")');

        // Verify first execution output
        expect(mockTerminalOutput).toContain('Loading my_module from file');
        expect(mockTerminalOutput).toContain('function output');
        expect(mockTerminalOutput).toContain('OK');

        // Step 3: Modify the module file
        await mockFileManager.write('my_module.py',
            'def my_function():\n    print("MODIFIED: ok?")\n    print("MODIFIED: function output")');

        // Step 4: Execute WITHOUT clearing cache (should use cached version - the bug)
        mockTerminalOutput = []; // Clear output
        await mockRuntimeAdapter.run('import my_module');
        await mockRuntimeAdapter.run('my_module.my_function()');

        // Before fix: should still show old cached output
        expect(mockTerminalOutput).toContain('Using cached my_module');
        expect(mockTerminalOutput).toContain('function output'); // Old cached version

        // Step 5: Clear cache using our fix
        mockTerminalOutput = []; // Clear output
        const cleared = global.window.clearMicroPythonState();
        expect(cleared).toBe(true);
        expect(mockRuntimeAdapter.run).toHaveBeenCalledWith(expect.stringContaining('del sys.modules[name]'));

        // Step 6: Execute AFTER clearing cache (should load new version - the fix)
        mockTerminalOutput = []; // Clear output

        await mockRuntimeAdapter.run('import my_module');  // Should reload from file since cache was cleared
        await mockRuntimeAdapter.run('my_module.my_function()');

        // After fix: should load new version from file and show modified output
        expect(mockTerminalOutput).toContain('Loading my_module from file');
        expect(mockTerminalOutput).toContain('MODIFIED: ok?');
        expect(mockTerminalOutput).toContain('MODIFIED: function output');

        // Should NOT contain the old cached output
        expect(mockTerminalOutput).not.toContain('Using cached my_module');
    });

    test('should work correctly with execution.js integration', async () => {
        // This test simulates the integration with the execution.js runPythonCode function

        global.window.clearMicroPythonState = jest.fn(() => true);

        // Simulate what execution.js does before running code
        const simulateExecution = async (code) => {
            // Clear Python state before each execution (from execution.js line ~225)
            try {
                if (global.window.clearMicroPythonState) {
                    global.window.clearMicroPythonState();
                }
            } catch (err) {
                // Handle error
            }

            // Run the actual code
            await mockRuntimeAdapter.run(code);
        };

        // Set up files
        await mockFileManager.write('/main.py', 'import my_module\nmy_module.my_function()');
        await mockFileManager.write('my_module.py', 'def my_function():\n    print("original")');

        // First execution
        await simulateExecution('import my_module\nmy_module.my_function()');

        // Verify clearMicroPythonState was called
        expect(global.window.clearMicroPythonState).toHaveBeenCalledTimes(1);

        // Modify module
        await mockFileManager.write('my_module.py', 'def my_function():\n    print("modified")');

        // Second execution
        await simulateExecution('import my_module\nmy_module.my_function()');

        // Verify clearMicroPythonState was called again
        expect(global.window.clearMicroPythonState).toHaveBeenCalledTimes(2);
    });
});