import { clearLocalStorageMirror, setupCodeArea, ensureAppendTerminalDebug } from './test-utils/test-setup.js'

test('initializeVFS migrates existing local files into backend and populates mem', async () => {
    // Ensure clean state and DOM
    clearLocalStorageMirror()
    setupCodeArea()
    ensureAppendTerminalDebug()

    // Pre-populate the localStorage-backed FileManager (simulate pre-existing files)
    const pre = { '/pre.txt': 'PRE', '/main.py': 'EXISTING MAIN' }
    localStorage.setItem('ssg_files_v1', JSON.stringify(pre))

    // Import the vfs client and initialize VFS. The real vfs-backend will fall back
    // to the localStorage backend in a jsdom environment (IndexedDB absent), which
    // lets us validate the migration logic path.
    const mod = await import('../vfs-client.js')
    const { initializeVFS, getMem, getBackendRef, getFileManager } = mod

    const res = await initializeVFS({ starter: '# starter' })
    expect(res).toHaveProperty('FileManager')

    // Backend should be set (localStorage backend returned)
    const backend = getBackendRef()
    expect(backend).not.toBeNull()
    expect(typeof backend.read).toBe('function')

    // mem snapshot should include the pre-populated file
    const mem = getMem()
    expect(mem).toBeTruthy()
    expect(mem['/pre.txt']).toBe('PRE')

    // FileManager should reflect backend-backed API (list includes pre.txt)
    const fm = getFileManager()
    const list = fm.list()
    expect(list).toContain('/pre.txt')

    // Ensure TextDecoder exists (used by waitForFile)
    if (typeof global.TextDecoder === 'undefined') {
        // Node's util provides TextDecoder
        // eslint-disable-next-line node/no-deprecated-api
        const { TextDecoder } = await import('util')
        global.TextDecoder = TextDecoder
    }

    // waitForFile is exposed as a global helper on window
    const found = await window.waitForFile('/pre.txt', 1000)
    expect(found).toBe('PRE')

    // New files written through FileManager should propagate to backend
    await fm.write('/new.txt', 'NEW')
    // backend.read should return it
    const newContent = await backend.read('/new.txt')
    expect(newContent).toBe('NEW')
})
