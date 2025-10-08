import { jest } from '@jest/globals'

describe('author-feedback regex safety UI', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('unsafe regex entered in new feedback modal shows rejection and prevents save', async () => {
        // silence logger
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod

        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        ta.value = '[]'
        document.body.appendChild(ta)

        initAuthorFeedback()

        // Click Add feedback
        const addBtn = document.querySelector('#author-feedback-ui .btn')
        expect(addBtn).toBeTruthy()
        addBtn.click()

        const modal = document.querySelector('.modal')
        expect(modal).toBeTruthy()

        // Switch pattern type to regex
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'regex'))
        expect(pType).toBeTruthy()
        pType.value = 'regex'
        pType.dispatchEvent(new Event('change', { bubbles: true }))

        // Find the expression input (first text input that is not flags)
        const textInputs = Array.from(modal.querySelectorAll('input[type=text]'))
        expect(textInputs.length).toBeGreaterThan(0)
        // flags input has placeholder 'e.g. i' - exclude it
        const exprInput = textInputs.find(i => i.getAttribute('placeholder') !== 'e.g. i') || textInputs[0]
        // Enter an unsafe pattern that triggers nested quantifier heuristic
        exprInput.value = '(a+)+b'

        // Click Save
        let save = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Save')
        expect(save).toBeTruthy()
        save.click()

        // Allow microtasks to run
        await new Promise(r => setTimeout(r, 10))

        // Assert header message or inline error contains rejection text
        const headerMessage = modal.querySelector('.modal-header-message')
        const modalBody = modal.querySelector('#author-feedback-modal-body')
        const inlineErr = modalBody ? modalBody.querySelector('.modal-inline-err') : null

        const headerText = headerMessage ? headerMessage.textContent || '' : ''
        const inlineText = inlineErr ? inlineErr.textContent || '' : ''

        const combined = (headerText + '\n' + inlineText).toLowerCase()
        expect(combined).toMatch(/rejected pattern|nested quantifiers|unsafe pattern|catastrophic/i)

        // Ensure textarea was not updated (save was blocked)
        const parsed = JSON.parse(document.getElementById('feedback-editor').value || '[]')
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed.length).toBe(0)
    })
})
