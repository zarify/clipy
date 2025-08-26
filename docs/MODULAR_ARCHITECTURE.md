# Modular Architecture Documentation

## Overview

Clipy has been refactored from a monolithic 3,294-line `main.js` file into a modular architecture consisting of 13 focused modules, achieving a total reduction to 3,235 lines (-1.8%) while dramatically improving maintainability.

## Architecture Benefits

✅ **Maintainability**: Issues can be isolated to specific modules  
✅ **Debuggability**: Clear separation of concerns  
✅ **Testability**: Individual components can be tested in isolation  
✅ **Extensibility**: New features can be added to appropriate modules  
✅ **Code Quality**: Better organization and reduced complexity  

## Module Structure

### Core Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| **`micropython.js`** | 774 | MicroPython runtime management, execution state control, VM interruption |
| **`execution.js`** | 403 | Code execution orchestration, timeout handling, error management |
| **`vfs.js`** | 370 | Virtual filesystem operations, file persistence, backend integration |
| **`snapshots.js`** | 297 | Snapshot save/restore system, application state management |
| **`terminal.js`** | 290 | Terminal output rendering, input collection, ANSI handling |

### UI & Integration Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| **`tabs.js`** | 248 | Tab management system, file switching, tab lifecycle |
| **`input-handling.js`** | 221 | Input collection, prompt management, stdin handling |
| **`code-transform.js`** | 195 | Python code transformation, async wrapping, input() replacement |
| **`modals.js`** | 172 | Modal dialog system, accessibility features |
| **`editor.js`** | 121 | CodeMirror integration, syntax highlighting, editor state |

### Utility Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| **`utils.js`** | 59 | Shared utility functions, DOM helpers |
| **`autosave.js`** | 55 | Automatic saving functionality, debounced persistence |
| **`config.js`** | 30 | Configuration loading and management |
| **`vfs-glue.js`** | 0 | VFS integration glue code (placeholder) |

## Entry Point

- **`app.js`**: Main application entry point that imports and initializes all modules
- **`index.html`**: HTML shell that loads `app.js` as an ES6 module

## Key Features

### 1. MicroPython Runtime Integration
- Asyncify v3.0.0 support with yielding and interruption
- Safety timeout system (30s) with proper cleanup
- VM state management and recovery

### 2. Virtual File System
- IndexedDB-backed persistence
- Runtime filesystem synchronization
- File notification system for UI updates

### 3. Advanced Input Handling
- Terminal-based input collection
- Accessible prompt management
- Graceful interrupt handling during input

### 4. Execution Management
- Timeout-based execution control
- Proper abort controller cleanup
- Error recovery and state reset

### 5. UI Components
- Tab-based file management
- Accessible modal dialogs
- Real-time terminal output
- Autosave functionality

## Testing

The modular architecture maintains **100% test compatibility** with all 41 Playwright end-to-end tests passing, ensuring no regression in functionality during the refactoring process.

## Migration Notes

- Original `main.js` (3,294 lines) has been completely replaced
- All functionality preserved with improved organization
- ES6 module system used throughout
- Async/await patterns consistently applied
- No breaking changes to public APIs
