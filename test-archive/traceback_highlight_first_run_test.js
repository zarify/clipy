const assert = require('assert')

// Create a fake global window and cm to simulate browser environment
global.window = {}
let added = []
let removed = []

const cm = {
    addLineClass(line, where, cls) {
        added.push({ line, where, cls })
    },
    removeLineClass(line, where, cls) {
        removed.push({ line, where, cls })
    }
}

// Attach cm to global as window.cm
global.window.cm = cm

// Require the module under test (use the transpiled path)
const { highlightMappedTracebackInEditor, clearAllErrorHighlights } = require('../src/js/code-transform')

function reset() {
    added = []
    removed = []
    global.window.__ssg_error_highlights = []
    global.window.__ssg_error_highlighted = false
    global.window.__ssg_error_line_number = null
}

// Test: first highlight then clear should remove
reset()
highlightMappedTracebackInEditor('/main.py', 3)
assert.strictEqual(added.length, 1, 'should have added one highlight')
clearAllErrorHighlights()
assert.strictEqual(removed.length, 1, 'should have removed one highlight on first clear')
assert.deepStrictEqual(global.window.__ssg_error_highlights, [], 'highlights array should be cleared')

// Test: clear before any highlight then highlight then clear
reset()
clearAllErrorHighlights()
assert.strictEqual(removed.length, 0, 'no highlights to remove')
highlightMappedTracebackInEditor('/main.py', 2)
assert.strictEqual(added.length, 1, 'should add highlight after clearing first')
clearAllErrorHighlights()
assert.strictEqual(removed.length, 1, 'should remove the highlight after clear')

// Test: highlight twice then clear should remove both
reset()
highlightMappedTracebackInEditor('/main.py', 1)
highlightMappedTracebackInEditor('/main.py', 2)
assert.strictEqual(added.length, 2, 'two highlights added')
clearAllErrorHighlights()
// removeLineClass should have been called twice
assert.strictEqual(removed.length, 2, 'two removes on clear')

console.log('All tests passed')
