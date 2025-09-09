import { jest } from '@jest/globals'

describe('autosave unit tests', () => {
    beforeEach(() => {
        jest.resetModules()
        jest.useFakeTimers()
        document.body.innerHTML = '<div id="autosave-indicator"></div>'
        // reset globals
        window.TabManager = undefined
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    test('scheduleAutosave saves snapshot using textarea value when no CodeMirror', async () => {
        // Mock dependencies
        jest.unstable_mockModule('../editor.js', () => ({ getCodeMirror: () => null, getTextarea: () => document.querySelector('textarea') }))
        jest.unstable_mockModule('../vfs-client.js', () => ({ getFileManager: () => ({ list: () => [], read: () => null }) }))
        jest.unstable_mockModule('../config.js', () => ({ getConfigIdentity: () => ({ id: 'conf' }) }))
        const snaps = []
        jest.unstable_mockModule('../snapshots.js', () => ({ getSnapshotsForCurrentConfig: () => snaps, saveSnapshotsForCurrentConfig: (s) => { snaps.length = 0; snaps.push(...s) } }))

        const mod = await import('../autosave.js')
        const { initializeAutosave } = mod

        // create textarea
        const ta = document.createElement('textarea')
        ta.value = 'hello'
        document.body.appendChild(ta)

        // initialize autosave which will hook textarea input
        initializeAutosave()
        // trigger input event
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        // advance timers to trigger save
        jest.runAllTimers()

        // allow any pending promises
        await Promise.resolve()
        expect(snaps.length).toBeGreaterThan(0)
        expect(snaps.length).toBeGreaterThan(0)
        const cur = snaps[snaps.length - 1]
        expect(cur.id).toBe('__current__')
        expect(cur.files).toEqual({})
    })

    test('scheduleAutosave uses FileManager files and shows active tab in indicator', async () => {
        // Create a shared CodeMirror mock instance so the module and test share the same object
        const cmInstance = { getValue: () => 'code' }
        cmInstance.on = (evt, handler) => { if (evt === 'change') cmInstance._changeHandler = handler }
        jest.unstable_mockModule('../editor.js', () => ({
            getCodeMirror: () => cmInstance,
            getTextarea: () => null
        }))
        jest.unstable_mockModule('../vfs-client.js', () => ({ getFileManager: () => ({ list: () => ['a.py'], read: (n) => 'print(1)' }) }))
        jest.unstable_mockModule('../config.js', () => ({ getConfigIdentity: () => ({ id: 'conf' }) }))
        const snaps = []
        jest.unstable_mockModule('../snapshots.js', () => ({ getSnapshotsForCurrentConfig: () => snaps, saveSnapshotsForCurrentConfig: (s) => { snaps.length = 0; snaps.push(...s) } }))

        // set TabManager global
        window.TabManager = { getActive: () => 'a.py' }

        const mod = await import('../autosave.js')
        const { initializeAutosave } = mod

        initializeAutosave()
        // If CodeMirror is present, the module attaches cm.on('change', ...).
        // Our mocked cm is a plain object; simulate change by calling the handler
        // The module registers cm.on, so we call the stored handler via getCodeMirror mock.
        const editorMod = await import('../editor.js')
        const cm = editorMod.getCodeMirror()
        if (cm && typeof cm._changeHandler === 'function') cm._changeHandler()
        jest.runAllTimers()
        await Promise.resolve()
        const cur = snaps.find(s => s.id === '__current__')
        expect(cur).toBeDefined()
        // autosave-indicator should show path
        const ind = document.getElementById('autosave-indicator')
        expect(ind.textContent).toContain('a.py')
    })
})
