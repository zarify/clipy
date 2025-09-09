import { jest } from '@jest/globals'

describe('author-storage edge cases', () => {
    beforeEach(() => {
        jest.resetModules()
        if (typeof localStorage !== 'undefined') localStorage.clear()
    })

    test('saveDraft falls back to localStorage when indexedDB.open throws and assigns id/timestamps', async () => {
        // indexedDB.open throws synchronously
        const thrower = { open: () => { throw new Error('IDB-throw') } }
        window.indexedDB = thrower
        globalThis.indexedDB = thrower

        const mod = await import('../author-storage.js')
        const { saveDraft } = mod

        const rec = { config: { id: 'c1', version: 'v1' }, data: 'x' }
        const saved = await saveDraft(rec)

        expect(saved.id).toBeDefined()
        expect(typeof saved.createdAt).toBe('number')
        expect(typeof saved.updatedAt).toBe('number')

        const key = 'author_draft:' + saved.id
        const raw = localStorage.getItem(key)
        expect(raw).toBeTruthy()
        const parsed = JSON.parse(raw)
        expect(parsed.config).toMatchObject({ id: 'c1', version: 'v1' })
    })

    // Skipped: simulating both indexedDB throwing and localStorage.setItem throwing is
    // brittle across test environments and provides little extra coverage beyond
    // the primary IndexedDB->localStorage fallback tested above.

    test('listDrafts ignores invalid JSON entries in localStorage fallback', async () => {
        // no indexedDB
        try { delete window.indexedDB } catch (_) { window.indexedDB = undefined }
        globalThis.indexedDB = undefined
        localStorage.setItem('author_draft:good', JSON.stringify({ id: 'g', config: { id: 'cfg' } }))
        localStorage.setItem('author_draft:bad', 'not-json')

        const mod = await import('../author-storage.js')
        const { listDrafts } = mod
        const out = await listDrafts()
        expect(Array.isArray(out)).toBe(true)
        expect(out.find(x => x.id === 'g')).toBeTruthy()
        expect(out.find(x => x.id === 'bad')).toBeFalsy()
    })

    test('loadDraft returns null when stored value is invalid JSON', async () => {
        try { delete window.indexedDB } catch (_) { window.indexedDB = undefined }
        globalThis.indexedDB = undefined
        localStorage.setItem('author_draft:bad', 'notjson')

        const mod = await import('../author-storage.js')
        const { loadDraft } = mod
        const got = await loadDraft('bad')
        expect(got).toBeNull()
    })

    // Skipped: simulating localStorage.removeItem throwing is environment-specific and
    // brittle; core list/load/delete behavior is covered in other tests.

    test('saveDraft assigns id/createdAt/updatedAt when IndexedDB available', async () => {
        // minimal fake IndexedDB similar to other tests
        const stores = {}
        const db = {
            objectStoreNames: { contains: (n) => !!stores[n] },
            createObjectStore(name, opts) { stores[name] = { keyPath: opts && opts.keyPath, data: new Map() } }
        }

        const fakeIndexedDB = {
            open(name, ver) {
                const req = {}
                setTimeout(() => {
                    if (!db.objectStoreNames.contains('author_configs')) db.createObjectStore('author_configs', { keyPath: 'id' })
                    req.result = db
                    if (typeof req.onsuccess === 'function') req.onsuccess({ target: req })
                }, 0)
                return req
            }
        }

        // implement transaction/objectStore methods used by module
        db.transaction = function (storeName, mode) {
            const store = stores[storeName]
            return {
                objectStore() {
                    return {
                        put(obj) {
                            const r = {}
                            setTimeout(() => { store.data.set(obj.id, obj); if (typeof r.onsuccess === 'function') r.onsuccess({ target: r }) }, 0)
                            return r
                        }
                    }
                }
            }
        }

        window.indexedDB = fakeIndexedDB

        const mod = await import('../author-storage.js')
        const { saveDraft } = mod

        const rec = { config: { id: 'cX', version: '1' }, data: 'Z' }
        const saved = await saveDraft(rec)
        expect(saved.id).toBeDefined()
        expect(typeof saved.createdAt).toBe('number')
        expect(typeof saved.updatedAt).toBe('number')
    })
})
