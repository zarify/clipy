// Validation demo: Shows how the execution context fix resolves the traceback mapping issue
// This simulates the exact scenario the user reported: print(z) showing line 22 instead of line 1

import { appendTerminal, getTerminalInnerHTML, setTerminalInnerHTML } from '../terminal.js'

// Demo 1: Without execution context (old behavior - would fail)
function demoBadScenario() {
    console.log('\n=== DEMO 1: Bad scenario (no execution context) ===')

    // Clear any existing context
    delete window.__ssg_last_mapped_event
    window.__ssg_terminal_event_log = []

    // Simulate runtime traceback output without execution context
    const rawTraceback = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`

    setTerminalInnerHTML('')
    appendTerminal(rawTraceback, 'stdout')

    return new Promise(resolve => {
        setTimeout(() => {
            const eventLog = window.__ssg_terminal_event_log || []
            const mappingEvent = eventLog.find(e => e.action === 'terminal_direct_mapping')

            console.log('Events:', eventLog.map(e => e.action))
            console.log('Mapping event headerLines:', mappingEvent?.headerLines || 'undefined')
            console.log('Without context: headerLines would be 0 (wrong)')
            resolve()
        }, 50)
    })
}

// Demo 2: With execution context (new behavior - works correctly)  
function demoGoodScenario() {
    console.log('\n=== DEMO 2: Good scenario (with execution context) ===')

    // Set up execution context BEFORE runtime output (this is the fix)
    window.__ssg_last_mapped_event = {
        when: Date.now(),
        headerLines: 21,  // The transform added 21 header lines before user code
        sourcePath: '/main.py',
        mapped: ''
    }

    window.__ssg_terminal_event_log = []

    // Same runtime traceback output, but now with context available
    const rawTraceback = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`

    setTerminalInnerHTML('')
    appendTerminal(rawTraceback, 'stdout')

    return new Promise(resolve => {
        setTimeout(() => {
            const eventLog = window.__ssg_terminal_event_log || []
            const mappingEvent = eventLog.find(e => e.action === 'terminal_direct_mapping')
            const mappedResult = window.__ssg_last_mapped_event?.mapped || ''

            console.log('Events:', eventLog.map(e => e.action))
            console.log('Mapping event headerLines:', mappingEvent?.headerLines)
            console.log('Mapped result:', mappedResult)

            if (mappedResult.includes('line 1')) {
                console.log('✅ SUCCESS: Line 22 → Line 1 (correct mapping)')
            } else if (mappedResult.includes('line 22')) {
                console.log('❌ FAILURE: Still showing line 22 (mapping failed)')
            } else {
                console.log('? UNCLEAR: Unexpected result')
            }
            resolve()
        }, 50)
    })
}

// Demo 3: Show the exact user scenario working
function demoUserScenario() {
    console.log('\n=== DEMO 3: User scenario - print(z) with proper mapping ===')

    // This simulates what execution.js does now:
    // 1. Calculate headerLines from transform (21 lines for input() wrapper)
    // 2. Set execution context BEFORE calling runtime
    const headerLines = 21 // From transformAndWrap for input() handling

    window.__ssg_last_mapped_event = {
        when: Date.now(),
        headerLines: headerLines,
        sourcePath: '/main.py',
        mapped: ''
    }

    window.__ssg_terminal_event_log = []
    window.MAIN_FILE = '/main.py'

    // The exact traceback the user saw
    const userTraceback = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`

    console.log('Input traceback (line 22):', userTraceback)

    setTerminalInnerHTML('')
    appendTerminal(userTraceback, 'stdout')

    return new Promise(resolve => {
        setTimeout(() => {
            const mappedResult = window.__ssg_last_mapped_event?.mapped || ''

            console.log('Output traceback:', mappedResult)

            // Verify the mapping calculation: line 22 - 21 headerLines = line 1
            const inputLine = userTraceback.match(/line (\d+)/)?.[1]
            const outputLine = mappedResult.match(/line (\d+)/)?.[1]

            console.log(`Calculation: line ${inputLine} - ${headerLines} headerLines = line ${outputLine}`)

            if (outputLine === '1') {
                console.log('✅ PERFECT: User will now see "File "/main.py", line 1" instead of line 22')
            } else {
                console.log('❌ PROBLEM: Mapping did not work correctly')
            }

            resolve()
        }, 50)
    })
}

// Run all demos
export async function validateExecutionContextFix() {
    console.log('=== EXECUTION CONTEXT FIX VALIDATION ===')
    console.log('This demonstrates how setting execution context before runtime fixes traceback mapping')

    await demoBadScenario()
    await demoGoodScenario()
    await demoUserScenario()

    console.log('\n=== SUMMARY ===')
    console.log('The fix ensures window.__ssg_last_mapped_event.headerLines is available')
    console.log('BEFORE the runtime produces stdout, so terminal direct append mapping works.')
    console.log('User will now see correct line numbers in tracebacks!')
}

// For browser console testing
if (typeof window !== 'undefined') {
    window.validateExecutionContextFix = validateExecutionContextFix
    console.log('Run validateExecutionContextFix() in browser console to see the fix in action')
}