# Build Instructions - MicroPython WebAssembly Asyncify

This document explains how to rebuild the asyncify variant from source.

## 🛠️ Prerequisites

### Required Tools
- **Emscripten SDK** (latest version)
- **Git** (for MicroPython source)
- **Make** (for build system)
- **Python 3.x** (for build scripts)

### Emscripten Setup
```bash
# Download and install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

## 📥 Source Code Setup

### Clone MicroPython
```bash
git clone https://github.com/micropython/micropython.git
cd micropython
git submodule update --init
```

### Navigate to WebAssembly Port
```bash
cd ports/webassembly
```

## 🏗️ Build Process

### Step 1: Create Asyncify Variant

Create the variant directory structure:
```bash
mkdir -p variants/asyncify
```

Create `variants/asyncify/mpconfigvariant.h`:
```c
// Enable asyncify input functionality
#define MICROPY_VARIANT_ENABLE_ASYNCIFY_INPUT 1

// Include parent variant config
#include "variants/standard/mpconfigvariant.h"
```

Create `variants/asyncify/mpconfigvariant.mk`:
```makefile
# Asyncify variant configuration
VARIANT_DIR = $(VARIANT_PATH)/asyncify

# Inherit from standard variant
include $(VARIANT_PATH)/standard/mpconfigvariant.mk

# Add asyncify-specific flags
CFLAGS += -sASYNCIFY=1
CFLAGS += -sASYNCIFY_STACK_SIZE=16384
```

### Step 2: Implement Async Input

Modify `mphalport.c` to add the asyncify implementation:

```c
// Add at the top of the file
#if MICROPY_VARIANT_ENABLE_ASYNCIFY_INPUT
#include <emscripten.h>

// Add after the includes
EM_ASYNC_JS(char*, mp_hal_readline_async, (void), {
    try {
        // Node.js environment
        if (typeof process !== 'undefined' && process.stdin) {
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            return new Promise((resolve) => {
                rl.question('', (answer) => {
                    rl.close();
                    const ptr = allocateUTF8(answer);
                    resolve(ptr);
                });
            });
        }
        // Browser environment
        else {
            const answer = prompt('') || '';
            const ptr = allocateUTF8(answer);
            return ptr;
        }
    } catch (error) {
        console.error('Input error:', error);
        const ptr = allocateUTF8('');
        return ptr;
    }
});
#endif

// Modify the mp_hal_readline function
vstr_t* mp_hal_readline(vstr_t *vstr, const char *p) {
#if MICROPY_VARIANT_ENABLE_ASYNCIFY_INPUT
    mp_hal_stdout_tx_str(p);
    char* result = mp_hal_readline_async();
    vstr_reset(vstr);
    vstr_add_str(vstr, result);
    free(result);
    return vstr;
#else
    // Standard implementation
    mp_hal_stdout_tx_str(p);
    char c = mp_hal_stdin_rx_chr();
    if (c == CHAR_CTRL_D) {
        printf("\n");
        return NULL;
    }
    vstr_reset(vstr);
    vstr_add_byte(vstr, c);
    for (;;) {
        c = mp_hal_stdin_rx_chr();
        if (c == CHAR_CTRL_D || c == '\n') {
            printf("\n");
            break;
        } else {
            vstr_add_byte(vstr, c);
        }
    }
    return vstr;
#endif
}
```

### Step 3: Update JavaScript API

Modify `api.js` to support asyncify:

```javascript
// Add or update the runPythonAsync method
async runPythonAsync(code) {
    return await this.Module.runPythonAsync(code);
}

// Ensure loadMicroPython uses async: true for asyncify
async function loadMicroPython(options = {}) {
    const module = await Module({
        // ... other options
        async: true  // Enable asyncify support
    });
    
    return new MicroPython(module);
}
```

### Step 4: Fix Library Functions

Update `library.js` to fix function calls:

```javascript
// Fix mp_hal_get_interrupt_char call
mp_hal_get_interrupt_char: function() {
    return Module.ccall('mp_hal_get_interrupt_char', 'number', [], []);
}
```

### Step 5: Build the Variant

Set up the environment:
```bash
source ../../emsdk/emsdk_env.sh
```

Clean previous builds:
```bash
make VARIANT=asyncify clean
```

Build the asyncify variant:
```bash
make VARIANT=asyncify
```

## 📁 Build Output

After successful build, you'll find these files in `build-asyncify/`:
- `micropython.mjs` - ES module
- `micropython.wasm` - WebAssembly binary
- `micropython.js` - Legacy JavaScript loader (if needed)

## 🧪 Testing the Build

### Quick Test
```bash
node -e "
import('./build-asyncify/micropython.mjs').then(async (mp) => {
    const micropython = await mp.loadMicroPython();
    console.log('✅ Asyncify build loaded successfully!');
    micropython.runPython('print(\"Hello from asyncify!\")');
});
"
```

### Full Test Suite
```bash
# Copy test files to build directory
cp test_*.js build-asyncify/

# Run comprehensive tests
cd build-asyncify
node ../test_automated_verification.js
```

## 🔧 Build Troubleshooting

### Common Issues

**1. Emscripten not found**
```bash
# Solution: Source the environment
source ../../emsdk/emsdk_env.sh
```

**2. Asyncify flags not recognized**
```bash
# Solution: Update Emscripten to latest version
cd ../../emsdk
./emsdk install latest
./emsdk activate latest
```

**3. Missing headers**
```bash
# Solution: Ensure includes are correct
#include <emscripten.h>  // For EM_ASYNC_JS
```

**4. Library function errors**
```bash
# Solution: Check library.js function signatures
# Ensure ccall arguments match C function signatures
```

### Build Verification

Verify the build includes asyncify:
```bash
# Check for asyncify in the wasm file
wasm-objdump -h build-asyncify/micropython.wasm | grep -i async

# Check file sizes (asyncify should be larger)
ls -la build-asyncify/micropython.wasm
ls -la ../build-standard/micropython.wasm  # Compare with standard
```

## 📊 Build Variants Comparison

| Variant | Size | Features | Use Case |
|---------|------|----------|-----------|
| **standard** | ~1.2MB | Standard MicroPython | General use, smaller size |
| **asyncify** | ~1.4MB | + Asyncify input() | Interactive applications |

## 🔄 Continuous Integration

### Automated Builds
```bash
#!/bin/bash
# build-asyncify.sh

set -e

echo "🔧 Setting up Emscripten..."
source ../../emsdk/emsdk_env.sh

echo "🧹 Cleaning previous builds..."
make VARIANT=asyncify clean

echo "🏗️ Building asyncify variant..."
make VARIANT=asyncify

echo "🧪 Testing build..."
cd build-asyncify
node ../test_automated_verification.js

echo "✅ Asyncify build complete and verified!"
```

### GitHub Actions Example
```yaml
name: Build MicroPython Asyncify
on: [push, pull_request]

jobs:
  build-asyncify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive
      
      - name: Setup Emscripten
        uses: mymindstorm/setup-emsdk@v11
        with:
          version: latest
      
      - name: Build Asyncify Variant
        run: |
          cd ports/webassembly
          make VARIANT=asyncify
      
      - name: Test Build
        run: |
          cd ports/webassembly/build-asyncify
          node ../test_automated_verification.js
      
      - name: Upload Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: micropython-asyncify
          path: ports/webassembly/build-asyncify/
```

## 📝 Customization Options

### Custom Input Handlers

Replace the browser `prompt()` with custom UI:
```javascript
// In the EM_ASYNC_JS block
// Browser environment with custom UI
else {
    return new Promise((resolve) => {
        // Custom input dialog
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="input-modal">
                <input type="text" id="python-input" placeholder="Enter value...">
                <button onclick="submitInput()">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        window.submitInput = () => {
            const value = document.getElementById('python-input').value;
            document.body.removeChild(modal);
            const ptr = allocateUTF8(value);
            resolve(ptr);
        };
    });
}
```

### Build Optimization

For production builds:
```makefile
# Add to mpconfigvariant.mk
CFLAGS += -O3                    # Maximum optimization
CFLAGS += --closure 1            # Closure compiler
CFLAGS += -sASSERTIONS=0        # Disable assertions
CFLAGS += -sENVIRONMENT=web     # Web-only (smaller size)
```

## 🔗 Resources

### Documentation
- [Emscripten Asyncify](https://emscripten.org/docs/porting/asyncify.html)
- [MicroPython WebAssembly Port](https://github.com/micropython/micropython/tree/master/ports/webassembly)
- [WebAssembly Spec](https://webassembly.github.io/spec/)

### Tools
- [Emscripten SDK](https://github.com/emscripten-core/emsdk)
- [WebAssembly Binary Toolkit](https://github.com/WebAssembly/wabt)
- [Node.js](https://nodejs.org/) (for testing)
