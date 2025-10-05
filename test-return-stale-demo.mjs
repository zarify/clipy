/**
 * Demonstration that RETURN events have stale f_locals in MicroPython
 * 
 * Run with: node test-return-stale-demo.mjs
 * 
 * This demonstrates the bug using actual execution traces from our app.
 */

console.log('==============================================================');
console.log('MicroPython sys.settrace RETURN Event Bug Demonstration');
console.log('==============================================================\n');

console.log('TEST CODE:');
console.log('----------');
console.log('i = 0');
console.log('while i < 3:');
console.log('    i += 1');
console.log('');

console.log('EXPECTED EXECUTION:');
console.log('-------------------');
console.log('Loop runs 3 times: i increments from 0 → 1 → 2 → 3');
console.log('After 3 increments from 0, final value should be i=3');
console.log('');

console.log('ACTUAL TRACE CAPTURED (from Clipy execution logs):');
console.log('--------------------------------------------------');
console.log('[line]   Line 1 vars: {}');
console.log('[line]   Line 2 vars: {i=0}');
console.log('[line]   Line 3 vars: {i=0}   ← Before 1st increment ✅ CORRECT');
console.log('[line]   Line 3 vars: {i=0}   ← Before 2nd increment (should be i=1) ❌ STALE');
console.log('[line]   Line 3 vars: {i=1}   ← Before 3rd increment (should be i=2) ❌ STALE');
console.log('[return] Line 3 vars: {i=2}   ← Return event (should be i=3) ❌ STALE');
console.log('');

console.log('ANALYSIS:');
console.log('---------');
console.log('1. Line 3 (i+=1) was traced 3 times - loop executed correctly');
console.log('2. Values recorded: i=0, i=0, i=1 (should be i=0, i=1, i=2)');
console.log('3. RETURN event shows i=2 (should be i=3)');
console.log('4. Pattern: Every value after first backward jump lags by exactly 1');
console.log('');

console.log('CRITICAL FINDING:');
console.log('------------------');
console.log('❌ RETURN events are ALSO affected by the f_locals caching bug');
console.log('❌ RETURN events do NOT contain correct final values');
console.log('❌ The suggestion to use RETURN events does not work');
console.log('');

console.log('ROOT CAUSE:');
console.log('-----------');
console.log('MicroPython VM caches frame.f_locals and does not refresh it on');
console.log('backward jumps (JUMP_BACKWARD_* bytecode). This affects ALL trace');
console.log('events: both LINE and RETURN events receive the stale cached dict.');
console.log('');

console.log('WORKAROUNDS ATTEMPTED (all failed):');
console.log('------------------------------------');
console.log('✗ Accessing frame.f_code before reading f_locals');
console.log('✗ Calling eval(\'locals()\', frame.f_globals, frame.f_locals)');
console.log('✗ Reading f_locals multiple times');
console.log('✗ Using RETURN events (this report)');
console.log('');

console.log('CURRENT SOLUTION:');
console.log('-----------------');
console.log('Two-steps-ahead look-ahead in replay:');
console.log('  - Current step: stale by 2');
console.log('  - Next step: stale by 1');
console.log('  - Two steps ahead: correct (compensates for lag)');
console.log('');
console.log('LIMITATION: Fails on last 1-2 iterations (no look-ahead available)');
console.log('Result: Final loop value shows i=2 instead of i=3');
console.log('');

console.log('==============================================================');
console.log('This bug requires a fix in MicroPython VM C code.');
console.log('No Python-level workaround can refresh the cached f_locals.');
console.log('==============================================================');
