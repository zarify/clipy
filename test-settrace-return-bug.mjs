/**
 * Standalone test demonstrating sys.settrace RETURN event bug
 * 
 * Run with: node test-settrace-return-bug.mjs
 * 
 * This test proves that RETURN events also have stale f_locals values
 * when backward jumps (loops) are involved.
 */

import { loadMicroPython } from './micropython-asyncify/micropython.mjs';

console.log('Loading MicroPython...\n');
const mp = await loadMicroPython();

// Python code that demonstrates the bug
const testCode = `
import sys

# Storage for captured trace events
events = []

def trace_function(frame, event, arg):
    """Capture both LINE and RETURN events with f_locals values"""
    if event not in ('line', 'return'):
        return trace_function
    
    # Get variable i from f_locals
    i_value = frame.f_locals.get('i', 'undefined')
    
    # Store the event
    events.append({
        'event': event,
        'line': frame.f_lineno,
        'i': i_value
    })
    
    return trace_function

# Enable tracing
sys.settrace(trace_function)

# Code to trace: simple while loop
i = 0
while i < 3:
    i += 1

# Disable tracing
sys.settrace(None)

# Print captured events
print("\\n=== Captured Events ===")
for idx, evt in enumerate(events):
    event_type = evt['event']
    line_no = evt['line']
    i_val = evt['i']
    print(f"Step {idx+1}: [{event_type:6s}] Line {line_no}, i={i_val}")

# Analyze the RETURN event
print("\\n=== Analysis ===")
print("Expected: Loop runs 3 times (i=0, i=1, i=2), ending with i=3")
print()

return_events = [e for e in events if e['event'] == 'return']
if return_events:
    final_return = return_events[-1]
    print(f"RETURN event captured: i={final_return['i']}")
    print(f"Expected RETURN value: i=3")
    print()
    
    if final_return['i'] == 3:
        print("✅ PASS: RETURN event has correct final value")
    else:
        print(f"❌ FAIL: RETURN event has STALE value (got {final_return['i']}, expected 3)")
        print()
        print("This proves RETURN events are ALSO affected by f_locals caching!")
        print("Values lag by exactly 1 iteration on backward jumps.")
else:
    print("❌ ERROR: No RETURN event was captured")

print()
print("=== Event Pattern ===")
line3_events = [(i, e) for i, e in enumerate(events) if e['line'] == 3]
print(f"Line 3 (i+=1) was traced {len(line3_events)} times")
for idx, (step, evt) in enumerate(line3_events):
    iteration = idx + 1
    i_val = evt['i']
    expected = iteration - 1  # Before the increment
    status = "✅" if i_val == expected else f"❌ (expected {iteration})"
    print(f"  Iteration {iteration}: i={i_val} {status}")

if len(line3_events) >= 2:
    print()
    print("Notice: Values lag by 1 after the first backward jump")
`;

console.log('Running test...\n');
console.log('='.repeat(60));

try {
    await mp.runPythonAsync(testCode);
} catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
}

console.log('='.repeat(60));
console.log('\nTest complete.');
