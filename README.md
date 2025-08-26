# Clipy - Client-Side Python Playground

A modern, browser-based Python interpreter powered by MicroPython WebAssembly with advanced features for interactive coding, file management, and execution control.

## Features

### 🐍 **MicroPython Runtime**
- Asyncify v3.0.0 WebAssembly build with yielding support
- VM interruption and timeout control
- Graceful error handling and recovery

### 📝 **Advanced Editor**
- CodeMirror integration with Python syntax highlighting
- Tab-based file management system
- Real-time autosave functionality
- Accessible keyboard shortcuts (Ctrl+Enter to run)

### 💾 **File System**
- Virtual file system with IndexedDB persistence
- Real-time file synchronization between UI and runtime
- Snapshot save/restore system for application state

### 🖥️ **Interactive Terminal**
- Real-time output display with ANSI support
- Inline input collection for `input()` calls
- Accessible terminal interface with proper ARIA labels

### ⚡ **Execution Control**
- Configurable timeout system (30s default)
- VM interruption for infinite loop protection
- Start/stop execution with proper cleanup

## Architecture

Clipy features a **modular architecture** with 13 focused modules totaling 3,235 lines of code:

- **Core Runtime**: MicroPython integration, execution management, VFS
- **UI Components**: Editor, terminal, tabs, modals
- **Utilities**: Configuration, transformations, input handling

See [`docs/MODULAR_ARCHITECTURE.md`](docs/MODULAR_ARCHITECTURE.md) for detailed documentation.

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd clipy
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   # or
   python -m http.server 8000
   ```

3. **Open browser:**
   Navigate to `http://localhost:8000/src/`

4. **Start coding:**
   - Write Python code in the editor
   - Press `Ctrl+Enter` or click "Run" to execute
   - Use tabs to manage multiple files
   - Save snapshots to preserve your work

## Testing

Run the comprehensive test suite with Playwright:

```bash
npm test
```

**Current status:** ✅ 41/41 tests passing (100% success rate)

## File Structure

```
src/
├── index.html          # Main HTML shell
├── app.js             # Application entry point
├── style.css          # Application styles
└── js/                # Modular JavaScript architecture
    ├── micropython.js    # Runtime management (774 lines)
    ├── execution.js      # Execution control (403 lines)
    ├── vfs.js           # Virtual filesystem (370 lines)
    ├── snapshots.js     # State management (297 lines)
    ├── terminal.js      # Terminal interface (290 lines)
    ├── tabs.js          # Tab management (248 lines)
    ├── input-handling.js # Input collection (221 lines)
    ├── code-transform.js # Code transformation (195 lines)
    ├── modals.js        # Modal dialogs (172 lines)
    ├── editor.js        # CodeMirror integration (121 lines)
    ├── autosave.js      # Auto-save functionality (55 lines)
    ├── config.js        # Configuration (30 lines)
    └── utils.js         # Utilities (59 lines)
```

## Configuration

Edit `src/config/sample.json` to customize:

- Runtime WebAssembly URLs
- Starter code templates
- Instructions and help text
- Feedback and error patterns

## Browser Compatibility

- **Chrome/Edge**: Full support including WASM threading
- **Firefox**: Full support with Asyncify
- **Safari**: Basic support (may require additional configuration)

## Contributing

1. Follow the modular architecture principles
2. Maintain test coverage (run `npm test`)
3. Update documentation for new features
4. Use ES6 modules and async/await patterns

## License

See [LICENSE](LICENSE) file for details.

## Technical Notes

- Built on MicroPython WebAssembly with Asyncify support
- Uses IndexedDB for persistent file storage
- Implements proper accessibility patterns (ARIA, keyboard navigation)
- Supports VM interruption for responsive UI during long operations
- Comprehensive error mapping and debugging support
