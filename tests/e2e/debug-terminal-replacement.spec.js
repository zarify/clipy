import { test, expect } from '@playwright/test'

test('Debug terminal replacement step by step', async ({ page }) => {
    console.log('🔧 Debugging terminal replacement in detail...')

    await page.goto('/')
    await page.waitForSelector('#editor')
    await page.waitForFunction(() => window.runtimeAdapter)

    // Simple 2-line test case for easier debugging
    const code = `# Line 1
print(z)  # Line 2 - should error and show as line 1`

    await page.evaluate((code) => {
        const editor = document.querySelector('.CodeMirror');
        if (editor && editor.CodeMirror) {
            editor.CodeMirror.setValue(code);
        }
        window.__ssg_debug_logs = true;
    }, code)

    // Clear events and set up detailed tracking
    await page.evaluate(() => {
        window.__ssg_terminal_event_log = []

        // Track DOM changes to the terminal
        window.__ssg_terminal_dom_log = []

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.textContent) {
                            window.__ssg_terminal_dom_log.push({
                                when: Date.now(),
                                action: 'dom_added',
                                content: node.textContent.substring(0, 100)
                            })
                        }
                    })

                    mutation.removedNodes.forEach((node) => {
                        if (node.textContent) {
                            window.__ssg_terminal_dom_log.push({
                                when: Date.now(),
                                action: 'dom_removed',
                                content: node.textContent.substring(0, 100)
                            })
                        }
                    })
                }
            })
        })

        const terminalOutput = document.getElementById('terminal-output')
        if (terminalOutput) {
            observer.observe(terminalOutput, { childList: true, subtree: true })
        }

        window.__ssg_dom_observer = observer
    })

    console.log('▶️ Running the code and tracking replacement...')
    await page.click('#run')

    // Wait for execution to complete
    await page.waitForTimeout(3000)

    // Get detailed replacement analysis
    const replacementAnalysis = await page.evaluate(() => {
        // Stop observing
        if (window.__ssg_dom_observer) {
            window.__ssg_dom_observer.disconnect()
        }

        const terminalEvents = window.__ssg_terminal_event_log || []
        const domEvents = window.__ssg_terminal_dom_log || []

        // Get current terminal content
        const terminalOutput = document.getElementById('terminal-output')
        const currentContent = terminalOutput ? terminalOutput.textContent : 'NO TERMINAL'

        // Find key events
        const mappingEvents = terminalEvents.filter(e =>
            e.action === 'about_to_map' ||
            e.action === 'mapped_debug' ||
            e.action === 'replaceBufferedStderr' ||
            e.action === 'about_to_append_mapped' ||
            e.action === 'suppress_set'
        )

        const replacementEvents = terminalEvents.filter(e =>
            e.action.includes('replaceBufferedStderr')
        )

        // Find DOM changes
        const domAdds = domEvents.filter(e => e.action === 'dom_added')
        const domRemoves = domEvents.filter(e => e.action === 'dom_removed')

        return {
            mappingEvents,
            replacementEvents,
            domAdds,
            domRemoves,
            currentContent,
            hasLine1: currentContent.includes('line 1'),
            hasLine2: currentContent.includes('line 2'),
            hasLine43: currentContent.includes('line 43'),
            linePattern: currentContent.match(/line \d+/g) || []
        }
    })

    console.log('📊 TERMINAL REPLACEMENT ANALYSIS:')
    console.log('=================================================')

    console.log('🔍 Key Mapping Events:')
    replacementAnalysis.mappingEvents.forEach((event, i) => {
        console.log(`  ${i}: ${event.action}`)
        if (event.mappedPreview) console.log(`     mapped: "${event.mappedPreview}"`)
        if (event.rawPreview) console.log(`     raw: "${event.rawPreview}"`)
        if (event.headerLines) console.log(`     headerLines: ${event.headerLines}`)
    })

    console.log('\n🔄 Replacement Events:')
    replacementAnalysis.replacementEvents.forEach((event, i) => {
        console.log(`  ${i}: ${event.action}`)
        if (event.mappedPreview) console.log(`     mapped: "${event.mappedPreview}"`)
        if (event.guessedPreview) console.log(`     guessed: "${event.guessedPreview}"`)
        if (event.sample) console.log(`     sample: "${event.sample}"`)
    })

    console.log('\n🏗️ DOM Changes:')
    console.log(`  Added nodes: ${replacementAnalysis.domAdds.length}`)
    replacementAnalysis.domAdds.forEach((event, i) => {
        console.log(`    ${i}: "${event.content}"`)
    })

    console.log(`  Removed nodes: ${replacementAnalysis.domRemoves.length}`)
    replacementAnalysis.domRemoves.forEach((event, i) => {
        console.log(`    ${i}: "${event.content}"`)
    })

    console.log('\n🎯 Final Analysis:')
    console.log(`  Current content preview: "${replacementAnalysis.currentContent.substring(replacementAnalysis.currentContent.lastIndexOf('Traceback'))}"`)
    console.log(`  Contains "line 1": ${replacementAnalysis.hasLine1}`)
    console.log(`  Contains "line 2": ${replacementAnalysis.hasLine2}`)
    console.log(`  Contains "line 43": ${replacementAnalysis.hasLine43}`)
    console.log(`  All line patterns: ${JSON.stringify(replacementAnalysis.linePattern)}`)

    const status = replacementAnalysis.hasLine1 && !replacementAnalysis.hasLine2 && !replacementAnalysis.hasLine43
    console.log(`  Status: ${status ? '✅ FIXED' : '❌ BROKEN'}`)

})