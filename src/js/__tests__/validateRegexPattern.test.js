import { validateRegexPattern } from '../config.js'

describe('validateRegexPattern', () => {
    test('rejects empty or non-string', () => {
        expect(validateRegexPattern('', {}).ok).toBe(false)
        expect(validateRegexPattern(null, {}).ok).toBe(false)
        expect(validateRegexPattern(123, {}).ok).toBe(false)
    })

    test('rejects nested quantifiers pattern', () => {
        const p = '(a+)+b'
        const res = validateRegexPattern(p, {})
        expect(res.ok).toBe(false)
        expect(res.reason).toMatch(/nested quantifiers|catastrophic/i)
    })

    test('rejects very large repetition', () => {
        const p = 'a{100000,}'
        const res = validateRegexPattern(p, {})
        expect(res.ok).toBe(false)
        expect(res.reason).toMatch(/very large repetition/i)
    })

    test('accepts simple safe pattern', () => {
        const p = '^hello\\sworld$'
        const res = validateRegexPattern(p, {})
        expect(res.ok).toBe(true)
    })
})
