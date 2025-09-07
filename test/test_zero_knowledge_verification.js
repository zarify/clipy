// Test file for zero-knowledge verification system
import { generateVerificationCode, verifyStudentCode, shouldShowVerificationCode } from '../src/js/zero-knowledge-verification.js'

// Mock test configuration
const mockTestConfig = {
    tests: [
        {
            id: 'test1',
            description: 'Test basic functionality',
            stdin: '',
            expected_stdout: 'Hello, World!',
            expected_stderr: '',
            timeoutMs: 5000
        },
        {
            id: 'test2',
            description: 'Test with input',
            stdin: 'Alice',
            expected_stdout: 'Hello, Alice!',
            expected_stderr: '',
            timeoutMs: 5000
        }
    ]
}

// Mock test results - all passed
const mockPassingResults = [
    { id: 'test1', passed: true, skipped: false },
    { id: 'test2', passed: true, skipped: false }
]

// Mock test results - some failed
const mockFailingResults = [
    { id: 'test1', passed: true, skipped: false },
    { id: 'test2', passed: false, skipped: false }
]

// Mock test results - with skipped tests
const mockMixedResults = [
    { id: 'test1', passed: true, skipped: false },
    { id: 'test2', passed: false, skipped: true }
]

async function runTests() {
    console.log('🧪 Testing zero-knowledge verification system...')

    const studentId = 'blue-tiger-17'

    try {
        // Test 1: Should show verification code for all passing tests
        console.log('\n✅ Test 1: All tests passed')
        const shouldShow1 = shouldShowVerificationCode(mockPassingResults)
        console.log('Should show verification code:', shouldShow1) // Should be true

        if (shouldShow1) {
            const code1 = await generateVerificationCode(mockTestConfig, studentId, true)
            console.log('Generated verification code:', code1)

            // Verify the code
            const isValid1 = await verifyStudentCode(code1, mockTestConfig, studentId)
            console.log('Code verification:', isValid1) // Should be true
        }

        // Test 2: Should NOT show verification code for failing tests
        console.log('\n❌ Test 2: Some tests failed')
        const shouldShow2 = shouldShowVerificationCode(mockFailingResults)
        console.log('Should show verification code:', shouldShow2) // Should be false

        // Test 3: Should show verification code when only executed tests pass (skipped don't count)
        console.log('\n⏭️ Test 3: Mixed results with skipped tests')
        const shouldShow3 = shouldShowVerificationCode(mockMixedResults)
        console.log('Should show verification code:', shouldShow3) // Should be true (only executed test passed)

        // Test 4: Generate code without student ID should return null
        console.log('\n🚫 Test 4: No student ID')
        const code4 = await generateVerificationCode(mockTestConfig, null, true)
        console.log('Code without student ID:', code4) // Should be null

        // Test 5: Generate code when tests didn't all pass should return null
        console.log('\n🚫 Test 5: Not all tests passed')
        const code5 = await generateVerificationCode(mockTestConfig, studentId, false)
        console.log('Code when not all passed:', code5) // Should be null

        // Test 6: Test deterministic code generation (same inputs = same code)
        console.log('\n🔄 Test 6: Code determinism')
        const codeA = await generateVerificationCode(mockTestConfig, studentId, true)
        const codeB = await generateVerificationCode(mockTestConfig, studentId, true)
        console.log('Code A:', codeA)
        console.log('Code B:', codeB)
        console.log('Codes match:', codeA === codeB) // Should be true (same day)

        // Test 7: Different student IDs produce different codes
        console.log('\n🔀 Test 7: Different student IDs')
        const codeStudent1 = await generateVerificationCode(mockTestConfig, 'blue-tiger-17', true)
        const codeStudent2 = await generateVerificationCode(mockTestConfig, 'red-dragon-23', true)
        console.log('Student 1 code:', codeStudent1)
        console.log('Student 2 code:', codeStudent2)
        console.log('Codes different:', codeStudent1 !== codeStudent2) // Should be true

        console.log('\n🎉 All tests completed!')

    } catch (error) {
        console.error('❌ Test failed:', error)
    }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
    // Node.js environment - polyfill crypto if needed
    if (typeof crypto === 'undefined') {
        global.crypto = require('crypto').webcrypto
    }
    runTests()
} else {
    // Browser environment - expose function for manual testing
    window.testVerificationSystem = runTests
    console.log('Zero-knowledge verification test loaded. Run window.testVerificationSystem() to test.')
}
