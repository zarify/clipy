# MicroPython WebAssembly with Asyncify Input

This directory contains a pre-built MicroPython WebAssem```bash
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

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>MicroPython Asyncify Demo</title>
</head>
<body>
    <div id="output"></div>
    <script type="module">
        import mpModule from './vendor/micropython-asyncify/micropython.mjs';
        
        async function runDemo() {
            const output = document.getElementById('output');
            
            const mp = await mpModule.loadMicroPython({
                stdout: (text) => {
                    output.innerHTML += text.replace(/\n/g, '<br>');
                },
                inputHandler: async (prompt) => {
                    // prompt contains exact text from Python
                    return window.prompt(prompt) || '';
                }
            });
            
            // All Python patterns work without transformation!
            await mp.runPythonAsync(`
print("🎉 MicroPython with Asyncify Input!")

# Complex Python that breaks code transformation
if data := input("Enter some data: "):
    print(f"Processing: {data}")
    
    # Nested input works too!
    if confirm := input("Confirm (y/n)? "):
        print(f"You said: {confirm}")
            `);
        }
        
        runDemo();
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

## 📋 API Reference

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

2. **"Module not found"**
   - Check that all three files are in the same directory
   - Ensure your bundler supports ES modules and WebAssembly

3. **"WebAssembly compilation failed"**
   - Ensure your environment supports WebAssembly
   - Check that the .wasm file is being served with correct MIME type

### Browser Considerations

For browser usage, ensure:
- Files are served over HTTP/HTTPS (not file://)
- CORS headers allow WebAssembly loading
- Your server serves .wasm files with `application/wasm` MIME type

## 🏗️ Build Information

This build was created with:
- **Emscripten SDK**: Latest version with asyncify support
- **Build Flags**: `-sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=16384`
- **MicroPython Version**: Latest master branch
- **Asyncify Variant**: Custom implementation preserving all Python syntax

## 📝 Implementation Details

The asyncify implementation:
- Only affects the `input()` builtin function
- All other I/O operations remain unchanged
- Uses `EM_ASYNC_JS` for seamless Promise integration
- Preserves exact Python syntax without transformation
- Supports all Python features (walrus operator, indented input, etc.)

## 🔗 Related Files

For complete implementation details, see:
- `implementation-notes.md` - Technical implementation details
- `build-instructions.md` - How this build was created
- Source code in `micropython/ports/webassembly/variants/asyncify/`
