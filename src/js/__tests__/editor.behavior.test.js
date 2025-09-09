import { jest } from '@jest/globals'

describe('editor behavior tests', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        // Default DOM elements used by many tests
        const textarea = document.createElement('textarea')
        textarea.id = 'code'
        document.body.appendChild(textarea)

        const host = document.createElement('div')
        host.id = 'editor-host'
        document.body.appendChild(host)

        const runBtn = document.createElement('button')
        runBtn.id = 'run'
        document.body.appendChild(runBtn)

        // Clean any previous globals
        delete window.CodeMirror
        delete window.cm
        delete window.setEditorModeForPath
        delete window.Feedback
        delete window.TabManager
    })

    test('initializeEditor returns null when required DOM nodes missing', async () => {
        // Remove required elements
        document.body.innerHTML = ''
        const mod = await import('../editor.js')
        const { initializeEditor } = mod
        const res = initializeEditor()
        expect(res).toBeNull()
    })

    test('Ctrl-Enter extraKeys triggers run button click', async () => {
        // Fake CodeMirror capturing options
        const createFakeCM = () => {
            const options = {}
            let value = ''
            const handlers = {}
            return {
                getOption: (k) => options[k],
                setOption: (k, v) => { options[k] = v },
                getValue: () => value,
                setValue: (v) => { value = v },
                on: (evt, cb) => { handlers[evt] = cb },
                _triggerChange: () => { if (handlers.change) handlers.change() },
                __getOptions: () => ({ ...options }),
            }
        }
        window.CodeMirror = (host, opts = {}) => {
            const cm = createFakeCM()
            if (opts && typeof opts.value !== 'undefined') cm.setValue(opts.value)
            return cm
        }

        const mod = await import('../editor.js')
        const { initializeEditor, getCodeMirror } = mod

        // Spy on run button click
        const runBtn = document.getElementById('run')
        runBtn.click = jest.fn()

        const cm = initializeEditor()
        expect(cm).toBeDefined()

        const live = getCodeMirror()
        const extra = live.__getOptions().extraKeys
        // extraKeys should be configured
        expect(extra).toBeDefined()
        // invoke the Ctrl-Enter handler if present
        const handler = extra['Ctrl-Enter'] || extra['Ctrl-Enter'.replace(/Ctrl/, 'Ctrl')]
        expect(typeof handler).toBe('function')
        handler()
        expect(runBtn.click).toHaveBeenCalled()
    })

    test('scheduleFeedbackEvaluation is debounced and calls Feedback.evaluateFeedbackOnEdit', async () => {
        jest.useFakeTimers()

        // Fake CM with change handler
        const createFakeCM = () => {
            let value = ''
            const handlers = {}
            return {
                getOption: () => undefined,
                setOption: () => { },
                getValue: () => value,
                setValue: (v) => { value = v },
                on: (evt, cb) => { handlers[evt] = cb },
                _triggerChange: () => { if (handlers.change) handlers.change() },
            }
        }
        window.CodeMirror = () => createFakeCM()

        window.Feedback = { evaluateFeedbackOnEdit: jest.fn() }

        const mod = await import('../editor.js')
        const { initializeEditor, getCodeMirror, getTextarea } = mod

        const cm = initializeEditor()
        const live = getCodeMirror()
        // ensure content is present
        live.setValue('abc')
        // trigger change -> schedule debounce
        if (typeof live._triggerChange === 'function') live._triggerChange()

        // advance time below debounce
        jest.advanceTimersByTime(100)
        expect(window.Feedback.evaluateFeedbackOnEdit).not.toHaveBeenCalled()

        // advance past debounce (300ms default)
        jest.advanceTimersByTime(250)
        expect(window.Feedback.evaluateFeedbackOnEdit).toHaveBeenCalled()

        jest.useRealTimers()
    })

    test('programmatic textarea changes are picked up and mirrored to CodeMirror', async () => {
        jest.useFakeTimers()

        // Fake CM that tracks value
        const createFakeCM = () => {
            let value = ''
            const handlers = {}
            return {
                getOption: () => undefined,
                setOption: () => { },
                getValue: () => value,
                setValue: (v) => { value = v },
                on: (evt, cb) => { handlers[evt] = cb },
                _triggerChange: () => { if (handlers.change) handlers.change() },
            }
        }
        window.CodeMirror = () => createFakeCM()

        const mod = await import('../editor.js')
        const { initializeEditor, getCodeMirror, getTextarea } = mod

        const cm = initializeEditor()
        const live = getCodeMirror()
        const ta = getTextarea()

        // Programmatic change
        ta.value = 'programmatic'

        // Advance interval by >50ms so checkForProgrammaticChanges runs
        jest.advanceTimersByTime(60)

        expect(live.getValue()).toBe('programmatic')

        jest.useRealTimers()
    })

    test('initializeEditor continues when exposing globals throws', async () => {
        // make window.cm setter throw
        Object.defineProperty(window, 'cm', {
            set() { throw new Error('boom') },
            configurable: true
        })

        // minimal fake CM
        window.CodeMirror = () => ({ getOption: () => undefined, setOption: () => { }, getValue: () => '', setValue: () => { }, on: () => { } })

        const mod = await import('../editor.js')
        const { initializeEditor } = mod

        // should not throw
        expect(() => initializeEditor()).not.toThrow()
        // cleanup: remove the throwing property
        delete window.cm
    })
})
