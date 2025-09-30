import { appendTerminal, getTerminalInnerHTML, setTerminalInnerHTML } from '../terminal.js'
import { mapTracebackAndShow } from '../code-transform.js'

// Focused regression: raw printed traceback should map to line 1 for minimal code
test('regression: print(z) maps to user line 1', () => {
    // Simulate raw traceback printed by runtime for print(z)
    const raw = `Traceback (most recent call last):\n  File "<stdin>", line 22, in <module>\nNameError: name 'z' is not defined`;

    // Ensure terminal is clean
    setTerminalInnerHTML('')

    // Call mapper with headerLines matching the bug scenario: transform header had
    // 21 lines but earlier code undercounted; we pass 21 so mapped should be 1.
    const mapped = mapTracebackAndShow(raw, 21, '/main.py')

    expect(mapped).toContain('File "/main.py", line 1')
})
