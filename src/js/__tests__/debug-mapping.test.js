import { mapTracebackAndShow } from '../code-transform.js'

test('debug mapping regex', () => {
    // Test the exact input that was logged
    const rawText = `Traceback (most recent call last):
  File "/main.py", line 22, in <module>
NameError: name 'z' is not defined`

    console.log('=== INPUT ===')
    console.log(JSON.stringify(rawText))

    // Test the regex directly
    const regex = /\s*File\s+["']([^"']+)["']\s*,\s*line\s+(\d+)/g
    let match
    let found = false
    while ((match = regex.exec(rawText)) !== null) {
        console.log('=== REGEX MATCH ===')
        console.log('Full match:', JSON.stringify(match[0]))
        console.log('Filename:', JSON.stringify(match[1]))
        console.log('Line:', match[2])
        found = true
    }

    if (!found) {
        console.log('❌ REGEX DID NOT MATCH')

        // Try simpler patterns to debug
        const simpleFile = /File\s+"/g
        const simpleLine = /line\s+\d+/g

        console.log('File pattern matches:', rawText.match(simpleFile))
        console.log('Line pattern matches:', rawText.match(simpleLine))
    }

    // Call the actual mapping function with debug
    const originalLog = console.log
    console.log = (...args) => originalLog('[mapTracebackAndShow]', ...args)

    const mapped = mapTracebackAndShow(rawText, 21, '/main.py')

    console.log = originalLog
    console.log('=== MAPPING RESULT ===')
    console.log(JSON.stringify(mapped))

    expect(mapped).toBeTruthy()
})