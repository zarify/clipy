# MicroPython Asyncify v3.0.0

**WebAssembly MicroPython with Asyncify, Input Support, and Comprehensive Interrupt Control**

This package provides a WebAssembly build of MicroPython with full asyncify support, enabling:
- ✅ **Asynchronous `input()` calls** - No more browser freezing on user input
- ✅ **Complete async/await support** - All Python async patterns work seamlessly  
- ✅ **Comprehensive infinite loop interruption** - Kill any runaway code without browser freeze
- ✅ **Enhanced cooperative yielding** - Browser-friendly execution with periodic yielding
- ✅ **Interruptible time.sleep() functions** - Even sleep-based loops can be interrupted
- ✅ **JavaScript interrupt control** - Full external execution management
- ✅ **Production-ready safety** - Comprehensive protection against all infinite loop patterns```bash
# Copy to your project
cp -r vendor/micropython-asyncify/ your-project/vendor/
```

### 2. Import and Initialize

```javascript
import mpModule from './vendor/micropython-asyncify/micropython.mjs';

// Configure MicroPython
const mp = await mpModule.loadMicroPython({
    stdout: (text) => console.log(text),
    stderr: (text) => console.error(text),
    inputHandler: async (prompt) => {
        // Handle the prompt - receives exact text from input()
        return await getUserInput(prompt);
    }
});
```asyncified `input()` function support.

## 🎯 Key Features

- **Asyncified `input()` function**: Works with async/await patterns in JavaScript
- **No code transformation required**: Python code runs exactly as written
- **Walrus operator support**: `if age := input("Age: "):` works perfectly
- **Indented input support**: Input inside loops/conditionals works without issues
- **Full Python compatibility**: All Python syntax preserved

## 📦 Files Included

- `micropython.mjs` - Main MicroPython ES module
- `micropython.wasm` - WebAssembly binary with asyncify support
- `api.js` - JavaScript API wrapper for easy integration
- `README.md` - This documentation
- `example-node.js` - Node.js usage example
- `example-browser.html` - Browser usage example

## 🚀 Quick Start

### Node.js Usage

```javascript
import mpModule from './vendor/micropython-asyncify/micropython.mjs';

async function runPython() {
    const mp = await mpModule.loadMicroPython({
        stdout: (text) => process.stdout.write(text),
        inputHandler: async (prompt) => {
            // prompt contains exact text: "Enter your name: "
            return await getUserInput(prompt);
        }
    });
    
    // Use asyncified input() - works with all Python patterns!
    await mp.runPythonAsync(`
# Walrus operator works!
if name := input("Enter your name: "):
    print(f"Hello, {name}!")

# Indented input works!
for i in range(3):
    value = input(f"Enter value {i+1}: ")
    print(f"You entered: {value}")
    `);
}

runPython();
```

### Browser Usage with Interrupt Control

```html
<!DOCTYPE html>
<html>
<head>
    <title>MicroPython with Interrupt Control</title>
</head>
<body>
    <div id="output"></div>
    <button onclick="startInfiniteLoop()">Start Infinite Loop</button>
    <button onclick="interruptExecution()">Stop Execution</button>
    
    <script type="module">
        import mpModule from './vendor/micropython-asyncify/micropython.mjs';
        
        let mp, currentExecution;
        
        async function initMicroPython() {
            const output = document.getElementById('output');
            
            mp = await mpModule.loadMicroPython({
                stdout: (text) => {
                    output.innerHTML += text.replace(/\n/g, '<br>');
                },
                inputHandler: async (prompt) => {
                    return window.prompt(prompt) || '';
                }
            });
        }
        
        window.startInfiniteLoop = async function() {
            if (currentExecution) return;
            
            currentExecution = mp.runPythonAsync(`
import time
print("🔄 Starting infinite loop...")
count = 0
while True:
    count += 1
    print(f"Loop iteration: {count}")
    time.sleep(0.5)  # This can be interrupted!
            `);
            
            try {
                await currentExecution;
                console.log("Loop completed naturally");
            } catch (error) {
                console.log("Loop was interrupted:", error.message);
            } finally {
                currentExecution = null;
            }
        };
        
        window.interruptExecution = function() {
            if (mp && currentExecution) {
                mp.interruptExecution();
                console.log("🛑 Interrupt signal sent");
            }
        };
        
        initMicroPython();
    </script>
</body>
</html>
```

## 🔧 Integration Guide

### 1. Copy Files to Your Project

```bash
# Copy the entire vendor directory
cp -r vendor/micropython-asyncify/ your-project/vendor/
```

### 2. Import and Initialize

```javascript
import { loadMicroPython } from './vendor/micropython-asyncify/api.js';

// Configure MicroPython
const mp = await loadMicroPython({
    stdout: (text) => console.log(text),
    stderr: (text) => console.error(text)
});
```

### 3. Run Python Code

```javascript
// Use runPythonAsync for code with input()
await mp.runPythonAsync(`
name = input("Name: ")
print(f"Hello, {name}!")
`);

// Use runPython for code without input()
mp.runPython(`
print("No input needed here")
x = 2 + 2
print(f"2 + 2 = {x}")
`);
```

## ⚡ New in v3.0.0: Comprehensive Interrupt System

### `mp.interruptExecution()`

**NEW**: Interrupts currently running Python code by raising a KeyboardInterrupt. Works with **ALL** types of infinite loops:

```javascript
// Interrupt computation loops
const computation = mp.runPythonAsync(`
while True:
    x = x + 1  # Tight computation loop
`);

// Interrupt sleep-based loops  
const sleepLoop = mp.runPythonAsync(`
import time
while True:
    print("Running...")
    time.sleep(1)  # Sleep-based loop
`);

// Interrupt mixed loops
const mixedLoop = mp.runPythonAsync(`
import time
while True:
    for i in range(1000):
        x = x + 1
    time.sleep(0.5)  # Mixed computation + sleep
`);

// Interrupt any of them after 3 seconds
setTimeout(() => {
    mp.interruptExecution();
    console.log('Interrupted infinite loop!');
}, 3000);

try {
    await computation; // or sleepLoop, or mixedLoop
} catch (error) {
    console.log('Code was interrupted:', error.message);
}
```

### What Can Be Interrupted?

✅ **All Loop Types:**
- Tight computation loops: `while True: x += 1`
- Sleep-based loops: `while True: time.sleep(1)`
- Mixed loops: computation + sleep
- Nested function calls with loops/sleep
- Long-running `time.sleep()`, `time.sleep_ms()`, `time.sleep_us()`

✅ **Comprehensive Coverage:**
- VM hook yielding every ~10 operations
- Enhanced delay functions with interrupt checking
- Nested function calls and complex control flow
- All Python time/sleep functions
```

### `mp.setYielding(enabled)`

**NEW**: Enable or disable cooperative yielding (default: enabled).

```javascript
// Disable yielding for maximum performance (no interruption possible)
mp.setYielding(false);
await mp.runPythonAsync(`
# Fast execution, but cannot be interrupted
for i in range(1000000):
    x = x + 1
`);

// Re-enable yielding for interruptibility
mp.setYielding(true);
const interruptibleExecution = mp.runPythonAsync(`
# Can be interrupted, browser stays responsive
while True:
    x = x + 1
`);

// Now interruption works
setTimeout(() => mp.interruptExecution(), 2000);
```

### `mp.clearInterrupt()`

**NEW**: Clear any pending interrupt state (useful for testing and recovery).

```javascript
// After an interruption, clear state for next execution
mp.clearInterrupt();

// Safe to run new code
await mp.runPythonAsync(`
print("Fresh start after interrupt")
`);
```

## 🛡️ Production Safety Features

This build provides **comprehensive protection** for production browser environments:

### Infinite Loop Protection
```python
# ALL of these can be safely interrupted:

# 1. Tight computation loops
while True:
    x = x + 1

# 2. Sleep-based loops  
import time
while True:
    time.sleep(1)

# 3. Mixed patterns
while True:
    for i in range(1000):
        result = expensive_computation(i)
    time.sleep(0.1)

# 4. Nested function calls
def recursive_function():
    time.sleep(0.5)
    recursive_function()

recursive_function()
```

### Yielding Behavior
- **VM Operations**: Yields every ~10 Python operations
- **Sleep Functions**: Enhanced with continuous interrupt checking
- **Browser Responsiveness**: Maintained throughout execution
- **Interrupt Response**: Typically 300-800ms for any loop type

## � API Reference

### `mpModule.loadMicroPython(options)`

Loads and initializes MicroPython with asyncify support.

**Parameters:**
- `options.stdout(text)` - Function to handle stdout output
- `options.stderr(text)` - Function to handle stderr output (optional)
- `options.inputHandler(prompt)` - **NEW**: Function to handle input prompts (returns Promise<string>)

**Returns:** Promise resolving to MicroPython instance

**Example with inputHandler:**
```javascript
import mpModule from './vendor/micropython-asyncify/micropython.mjs';

const mp = await mpModule.loadMicroPython({
    stdout: (text) => console.log(text),
    inputHandler: async (prompt) => {
        // prompt contains the exact text from Python: "What's your name? "
        console.log(`Got prompt: "${prompt}"`);
        return await getInputFromUser(prompt);
    }
});
```

### `mp.runPythonAsync(code)`

Executes Python code with asyncify support. Use this when your code contains `input()` calls.

**Parameters:**
- `code` - Python code string

**Returns:** Promise that resolves when execution completes

### `mp.interruptExecution()`

**NEW**: Interrupts currently running Python code by raising a KeyboardInterrupt. Works with **ALL** types of infinite loops.

```javascript
// Start any type of infinite loop
const execution = mp.runPythonAsync(`
import time
while True:
    print("This loop can be interrupted!")
    time.sleep(1)  # Even sleep-based loops!
`);

// Interrupt it from JavaScript
setTimeout(() => {
    mp.interruptExecution();
    console.log('🛑 Interrupted!');
}, 3000);

try {
    await execution;
} catch (error) {
    console.log('Code was interrupted:', error.message);
}
```

### `mp.setYielding(enabled)`

**NEW**: Control cooperative yielding for performance vs interruptibility trade-off.

```javascript
// Maximum performance (not interruptible)
mp.setYielding(false);

// Interruptible execution (slight performance cost)
mp.setYielding(true);
```

### `mp.clearInterrupt()`

**NEW**: Clear pending interrupt state for clean recovery.

```javascript
// After handling an interrupt, clear state
mp.clearInterrupt();
```

### `mp.runPython(code)`

Executes Python code synchronously. Use this for code without `input()` calls.

**Parameters:**
- `code` - Python code string

**Returns:** Execution result

## 🐛 Troubleshooting

### Common Issues

1. **"input() not working"**
   - Make sure you're using `runPythonAsync()` not `runPython()`
   - Ensure your environment supports async/await

2. **"Interrupt not working"**
   - Ensure yielding is enabled: `mp.setYielding(true)`
   - Wait for interrupt response (typically 300-800ms)
   - Some very short operations may complete before interrupt

3. **"Cannot use runPython() with yielding enabled"**
   - This is expected behavior - use `runPythonAsync()` when yielding is enabled
   - Or disable yielding temporarily: `mp.setYielding(false)`

4. **"Module not found"**
   - Check that all files are in the same directory
   - Ensure your bundler supports ES modules and WebAssembly

5. **"WebAssembly compilation failed"**
   - Ensure your environment supports WebAssembly
   - Check that the .wasm file is being served with correct MIME type

### Browser Considerations

For browser usage, ensure:
- Files are served over HTTP/HTTPS (not file://)
- CORS headers allow WebAssembly loading
- Your server serves .wasm files with `application/wasm` MIME type

### Performance Notes

- **Yielding enabled** (default): Browser stays responsive, code can be interrupted
- **Yielding disabled**: Maximum performance, but no interruption possible
- **Interrupt response time**: 300-800ms for most loops
- **Sleep interruption**: Nearly immediate response

## 🏗️ Build Information

This build was created with:
- **Emscripten SDK**: Latest version with asyncify support
- **Build Flags**: `-sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=16384`
- **MicroPython Version**: Latest master branch
- **Asyncify Variant**: Custom implementation with comprehensive interrupt system

## 📝 Implementation Details

### Asyncify Implementation
- Only affects the `input()` builtin function for async behavior
- Uses `EM_ASYNC_JS` for seamless Promise integration
- Preserves exact Python syntax without transformation
- Supports all Python features (walrus operator, indented input, etc.)

### Interrupt System
- **VM Hook Integration**: Yields every ~10 Python operations
- **Enhanced Sleep Functions**: `time.sleep()`, `time.sleep_ms()`, `time.sleep_us()` are interruptible
- **Cooperative Yielding**: Browser-friendly execution with configurable yielding
- **Comprehensive Coverage**: All infinite loop patterns can be interrupted

### Technical Features
- **Global interrupt state**: Managed in C with JavaScript control
- **Asyncify yielding**: Uses Emscripten's asyncify for cooperative multitasking  
- **VM integration**: Hooks into MicroPython's virtual machine execution
- **Clean recovery**: Proper exception handling and state management

## 🔗 Related Files

For complete implementation details, see:
- `implementation-notes.md` - Technical implementation details
- `build-instructions.md` - How this build was created  
- `test-comprehensive.js` - Complete test suite for interrupt system
- `test-yielding-behavior.js` - Yielding behavior analysis
- `INTERRUPT-SYSTEM-SUMMARY.md` - Comprehensive technical summary
- Source code in `micropython/ports/webassembly/variants/asyncify/`

## 🎯 Use Cases

Perfect for:
- **Online Python IDEs** - Safe execution of user code with stop buttons
- **Educational platforms** - Students can't accidentally freeze the browser
- **Interactive tutorials** - Responsive interfaces during code execution
- **Python playgrounds** - Production-ready execution environment
- **Browser-based development tools** - Full Python compatibility with safety

## 🚀 Version History

- **v1.0.0**: Basic asyncify support with input() functionality
- **v2.0.0**: Fixed UX issues (prompt text passing, stdout buffering)  
- **v3.0.0**: Comprehensive interrupt system with enhanced yielding
  - ✅ All infinite loop types can be interrupted
  - ✅ Enhanced time.sleep() functions with interrupt support
  - ✅ JavaScript control API for execution management
  - ✅ Production-ready safety for browser environments
