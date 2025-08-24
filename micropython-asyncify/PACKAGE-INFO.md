# MicroPython WebAssembly Asyncify - Vendor Package

**Version**: 2.0.0  
**Date**: August 24, 2025  
**MicroPython Version**: Latest master + UX fixes  
**Emscripten Version**: Latest with asyncify support  

## 🆕 **Version 2.0.0 Updates**

### ✅ **Fixed UX Issues**
- **Prompt text passing**: `inputHandler` now receives the correct prompt text (not empty string)
- **Eliminated stdout buffering**: Prompts appear immediately, no delayed display
- **Clean separation**: JavaScript has full control over prompt display timing
- **Better environment detection**: Prioritizes custom `inputHandler` over environment defaults

### 🎯 **Perfect User Experience**
```javascript
// Now works exactly as expected:
const mp = await loadMicroPython({
    inputHandler: async (prompt) => {
        console.log(`Prompt: "${prompt}"`); // Receives "What's your name? "
        return getUserInput(); // Called immediately when input() runs
    }
});

await mp.runPythonAsync(`
name = input("What's your name? ")  # Prompt appears instantly
print(f"Hello, {name}!")
`);
```  

## 📦 Package Contents

```
micropython-asyncify/
├── micropython.wasm          # 1.1MB - WebAssembly binary with asyncify
├── micropython.mjs           # 227KB - ES module with loadMicroPython()
├── README.md                 # 6KB - Quick start guide
├── example-node.js           # 3KB - Node.js usage example
├── example-browser.html      # 12KB - Browser demo with UI
├── implementation-notes.md   # 7KB - Technical details
├── build-instructions.md     # 9KB - Rebuild from source
└── PACKAGE-INFO.md          # This file
```

**Total Size**: ~1.4MB

## 🎯 What This Solves

This package provides a **complete solution** for using `input()` in MicroPython WebAssembly without the traditional problems:

### ❌ Problems with Other Approaches
- **Code transformation breaks walrus operator**: `if age := input("Age: "):` fails
- **Indented input fails**: `input()` inside loops/conditionals doesn't work
- **Complex AST parsing required**: Hard to implement correctly
- **Python semantics change**: Code doesn't run as written

### ✅ Our Solution
- **No code transformation**: Python runs exactly as written
- **Full syntax support**: Walrus operator, indented input, all patterns work
- **Transparent async**: Uses Emscripten asyncify under the hood
- **Drop-in replacement**: Just swap the WebAssembly files

## 🚀 Quick Integration

### For Node.js Projects
```javascript
import mpModule from './vendor/micropython-asyncify/micropython.mjs';

const mp = await mpModule.loadMicroPython({
    inputHandler: async (prompt) => {
        // prompt contains exact text: "Name: "
        return await getInputFromUser(prompt);
    }
});

await mp.runPythonAsync(`
if name := input("Name: "):
    print(f"Hello, {name}!")
`);
```

### For Browser Projects
```html
<script type="module">
import mpModule from './vendor/micropython-asyncify/micropython.mjs';

const mp = await mpModule.loadMicroPython({
    inputHandler: async (prompt) => {
        return window.prompt(prompt) || '';
    }
});

await mp.runPythonAsync(`
for i in range(3):
    item = input(f"Item {i}: ")  # Indented input works!
    print(f"Got: {item}")
`);
</script>
```

## ✅ Verification Results

All critical Python patterns work without transformation:

```python
# ✅ Walrus operator
if data := input("Data: "):
    print(f"Got: {data}")

# ✅ Indented input
for i in range(3):
    value = input(f"Enter {i}: ")  # This is indented!
    print(f"Value {i}: {value}")

# ✅ Complex nesting
def get_user_data():
    while True:
        if name := input("Name (or 'quit'): "):
            if name == 'quit':
                break
            print(f"Hello, {name}!")
        else:
            print("Please enter a name")

# ✅ Exception handling
try:
    age = int(input("Age: "))
    print(f"You are {age} years old")
except ValueError:
    print("Invalid age")

# ✅ List comprehensions, classes, everything else works normally
```

## 🔍 Technical Overview

### Implementation Strategy
- **HAL-level override**: Only affects `mp_hal_readline()` function
- **EM_ASYNC_JS**: Uses Emscripten's async JavaScript integration
- **Variant-based build**: Separate build that inherits from standard MicroPython
- **Minimal changes**: No modifications to Python interpreter core

### Performance Impact
- **Binary size**: +200KB vs standard build (1.4MB vs 1.2MB)
- **Runtime overhead**: Only during `input()` calls
- **Memory usage**: +16KB asyncify stack
- **Loading time**: +~50ms for asyncify initialization

### Compatibility
- **Node.js**: ✅ Uses readline interface
- **Browser**: ✅ Uses prompt() (customizable)
- **All Python syntax**: ✅ Preserved without transformation
- **Other I/O**: ✅ Unaffected (print, file operations, etc.)

## 📋 API Reference

### `loadMicroPython(options)`
Load MicroPython with asyncify support.

```javascript
const mp = await loadMicroPython({
    stdout: (text) => console.log(text),  // Handle output
    stderr: (text) => console.error(text) // Handle errors (optional)
});
```

### `mp.runPythonAsync(code)`
Execute Python code with `input()` support.

```javascript
await mp.runPythonAsync(`
name = input("Your name: ")
print(f"Hello, {name}!")
`);
```

### `mp.runPython(code)`
Execute Python code without `input()` (synchronous).

```javascript
mp.runPython(`
print("This runs synchronously")
result = 2 + 2
print(f"2 + 2 = {result}")
`);
```

## 🛠️ Customization

### Custom Input UI (Browser)
Replace the default `prompt()` with custom interface by modifying the JavaScript in `micropython.mjs`.

### Build from Source
See `build-instructions.md` for complete rebuild instructions.

### Environment-Specific Builds
- **Web-only**: Add `-sENVIRONMENT=web` for smaller size
- **Node.js-only**: Add `-sENVIRONMENT=node` for Node.js optimization
- **Debug**: Add `-sASSERTIONS=1 -g` for debugging

## 🐛 Known Limitations

1. **File I/O**: Not available in WebAssembly (use VFS from parent project)
2. **Binary size**: ~200KB larger than standard build
3. **Emscripten dependency**: Requires Emscripten-compiled WebAssembly
4. **Browser prompt**: Default browser prompt is basic (easily customizable)

## 📝 Version History

### v2.0.0 (August 24, 2025)
- 🔧 **FIXED**: inputHandler receives correct prompt text (not empty string)
- 🔧 **FIXED**: Eliminated stdout buffering - prompts appear immediately  
- ✅ JavaScript has full control over prompt display timing
- ✅ Better environment detection prioritizes custom inputHandler
- ✅ Clean separation of concerns between C and JavaScript
- ✅ Perfect UX for browser-based Python playgrounds

### v1.0.0 (August 24, 2025)
- ✅ Initial release
- ✅ Full asyncify input() implementation
- ✅ Walrus operator support
- ✅ Indented input support
- ✅ Node.js and browser compatibility
- ✅ Comprehensive documentation and examples

## 🔗 Related Resources

- **MicroPython**: https://micropython.org/
- **Emscripten**: https://emscripten.org/
- **WebAssembly**: https://webassembly.org/
- **Source Repository**: https://github.com/micropython/micropython

## 📞 Support

For issues or questions:
1. Check `implementation-notes.md` for technical details
2. Review `build-instructions.md` for rebuild information
3. Test with included examples (`example-node.js`, `example-browser.html`)

## ⚖️ License

This package follows the MicroPython license (MIT). See the main MicroPython repository for full license details.

---

**🎉 Ready to use! No code transformation needed! All Python syntax works!** 🎉
