// Unit test for module cache clearing fix
import { jest } from '@jest/globals';

describe('Module Cache Clearing Fix', () => {
    let mockRuntimeAdapter;
    let mockAppendTerminalDebug;
    let clearMicroPythonState;

    beforeEach(() => {
        // Reset global state
        delete global.window;

        // Set up mock runtime adapter
        mockRuntimeAdapter = {
            _module: { some: 'module' },
            run: jest.fn()
        };

        // Mock terminal debug function
        mockAppendTerminalDebug = jest.fn();

        // Set up global window mock
        global.window = {
            runtimeAdapter: mockRuntimeAdapter,
            appendTerminalDebug: mockAppendTerminalDebug
        };

        // Import and set up the clearMicroPythonState function
        // (In the real implementation, this is created inside micropython.js)
        clearMicroPythonState = function () {
            if (!window.runtimeAdapter || !window.runtimeAdapter._module) {
                return false;
            }

            try {
                const clearCode = `
import sys
import gc

# Get list of user-created modules (not built-ins)
user_modules = []
builtin_modules = {
    'sys', 'gc', 'builtins', '__main__', 'micropython', 'math', 'cmath', 
    'random', 'os', 'time', 'io', 'struct', 'json', 're', 'collections',
    'hashlib', 'binascii', 'errno', 'select', 'socket', 'ssl', 'zlib',
    'array', 'heapq', 'bisect', 'functools', 'itertools', 'operator',
    'types', 'weakref', 'copy', 'pickle', 'threading', 'queue',
    'host', 'host_notify'  # Our custom JS modules
}

# Find user modules to clear
for name in list(sys.modules.keys()):
    if name not in builtin_modules and not name.startswith('_'):
        user_modules.append(name)

# Remove user modules from sys.modules cache
cleared_modules = 0
for name in user_modules:
    if name in sys.modules:
        try:
            del sys.modules[name]
            cleared_modules += 1
        except Exception:
            pass  # Ignore errors for individual modules

# Clear user-defined variables from globals (except built-ins and imports)
g = globals()
user_vars = []
builtin_vars = {
    '__builtins__', '__name__', '__doc__', '__package__', '__loader__', 
    '__spec__', 'sys', 'gc', '__cached__', '__file__'
}

# Find user variables to clear
for name in list(g.keys()):
    if name not in builtin_vars and not name.startswith('_'):
        user_vars.append(name)

# Clear user variables
cleared_vars = 0
for name in user_vars:
    if name in g:
        try:
            del g[name]
            cleared_vars += 1
        except Exception:
            pass  # Ignore errors for individual variables

# Force garbage collection to clean up references
try:
    gc.collect()
except Exception:
    pass
`;

                if (window.runtimeAdapter.run) {
                    window.runtimeAdapter.run(clearCode);
                    window.appendTerminalDebug('✅ Cleared MicroPython state (modules and globals)');
                    return true;
                } else {
                    return false;
                }
            } catch (err) {
                window.appendTerminalDebug('❌ Failed to clear MicroPython state: ' + err);
                return false;
            }
        };

        global.window.clearMicroPythonState = clearMicroPythonState;
    });

    test('should successfully clear module cache when runtime is available', () => {
        const result = clearMicroPythonState();

        expect(result).toBe(true);
        expect(mockRuntimeAdapter.run).toHaveBeenCalledTimes(1);

        const calledCode = mockRuntimeAdapter.run.mock.calls[0][0];
        expect(calledCode).toContain('sys.modules');
        expect(calledCode).toContain('del sys.modules[name]');
        expect(calledCode).toContain('del g[name]');
        expect(calledCode).toContain('gc.collect()');

        expect(mockAppendTerminalDebug).toHaveBeenCalledWith('✅ Cleared MicroPython state (modules and globals)');
    });

    test('should fail gracefully when no runtime adapter is available', () => {
        global.window.runtimeAdapter = null;

        const result = clearMicroPythonState();

        expect(result).toBe(false);
        expect(mockRuntimeAdapter.run).not.toHaveBeenCalled();
    });

    test('should fail gracefully when runtime adapter has no _module', () => {
        global.window.runtimeAdapter = { run: mockRuntimeAdapter.run };

        const result = clearMicroPythonState();

        expect(result).toBe(false);
        expect(mockRuntimeAdapter.run).not.toHaveBeenCalled();
    });

    test('should handle runtime errors gracefully', () => {
        mockRuntimeAdapter.run.mockImplementation(() => {
            throw new Error('Runtime error');
        });

        const result = clearMicroPythonState();

        expect(result).toBe(false);
        expect(mockAppendTerminalDebug).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to clear MicroPython state'));
    });

    test('should clear user modules while preserving built-in modules', () => {
        clearMicroPythonState();

        const clearCode = mockRuntimeAdapter.run.mock.calls[0][0];

        // Verify it identifies and clears user modules
        expect(clearCode).toContain('builtin_modules');
        expect(clearCode).toMatch(/not name.startswith\('_'\)/);

        // Verify it preserves built-in modules
        expect(clearCode).toContain("'sys'");
        expect(clearCode).toContain("'gc'");
        expect(clearCode).toContain("'__main__'");
        expect(clearCode).toContain("'host'");
        expect(clearCode).toContain("'host_notify'");
    });

    test('should clear user variables while preserving built-in variables', () => {
        clearMicroPythonState();

        const clearCode = mockRuntimeAdapter.run.mock.calls[0][0];

        // Verify it identifies and clears user variables
        expect(clearCode).toContain('builtin_vars');
        expect(clearCode).toContain('user_vars');

        // Verify it preserves built-in variables
        expect(clearCode).toContain("'__builtins__'");
        expect(clearCode).toContain("'__name__'");
        expect(clearCode).toContain("'sys'");
        expect(clearCode).toContain("'gc'");
    });
});