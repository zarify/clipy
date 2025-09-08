test('localStorage backend basic CRUD and path normalization', async () => {
    const mod = await import('../vfs-backend.js')
    const { createLocalStorageBackend } = mod

    // Ensure clean localStorage key space (backend uses LS_KEY 'ssg_files_v1')
    localStorage.removeItem('ssg_files_v1')

    const backend = createLocalStorageBackend()
    // initially empty
    expect(await backend.list()).toEqual([])

    // write with and without leading slash
    await backend.write('foo.txt', 'hello')
    await backend.write('/dir/bar.txt', 'world')

    const list = await backend.list()
    expect(list).toContain('/foo.txt')
    expect(list).toContain('/dir/bar.txt')

    expect(await backend.read('/foo.txt')).toBe('hello')
    expect(await backend.read('dir/bar.txt')).toBe('world')

    // delete a file
    await backend.delete('/foo.txt')
    expect(await backend.read('/foo.txt')).toBeNull()
    const listAfterDelete = await backend.list()
    expect(listAfterDelete).not.toContain('/foo.txt')

    // invalid path traversal should reject
    await expect(backend.write('../etc', 'x')).rejects.toThrow(/path traversal/i)
})


test('edge cases: large content, object content, and error handling in mount/sync', async () => {
    const mod = await import('../vfs-backend.js')
    const { createLocalStorageBackend } = mod

    localStorage.removeItem('ssg_files_v1')
    const backend = createLocalStorageBackend()

    // large content
    const large = 'x'.repeat(200000) // 200 KB
    await backend.write('/big.bin', large)
    expect((await backend.read('/big.bin')).length).toBe(200000)

    // write object content (non-string) - should be stored as-is by the backend
    const obj = { foo: 'bar', n: 42 }
    await backend.write('/obj.json', JSON.stringify(obj))
    expect(await backend.read('/obj.json')).toBe(JSON.stringify(obj))

    // mount: FS.writeFile throws for one file, ensure mount continues
    await backend.write('/ok.txt', 'OK')
    await backend.write('/bad.txt', 'BAD')

    const writes = []
    const FS_mount_err = {
        writeFile: (path, content) => {
            if (path === '/bad.txt') throw new Error('write fail')
            writes.push([path, content])
        },
        mkdir: (p) => { }
    }

    // Should not throw
    await backend.mountToEmscripten(FS_mount_err)
    expect(writes).toEqual(expect.arrayContaining([['/ok.txt', 'OK']]))

    // sync: FS.readFile throws for one path, should continue and write others
    const FS_sync_err = {
        _listFiles: () => ['/ok-sync.txt', '/bad-sync.txt'],
        readFile: (p, opts) => {
            if (p === '/bad-sync.txt') throw new Error('read fail')
            if (p === '/ok-sync.txt') return 'SYNC'
            return null
        }
    }

    // Should not throw
    await backend.syncFromEmscripten(FS_sync_err)
    expect(await backend.read('/ok-sync.txt')).toBe('SYNC')
    // bad-sync should be absent or null
    const bad = await backend.read('/bad-sync.txt')
    expect(bad === null || typeof bad === 'undefined').toBe(true)
})


test('mountToEmscripten writes files to provided FS and syncFromEmscripten reads FS', async () => {
    const mod = await import('../vfs-backend.js')
    const { createLocalStorageBackend } = mod

    localStorage.removeItem('ssg_files_v1')
    const backend = createLocalStorageBackend()

    // seed backend
    await backend.write('/a.txt', 'A')
    await backend.write('/sub/b.txt', 'B')

    // FS mock for mount: capture writes and mkdirs
    const writes = []
    const mkdirs = []
    const FS_mount = {
        writeFile: (path, content) => { writes.push([path, content]) },
        mkdir: (p) => { mkdirs.push(p) }
    }

    await backend.mountToEmscripten(FS_mount)

    // expect writeFile called for both files
    expect(writes).toEqual(expect.arrayContaining([['/a.txt', 'A'], ['/sub/b.txt', 'B']]))

    // Now test syncFromEmscripten: create an FS with _listFiles and readFile
    const FS_sync = {
        _listFiles: () => ['/x.txt', '/y/z.txt'],
        readFile: (p, opts) => {
            if (p === '/x.txt') return 'X'
            if (p === '/y/z.txt') return 'Z'
            return null
        }
    }

    await backend.syncFromEmscripten(FS_sync)
    // After sync, backend should have these files
    expect(await backend.read('/x.txt')).toBe('X')
    expect(await backend.read('/y/z.txt')).toBe('Z')
})


test('init falls back to localStorage when IndexedDB unavailable', async () => {
    const mod = await import('../vfs-backend.js')
    const { init } = mod

    // Ensure window.indexedDB is undefined to force fallback
    const originalIDB = window.indexedDB
    try {
        delete window.indexedDB
    } catch (_e) {
        window.indexedDB = undefined
    }

    const backend = await init()
    // backend should implement basic methods
    expect(typeof backend.list).toBe('function')
    expect(typeof backend.read).toBe('function')
    expect(typeof backend.write).toBe('function')
    expect(typeof backend.delete).toBe('function')

    // restore
    window.indexedDB = originalIDB
})
