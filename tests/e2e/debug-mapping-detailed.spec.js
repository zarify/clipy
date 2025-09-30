import { test, expect } from '@playwright/test'

test('Debug mapping issue step by step', async ({ page }) => {
    console.log('🔍 Debugging mapping issue...')

    await page.goto('/')

    // Wait for app to load and runtime to initialize
    await page.waitForSelector('#editor')
    await page.waitForFunction(() => window.editor && window.runtimeAdapter)

    // Set the problematic code
    const code = `# Test code with 22 lines
x = 1
y = 2

def func1():
    return x + y

def func2():
    return func1() * 2

class TestClass:
    def __init__(self):
        self.value = 42
    
    def method1(self):
        return self.value * 2

if x == 1:
    result = func2()
    print(result)

print(z)  # Line 22 - should error here`

    // Set the code in the editor
    await page.evaluate((code) => {
        const editor = document.querySelector('.CodeMirror');
        if (editor && editor.CodeMirror) {
            editor.CodeMirror.setValue(code);
        } else {
            throw new Error('Could not find CodeMirror editor');
        }
        window.__ssg_debug_logs = true;
    }, code)

    // Clear any previous events
    await page.evaluate(() => {
        window.__ssg_terminal_event_log = []
    })

    // Run the code
    console.log('▶️ Running the code...')
    await page.click('#run')

    // Wait for execution to complete
    await page.waitForTimeout(2000)

    // Get detailed execution information
    const executionInfo = await page.evaluate(() => {
        return {
            events: window.__ssg_terminal_event_log || [],
            lastMappedEvent: window.__ssg_last_mapped_event || null,
            stderrBuffer: window.__ssg_stderr_buffer || [],
            lastRawStderr: window.__ssg_last_raw_stderr_buffer || [],
            lastMapped: window.__ssg_last_mapped || null
        }
    })

    console.log('📊 DETAILED EXECUTION INFO:')
    console.log('==================================================')

    // Find key events
    const mapEvents = executionInfo.events.filter(e =>
        e.action === 'about_to_map' ||
        e.action === 'mapped_debug' ||
        e.action === 'replaceBufferedStderr' ||
        e.action === 'replaceBufferedStderr_fallback_guessed'
    )

    console.log('🔍 Key Mapping Events:')
    mapEvents.forEach((event, i) => {
        console.log(`  ${i}: ${event.action}`)
        if (event.headerLines) console.log(`     headerLines: ${event.headerLines}`)
        if (event.mappedPreview) console.log(`     mappedPreview: "${event.mappedPreview.substring(0, 100)}..."`)
        if (event.guessedPreview) console.log(`     guessedPreview: "${event.guessedPreview.substring(0, 100)}..."`)
        if (event.rawPreview) console.log(`     rawPreview: "${event.rawPreview.substring(0, 100)}..."`)
    })

    console.log('\n🔧 Execution State:')
    console.log(`  lastMappedEvent: ${JSON.stringify(executionInfo.lastMappedEvent, null, 2)}`)
    console.log(`  lastMapped: ${executionInfo.lastMapped ? `"${executionInfo.lastMapped.substring(0, 100)}..."` : null}`)
    console.log(`  stderrBuffer length: ${executionInfo.stderrBuffer.length}`)
    console.log(`  lastRawStderr length: ${executionInfo.lastRawStderr.length}`)

    // Get terminal content
    const terminalContent = await page.locator('#terminal-output').textContent()
    console.log('\n🖥️ Final Terminal Content:')
    console.log(terminalContent)

    // Check if we see line 43 or line 1
    const hasLine43 = terminalContent.includes('line 43')
    const hasLine1 = terminalContent.includes('line 1')

    console.log('\n📋 Line Analysis:')
    console.log(`  Contains "line 43": ${hasLine43}`)
    console.log(`  Contains "line 1": ${hasLine1}`)
    console.log(`  Status: ${hasLine1 ? '✅ FIXED' : '❌ BROKEN'}`)
})