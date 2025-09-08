import { clearLocalStorageMirror, setupCodeArea, ensureAppendTerminalDebug } from './test-utils/test-setup.js'

test('initializeVFS uses IndexedDB backend when available and migrates local files', async () => {
    clearLocalStorageMirror()
    setupCodeArea()
    ensureAppendTerminalDebug()

    // Pre-populate local files that should be migrated
    const pre = { '/pre-idb.txt': 'IDB_PRE', '/main.py': 'EXISTING MAIN' }
    localStorage.setItem('ssg_files_v1', JSON.stringify(pre))

    // Simple in-memory fake indexedDB implementation (mirrors the one used elsewhere)
    function makeFakeIDB() {
        const stores = new Map()

        const db = {
            objectStoreNames: {
                contains: (name) => stores.has(name)
            },
            createObjectStore: (name) => { stores.set(name, new Map()) },
            transaction: (storeName, mode) => ({
                objectStore: () => {
                    const store = stores.get(storeName) || new Map()
                    function makeReq(result) {
                        const req = {}
                        req.onsuccess = null
                        req.onerror = null
                        setTimeout(() => { req.result = result; if (typeof req.onsuccess === 'function') req.onsuccess() }, 0)
                        return req
                    }
                    return {
                        getAllKeys: () => makeReq(Array.from(store.keys())),
                        get: (key) => makeReq(store.has(key) ? { path: key, content: store.get(key) } : undefined),
                        put: (rec) => { store.set(rec.path, rec.content); return makeReq(undefined) },
                        delete: (key) => { store.delete(key); return makeReq(undefined) }
                    }
                }
            })
        }

        return {
            open: (name, version) => {
                const req = {}
                req.onupgradeneeded = null
                req.onsuccess = null
                req.onerror = null
                req.result = db
                setTimeout(() => {
                    if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded()
                    if (typeof req.onsuccess === 'function') req.onsuccess()
                }, 0)
                return req
            }
        }
    }

    const originalIDB = window.indexedDB
    try {
        window.indexedDB = makeFakeIDB()

        const mod = await import('../vfs-client.js')
        const { initializeVFS, getBackendRef, getMem, getFileManager } = mod

        const res = await initializeVFS({ starter: '# starter' })
        expect(res).toHaveProperty('FileManager')

        const backend = getBackendRef()
        expect(backend).not.toBeNull()
        expect(typeof backend.read).toBe('function')

        const mem = getMem()
        expect(mem).toBeTruthy()
        expect(mem['/pre-idb.txt']).toBe('IDB_PRE')

        const fm = getFileManager()
        const list = fm.list()
        expect(list).toContain('/pre-idb.txt')

        // Writing via FileManager should be persisted in the backend
        await fm.write('/idb-new.txt', 'IDB_NEW')
        const newContent = await backend.read('/idb-new.txt')
        expect(newContent).toBe('IDB_NEW')

    } finally {
        window.indexedDB = originalIDB
    }
})
