import { appendTerminal, getTerminalInnerHTML, setTerminalInnerHTML } from '../terminal.js'

// Test to trace the exact flow of traceback handling
test('trace traceback flow through runtime stdout', async () => {
    // Set up debug logging
    const originalLog = console.log
    const logs = []
    console.log = (...args) => {
        logs.push(args.join(' '))
        originalLog(...args)
    }

    // Enable debug flags and simulate execution context
    if (typeof window !== 'undefined') {
        window.__ssg_debug_logs = true
        window.__ssg_terminal_event_log = []
        window.MAIN_FILE = '/main.py'

        // Simulate the execution context that would normally be set by execution.js
        // This represents a transform that added 21 header lines before the user code
        window.__ssg_last_mapped_event = {
            when: Date.now(),
            headerLines: 21, // This is the key fix - the transform prelude has 21 lines
            sourcePath: '/main.py',
            mapped: ''
        }
    }

    // Clear terminal
    setTerminalInnerHTML('')

    // Simulate the exact traceback that would come through runtime stdout
    const rawTraceback = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`

    // This is how the runtime calls appendTerminal (as 'stdout', not 'stderr')
    appendTerminal(rawTraceback, 'stdout')

    // Wait for async mapping to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Log the event log to see what happened
    console.log('=== TERMINAL EVENT LOG ===')
    if (typeof window !== 'undefined' && window.__ssg_terminal_event_log) {
        window.__ssg_terminal_event_log.forEach((event, i) => {
            console.log(`${i}: ${event.action} - ${JSON.stringify(event)}`)
        })
    }

    // Check the buffered stderr to see if mapping worked
    let mappedResult = null
    if (typeof window !== 'undefined' && window.__ssg_last_mapped_event) {
        mappedResult = window.__ssg_last_mapped_event.mapped
        console.log('=== MAPPED RESULT ===')
        console.log(mappedResult)
    }

    // Restore console
    console.log = originalLog

    // Verify that mapping logic was triggered
    const eventLog = (typeof window !== 'undefined') ? window.__ssg_terminal_event_log || [] : []
    const bufferedEvent = eventLog.find(e => e.action === 'direct_append_buffered')
    expect(bufferedEvent).toBeTruthy()
    expect(bufferedEvent.text).toContain('File "/main.py", line 22')

    // Check if mapping actually produced a result
    if (mappedResult) {
        if (mappedResult.includes('line 22')) {
            console.log('❌ TRACEBACK NOT MAPPED - still shows line 22')
        } else if (mappedResult.includes('line 1')) {
            console.log('✅ TRACEBACK MAPPED - shows user line 1')
        } else {
            console.log('? TRACEBACK MAPPING UNCLEAR - result:', mappedResult.slice(0, 200))
        }

        // The mapping should have converted line 22 to line 1
        expect(mappedResult).toContain('line 1')
    } else {
        console.log('❌ NO MAPPING RESULT CAPTURED')
        // Fail if no mapping result was produced
        expect(mappedResult).toBeTruthy()
    }
})