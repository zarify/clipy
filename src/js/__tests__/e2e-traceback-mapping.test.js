/**
 * End-to-End Traceback Mapping Test
 * 
 * This test loads the actual terminal module and tests the complete
 * traceback mapping flow to identify where the real issue is.
 */

describe('E2E Traceback Mapping', () => {
    let terminalModule;

    // Helper to support environments where `jest` may not be a top-level
    // binding (ESM/VM modules). Prefer the real `jest` when available;
    // otherwise provide a tiny mock that records calls on `.mock.calls` so
    // the tests can still assert how many times a mock was invoked.
    const _jest = (typeof jest !== 'undefined') ? jest : {
        fn: (impl) => {
            const f = (...args) => {
                try { f.mock.calls.push(args) } catch (_e) { }
                if (typeof impl === 'function') return impl(...args)
            }
            f.mock = { calls: [] }
            return f
        }
    }

    beforeAll(async () => {
        // Set up DOM environment to match the actual app
        document.body.innerHTML = `
            <div id="terminal-output"></div>
            <div id="terminal"></div>
            <textarea id="code-editor"></textarea>
            <button id="run">Run</button>
            <button id="stop">Stop</button>
            <input id="stdin-box" type="text" />
        `;

        // Set up global functions that the runtime expects
        window.$ = (id) => document.getElementById(id);

        // Import the actual terminal module
        terminalModule = await import('../terminal.js');
    });

    beforeEach(() => {
        // Clear event log before each test
        window.__ssg_terminal_event_log = [];

        // Clear terminal content
        const terminal = document.getElementById('terminal-output');
        if (terminal) terminal.innerHTML = '';

        // Reset all global state
        delete window.__ssg_last_mapped_event;
        delete window.__ssg_suppress_raw_stderr_until;
        window.__ssg_mapping_in_progress = false;
        window.__ssg_stderr_buffering = false;

        // Clear any pending timers
        if (typeof jest !== 'undefined' && jest.clearAllTimers) {
            jest.clearAllTimers();
        }
    });

    afterAll(() => {
        // Clean up DOM
        document.body.innerHTML = '';
    });

    test('real terminal module traceback mapping', async () => {
        console.log('🧪 Testing real terminal module traceback mapping...');

        // Set up execution context - this is crucial
        window.__ssg_last_mapped_event = { headerLines: 21 };
        window.__ssg_mapping_in_progress = false;
        window.__ssg_stderr_buffering = false;

        console.log('� Set execution context with headerLines=21');

        // Create terminal instance using the actual module
        const terminalInstance = terminalModule.createTerminal(window);

        // Set up mock functions for dependencies
        window.mapTracebackAndShow = _jest.fn((text, headerLines) => {
            console.log(`🗺️  mapTracebackAndShow called with headerLines=${headerLines}`);
            console.log(`📝 Original text: ${text}`);

            // Simulate the real mapping behavior
            const mapped = text.replace(/line 22/, 'line 1');
            console.log(`📝 Mapped text: ${mapped}`);
            return mapped;
        });

        // Mock replaceBufferedStderr
        window.replaceBufferedStderr = _jest.fn((mappedText) => {
            console.log(`🔄 replaceBufferedStderr called with: ${mappedText}`);

            // Simulate replacing content in the terminal
            const terminalEl = document.getElementById('terminal-output');
            if (terminalEl && mappedText) {
                terminalEl.innerHTML = '';
                const div = document.createElement('div');
                div.textContent = mappedText;
                div.className = 'terminal-line term-stderr';
                terminalEl.appendChild(div);
            }
        });

        // Test problematic traceback
        const problematicTraceback = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`;

        console.log('📤 Calling terminal appendTerminal with traceback...');

        // Use the real appendTerminal from the terminal module
        if (terminalInstance && terminalInstance.appendTerminal) {
            terminalInstance.appendTerminal(problematicTraceback, 'stdout');
        } else {
            console.log('❌ No appendTerminal function found in terminal module');
        }

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 50));

        console.log('📋 Event log after processing:');
        window.__ssg_terminal_event_log.forEach((event, i) => {
            console.log(`  ${i}: ${event.action} (${event.when}) - ${event.text ? event.text.slice(0, 100) : 'no text'}`);
        });

        // Check if mapping was called
        const mappingCalled = window.mapTracebackAndShow.mock.calls.length > 0;
        console.log(`🎯 Mapping function called: ${mappingCalled}`);

        if (mappingCalled) {
            const [text, headerLines] = window.mapTracebackAndShow.mock.calls[0];
            console.log(`� Called with headerLines: ${headerLines}, text: ${text}`);
            expect(headerLines).toBe(21);
        }

        // Check if replaceBufferedStderr was called
        const replaceCalled = window.replaceBufferedStderr.mock.calls.length > 0;
        console.log(`� replaceBufferedStderr called: ${replaceCalled}`);

        // Check final terminal content
        const terminalEl = document.getElementById('terminal-output');
        const finalContent = terminalEl ? terminalEl.innerHTML : '';
        console.log(`💻 Final terminal content: ${finalContent}`);

        const hasMappedLine = finalContent.includes('line 1');
        console.log(`✅ Has mapped line: ${hasMappedLine}`);

        if (!hasMappedLine) {
            console.log('❌ E2E MAPPING FAILED - Debug Information:');
            console.log('� Mock call details:');
            console.log('  mapTracebackAndShow calls:', window.mapTracebackAndShow.mock.calls);
            console.log('  replaceBufferedStderr calls:', window.replaceBufferedStderr.mock.calls);
            console.log('🔧 Global state:');
            console.log('  __ssg_last_mapped_event:', window.__ssg_last_mapped_event);
            console.log('  __ssg_mapping_in_progress:', window.__ssg_mapping_in_progress);
            console.log('  __ssg_stderr_buffering:', window.__ssg_stderr_buffering);
        }

        expect(mappingCalled).toBe(true);
        expect(replaceCalled).toBe(true);
        expect(hasMappedLine).toBe(true);
    });

    test('traceback mapping with direct terminal append', async () => {
        console.log('🧪 Testing direct terminal append path...');

        // Set up execution context
        window.__ssg_last_mapped_event = { headerLines: 21 };
        window.__ssg_mapping_in_progress = false;
        window.__ssg_stderr_buffering = false;

        // Clear event log
        window.__ssg_terminal_event_log = [];

        // Load terminal module to get appendTerminal function
        const terminalModule = await import('../terminal.js');

        // Mirror module exports onto the global host so code that calls
        // global appendTerminal still triggers the terminal module logic.
        window.appendTerminal = terminalModule.appendTerminal
        window.appendTerminalDebug = terminalModule.appendTerminalDebug
        window.getTerminalInnerHTML = terminalModule.getTerminalInnerHTML
        window.setTerminalInnerHTML = terminalModule.setTerminalInnerHTML

        // Mock the mapping function
        window.mapTracebackAndShow = _jest.fn((text, headerLines) => {
            console.log(`🗺️  mapTracebackAndShow called with headerLines=${headerLines}`);
            console.log(`📝 Original text: ${text}`);

            // Simulate the mapping
            const mapped = text.replace(/line 22/, 'line 1');
            console.log(`📝 Mapped text: ${mapped}`);

            // Update terminal
            window.setTerminalInnerHTML(mapped);
            return mapped;
        });

        // Test the problematic traceback
        const problematicTraceback = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`;

        console.log('📤 Simulating direct terminal append...');

        // This should trigger the mapping logic in terminal.js
        if (window.appendTerminal) {
            window.appendTerminal(problematicTraceback, 'stdout');
        }

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 10));

        console.log('📋 Event log after append:');
        window.__ssg_terminal_event_log.forEach((event, i) => {
            console.log(`  ${i}: ${event.action} - ${event.content || ''}`);
        });

        // Check if mapping function was called
        const mappingCalled = window.mapTracebackAndShow.mock.calls.length > 0;
        console.log(`🎯 Mapping function called: ${mappingCalled}`);

        if (mappingCalled) {
            const [text, headerLines] = window.mapTracebackAndShow.mock.calls[0];
            console.log(`📊 Mapping called with headerLines: ${headerLines}`);
            expect(headerLines).toBe(21);
        }

        // Verify the result
        const finalContent = window.getTerminalInnerHTML();
        console.log(`💻 Final terminal content: ${finalContent}`);

        const hasMappedLine = finalContent.includes('line 1');
        console.log(`✅ Has mapped line: ${hasMappedLine}`);

        if (!hasMappedLine) {
            console.log('❌ DIRECT APPEND MAPPING FAILED');
            console.log('🔧 Debug info:');
            console.log('  appendTerminal calls:', window.appendTerminal.mock.calls);
            console.log('  mapTracebackAndShow calls:', window.mapTracebackAndShow.mock.calls);
        }

        expect(hasMappedLine).toBe(true);
    });
});