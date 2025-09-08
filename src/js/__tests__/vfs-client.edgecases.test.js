import { clearLocalStorageMirror, setupCodeArea, ensureAppendTerminalDebug } from './test-utils/test-setup.js'

test('initializeVFS tolerates per-file backend read errors and sets mem entry to null', async () => {
    clearLocalStorageMirror()
    setupCodeArea()
    ensureAppendTerminalDebug()

    // Pre-populate with one good file and one that will trigger a read error
    const pre = { '/good.txt': 'GOOD', '/bad.txt': 'BAD' }
    localStorage.setItem('ssg_files_v1', JSON.stringify(pre))

    // Fake IDB which errors on reads for '/bad.txt'
    function makeFaultyIDB() {
        const stores = new Map()
        const db = {
            objectStoreNames: { contains: (name) => stores.has(name) },
            createObjectStore: (name) => { stores.set(name, new Map([['/good.txt', 'GOOD'], ['/bad.txt', 'BAD']])) },
            transaction: (storeName, mode) => ({
                objectStore: () => {
                    const store = stores.get(storeName) || new Map()
                    function makeReqSuccess(result) {
                        const req = {}
                        req.onsuccess = null
                        req.onerror = null
                        setTimeout(() => { req.result = result; if (typeof req.onsuccess === 'function') req.onsuccess() }, 0)
                        return req
                    }
                    function makeReqError(err) {
                        const req = {}
                        req.onsuccess = null
                        req.onerror = null
                        setTimeout(() => { req.error = err; if (typeof req.onerror === 'function') req.onerror(err) }, 0)
                        return req
                    }
                    return {
                        getAllKeys: () => makeReqSuccess(Array.from(store.keys())),
                        get: (key) => {
                            // simulate a failing request for '/bad.txt'
                            if (String(key) === '/bad.txt') return makeReqError(new Error('read fail'))
                            return makeReqSuccess(store.has(key) ? { path: key, content: store.get(key) } : undefined)
                        },
                        put: (rec) => { store.set(rec.path, rec.content); return makeReqSuccess(undefined) },
                        delete: (key) => { store.delete(key); return makeReqSuccess(undefined) }
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
        window.indexedDB = makeFaultyIDB()

        const mod = await import('../vfs-client.js')
        const { initializeVFS, getMem } = mod

        await initializeVFS({ starter: '#starter' })

        const mem = getMem()
        expect(Object.prototype.hasOwnProperty.call(mem, '/good.txt')).toBe(true)
        expect(mem['/good.txt']).toBe('GOOD')

        // bad.txt should exist in mem but be null due to read error handling
        expect(Object.prototype.hasOwnProperty.call(mem, '/bad.txt')).toBe(true)
        expect(mem['/bad.txt']).toBeNull()

    } finally {
        window.indexedDB = originalIDB
    }
})

test('backend write rejection propagates from FileManager.write', async () => {
    clearLocalStorageMirror()
    setupCodeArea()
    ensureAppendTerminalDebug()

    // Use normal (fallback) backend by leaving indexedDB undefined
    const mod = await import('../vfs-client.js')
    const { initializeVFS, getBackendRef, getFileManager } = mod

    await initializeVFS({ starter: '#s' })
    const backend = getBackendRef()
    const fm = getFileManager()

    // Replace backend.write to reject for a specific path
    const origWrite = backend.write
    backend.write = async (p, c) => {
        if (p === '/willfail.txt') throw new Error('write fail')
        return origWrite(p, c)
    }

    // Writing via the FileManager should reject when backend.write fails
    await expect(fm.write('/willfail.txt', 'X')).rejects.toThrow('write fail')

    // restore
    backend.write = origWrite
})
