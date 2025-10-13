import { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, evaluateFeedbackOnFileEvent, on as feedbackOn, off as feedbackOff } from '../feedback.js'

describe('Feedback filename rules (create/delete)', () => {
    const rule = [
        {
            id: 'fb-create-foo',
            title: 'Create foo.py',
            when: ['edit'],
            pattern: { type: 'string', target: 'filename', fileTarget: 'foo.py', expression: '' },
            message: '',
            severity: 'success',
            visibleByDefault: true
        }
    ]

    beforeEach(() => {
        // reset environment
        // Tests should not rely on legacy window.__ssg_mem; use FileManager shim below.
        // Provide a test FileManager shim for sync reads used by feedback
        try { window.FileManager = { read: async (p) => { return null }, list: async () => [] } } catch (_e) { }
        try { if (typeof window.__ssg_notify_file_written === 'function') delete window.__ssg_notify_file_written } catch (_e) { }
        resetFeedback({ feedback: rule })
    })

    test('rule not matched before file exists', async () => {
        const matches = await evaluateFeedbackOnEdit('', '/main.py')
        expect(matches.find(m => m.id === 'fb-create-foo')).toBeUndefined()
    })

    test('rule matches after create event (mem)', async () => {
        // simulate a file being written to the workspace via FileManager shim
        try { window.FileManager = { read: async (p) => p === '/foo.py' ? 'print(1)' : null, list: async () => ['/foo.py'] } } catch (_e) { }

        // call evaluateFeedbackOnEdit to pick up existence via FileManager
        const matches = await evaluateFeedbackOnEdit('', '/main.py')
        expect(matches.find(m => m.id === 'fb-create-foo')).toBeDefined()
    })

    test('rule matches after create event (notify wrapper)', async () => {
        // simulate notifier being called
        // ensure no match initially
        let m0 = await evaluateFeedbackOnEdit('', '/main.py')
        expect(m0.find(m => m.id === 'fb-create-foo')).toBeUndefined()

        // fire file created via event
        await evaluateFeedbackOnFileEvent({ type: 'create', filename: '/foo.py' })

        // now matches should include the rule
        const m1 = await evaluateFeedbackOnEdit('', '/main.py')
        expect(m1.find(m => m.id === 'fb-create-foo')).toBeDefined()
    })

    test('rule unmatches after delete event', async () => {
        // create then delete
        await evaluateFeedbackOnFileEvent({ type: 'create', filename: '/foo.py' })
        let m1 = await evaluateFeedbackOnEdit('', '/main.py')
        expect(m1.find(m => m.id === 'fb-create-foo')).toBeDefined()

        await evaluateFeedbackOnFileEvent({ type: 'delete', filename: '/foo.py' })
        const m2 = await evaluateFeedbackOnEdit('', '/main.py')
        expect(m2.find(m => m.id === 'fb-create-foo')).toBeUndefined()
    })
})
