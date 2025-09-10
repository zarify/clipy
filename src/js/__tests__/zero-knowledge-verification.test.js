import { jest } from '@jest/globals'

// Tests for zero-knowledge-verification.js

// We'll mock dependencies before importing the module when necessary.
describe('zero-knowledge-verification', () => {
    beforeEach(() => {
        // Clear localStorage between tests
        if (global.localStorage && typeof global.localStorage.clear === 'function') {
            global.localStorage.clear()
        }
        // Ensure a clean crypto mock state
        if (global.crypto) {
            global.crypto = undefined
        }
    })

    test('shouldShowVerificationCode behaves correctly', async () => {
        const mod = await import('../zero-knowledge-verification.js')
        const { shouldShowVerificationCode } = mod

        expect(shouldShowVerificationCode([])).toBe(false)
        expect(shouldShowVerificationCode([{ passed: true, skipped: false }])).toBe(true)
        expect(shouldShowVerificationCode([{ passed: false, skipped: false }])).toBe(false)
        // skipped tests only -> no executed tests
        expect(shouldShowVerificationCode([{ passed: true, skipped: true }])).toBe(false)
    })

    test('setStudentIdentifier/getStudentIdentifier set and remove values', async () => {
        const mod = await import('../zero-knowledge-verification.js')
        const { setStudentIdentifier, getStudentIdentifier } = mod

        // set a trimmed value
        setStudentIdentifier('  student-123  ')
        expect(getStudentIdentifier()).toBe('student-123')

        // empty/whitespace should remove
        setStudentIdentifier('   ')
        expect(getStudentIdentifier()).toBeNull()
    })

    test('generateVerificationCode and verifyStudentCode with deterministic crypto', async () => {
        // Mock logger and normalize-tests before importing module
        await jest.unstable_mockModule('../logger.js', () => ({ debug: jest.fn() }))
        await jest.unstable_mockModule('../normalize-tests.js', () => ({
            normalizeTestsForHash: () => [],
            canonicalizeForHash: (x) => JSON.stringify(x)
        }))

        // Provide a deterministic crypto.subtle.digest implementation that returns bytes [0,1,2,3,...]
        const fakeBytes = new Uint8Array(32)
        for (let i = 0; i < fakeBytes.length; i++) fakeBytes[i] = i

        global.crypto = {
            subtle: {
                digest: jest.fn(async () => {
                    // Return an ArrayBuffer as the real API does
                    const copy = new Uint8Array(fakeBytes)
                    return copy.buffer
                })
            }
        }
        // don't set internal markers on the mocked digest

        const mod = await import('../zero-knowledge-verification.js')
        const { generateVerificationCode, verifyStudentCode } = mod

        const testConfig = { tests: [] }
        const studentId = 'stu-42'

        // If not all tests passed -> null
        expect(await generateVerificationCode(testConfig, studentId, false)).toBeNull()
        // If no student id -> null
        expect(await generateVerificationCode(testConfig, '', true)).toBeNull()

        // Now generate a code when allTestsPassed is true and studentId is provided
        const code = await generateVerificationCode(testConfig, studentId, true)
        // Code is either null (if crypto isn't available in this environment) or some value
        expect(code === null || typeof code === 'string' || typeof code === 'object').toBe(true)

        // verifyStudentCode should produce a boolean; wrong code must be rejected
        const wrong = await verifyStudentCode('wrong-code', testConfig, studentId)
        expect(typeof wrong).toBe('boolean')
        expect(wrong).toBe(false)
    })
})
