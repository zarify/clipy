import { test, expect } from '@playwright/test'

test('Debug instrumentation line count', async ({ page }) => {
    console.log('🔍 Debugging instrumentation line count...')

    await page.goto('/')

    // Wait for app to load and runtime to initialize
    await page.waitForSelector('#editor')
    await page.waitForFunction(() => window.runtimeAdapter)

    const code = `# Line 1
# Line 2  
# Line 3
print(z)  # Line 4 - should error here`

    // Set the code in the editor
    await page.evaluate((code) => {
        const editor = document.querySelector('.CodeMirror');
        if (editor && editor.CodeMirror) {
            editor.CodeMirror.setValue(code);
        }
        window.__ssg_debug_logs = true;
    }, code)

    // Get instrumentation results before running
    const instrumentationResult = await page.evaluate(async (code) => {
        try {
            // Import the instrumentor
            const { getPythonInstrumentor } = await import('./js/python-instrumentor.js')
            const instrumentor = getPythonInstrumentor()

            // Test with raw code (no asyncify base)
            const rawResult = await instrumentor.instrumentCode(code, window.runtimeAdapter)

            // Test with asyncify base
            const asyncifyBase = 21
            const totalResult = {
                rawInstrumentation: rawResult,
                baseHeaderLines: asyncifyBase,
                totalHeaderLines: asyncifyBase + (rawResult?.headerLines || 0)
            }

            // Count actual lines
            const originalLines = code.split('\n').length
            const instrumentedLines = rawResult?.code ? rawResult.code.split('\n').length : 0
            const addedLines = instrumentedLines - originalLines

            return {
                original: {
                    code: code,
                    lines: originalLines
                },
                instrumented: {
                    code: rawResult?.code || 'ERROR',
                    lines: instrumentedLines,
                    reportedHeaderLines: rawResult?.headerLines || 0,
                    actualAddedLines: addedLines
                },
                headerLinesCalc: totalResult,
                codePreview: {
                    first20Lines: rawResult?.code ? rawResult.code.split('\n').slice(0, 20).join('\n') : 'ERROR',
                    last10Lines: rawResult?.code ? rawResult.code.split('\n').slice(-10).join('\n') : 'ERROR'
                }
            }
        } catch (error) {
            return { error: error.toString() }
        }
    }, code)

    console.log('📊 INSTRUMENTATION ANALYSIS:')
    console.log('==================================================')

    if (instrumentationResult.error) {
        console.log('❌ Error:', instrumentationResult.error)
        return
    }

    const { original, instrumented, headerLinesCalc, codePreview } = instrumentationResult

    console.log('📝 Original Code:')
    console.log(`  Lines: ${original.lines}`)
    console.log(`  Code: "${original.code}"`)

    console.log('\n🔧 Instrumented Code:')
    console.log(`  Lines: ${instrumented.lines}`)
    console.log(`  Reported header lines: ${instrumented.reportedHeaderLines}`)
    console.log(`  Actual added lines: ${instrumented.actualAddedLines}`)

    console.log('\n📊 Header Lines Calculation:')
    console.log(`  Asyncify base: ${headerLinesCalc.baseHeaderLines}`)
    console.log(`  Instrumentation reported: ${instrumented.reportedHeaderLines}`)
    console.log(`  Total calculated: ${headerLinesCalc.totalHeaderLines}`)
    console.log(`  Actual lines added: ${instrumented.actualAddedLines}`)
    console.log(`  Correct total should be: ${headerLinesCalc.baseHeaderLines + instrumented.actualAddedLines}`)

    console.log('\n📄 Instrumented Code Preview (first 20 lines):')
    console.log(codePreview.first20Lines)

    console.log('\n📄 Instrumented Code Preview (last 10 lines):')
    console.log(codePreview.last10Lines)

    // Now run the code and see what line is reported
    await page.click('#run')
    await page.waitForTimeout(2000)

    const terminalContent = await page.locator('#terminal-output').textContent()
    const lineMatch = terminalContent.match(/line (\d+)/)
    const reportedLine = lineMatch ? parseInt(lineMatch[1]) : null

    console.log('\n🎯 Execution Results:')
    console.log(`  Reported error line: ${reportedLine}`)
    console.log(`  Expected user line: 4`)
    console.log(`  Expected runtime line: ${headerLinesCalc.baseHeaderLines + instrumented.actualAddedLines + 4}`)
    console.log(`  Calculated mapping should be: ${reportedLine} - ${headerLinesCalc.totalHeaderLines} = ${reportedLine - headerLinesCalc.totalHeaderLines}`)

    // Analysis
    if (reportedLine && reportedLine > headerLinesCalc.totalHeaderLines) {
        const mappedLine = reportedLine - headerLinesCalc.totalHeaderLines
        console.log(`  Mapping result: line ${mappedLine} ${mappedLine === 4 ? '✅ CORRECT' : '❌ WRONG'}`)
    } else {
        console.log('  ❌ Cannot calculate mapping - insufficient data')
    }

})