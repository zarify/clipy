test('getSnapshotsForCurrentConfig filters by config identity', async () => {
    const mod = await import('../snapshots.js')
    const cfg = await import('../config.js')
    const { setCurrentConfig, getConfigIdentity } = cfg

    setCurrentConfig({ id: 'alpha', version: '1.0' })
    const identity = getConfigIdentity()
    const key = `snapshots_${identity}`

    const snaps = [
        { ts: 1, config: identity, files: { '/a.py': 'A' } },
        { ts: 2, config: { id: 'alpha', version: '1.0' }, files: { '/b.py': 'B' } },
        { ts: 3, config: 'other@1.0', files: { '/c.py': 'C' } }
    ]

    localStorage.setItem(key, JSON.stringify(snaps))

    const got = mod.getSnapshotsForCurrentConfig()
    expect(got.length).toBe(2)
    const ids = got.map(s => s.ts).sort()
    expect(ids).toEqual([1, 2])
})

test('saveSnapshotsForCurrentConfig persists snapshots to localStorage', async () => {
    const mod = await import('../snapshots.js')
    const cfg = await import('../config.js')
    const { setCurrentConfig, getConfigIdentity } = cfg

    setCurrentConfig({ id: 'saveTest', version: '1.0' })
    const identity = getConfigIdentity()
    const key = `snapshots_${identity}`

    // ensure empty
    localStorage.removeItem(key)
    const data = [{ ts: 10, config: identity, files: { '/x.py': 'X' } }]
    mod.saveSnapshotsForCurrentConfig(data)

    const raw = localStorage.getItem(key)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(parsed.length).toBe(1)
    expect(parsed[0].ts).toBe(10)
})

import { setupTerminalDOM, setMAIN_FILE, ensureAppendTerminalDebug, clearLocalStorageMirror } from './test-utils/test-setup.js'

test('renderSnapshots updates DOM lists and summaries', async () => {
    const snapshots = await import('../snapshots.js')
    const cfg = await import('../config.js')
    const { setCurrentConfig, getConfigIdentity } = cfg

    // polyfill TextEncoder if needed
    if (typeof global.TextEncoder === 'undefined') {
        const { TextEncoder, TextDecoder } = await import('util')
        global.TextEncoder = TextEncoder
        global.TextDecoder = TextDecoder
    }

    setCurrentConfig({ id: 'renderTest', version: '1.0' })
    const identity = getConfigIdentity()
    const key = `snapshots_${identity}`

    const snap = { ts: Date.now(), config: identity, files: { '/a.py': 'A', '/b.py': 'B' } }

    localStorage.setItem(key, JSON.stringify([snap]))

    // Set up DOM containers
    document.body.innerHTML = `
        <div id="snapshot-list"></div>
        <div id="snapshot-storage-summary"></div>
        <div id="snapshot-storage-summary-header"></div>
    `

    snapshots.renderSnapshots()

    const list = document.getElementById('snapshot-list')
    expect(list.children.length).toBeGreaterThan(0)
    const footer = document.getElementById('snapshot-storage-summary')
    expect(footer.textContent).toMatch(/snapshot/)
    const hdr = document.getElementById('snapshot-storage-summary-header')
    expect(hdr.textContent).toMatch(/snaps/) // header summary
})

test('restoreSnapshot writes files to backend and updates mem/localStorage', async () => {
    const snapshots = await import('../snapshots.js')
    const cfg = await import('../config.js')
    const { setCurrentConfig, getConfigIdentity } = cfg
    const vfs = await import('../vfs-client.js')
    const { MAIN_FILE } = vfs

    setCurrentConfig({ id: 'restoreTest', version: '1.0' })
    const identity = getConfigIdentity()

    const snap = { ts: Date.now(), config: identity, files: { '/a.txt': 'A', [MAIN_FILE]: 'MAIN' } }

    // Setup fake backend
    const writes = []
    const backend = {
        write: async (path, content) => { writes.push([path, content]) },
        clear: async () => { writes.length = 0 },
        list: async () => [],
        delete: async () => { }
    }
    window.__ssg_vfs_backend = backend

    // Setup mem and vfs_ready
    window.__ssg_mem = {}
    window.__ssg_vfs_ready = Promise.resolve({ mem: window.__ssg_mem })

    // FileManager mock to test reconciliation
    const fmWrites = []
    const fmDeletes = []
    window.FileManager = {
        list: () => ['/old.txt', MAIN_FILE],
        delete: async (p) => { fmDeletes.push(p) },
        write: async (p, c) => { fmWrites.push([p, c]) }
    }

    // TabManager stub
    window.TabManager = {
        openTab: () => { },
        selectTab: () => { }
    }

    // Ensure any existing ssg_files_v1 is cleared
    clearLocalStorageMirror()

    // Ensure global MAIN_FILE is set so mapping logic can detect it
    setMAIN_FILE(MAIN_FILE)

    await snapshots.restoreSnapshot(0, [snap], true)

    // wait for the delayed restore flag (setTimeout 100ms)
    await new Promise(r => setTimeout(r, 200))

    // backend should have received a write for /a.txt
    expect(writes.some(w => w[0] === '/a.txt' && w[1] === 'A')).toBeTruthy()

    // mem should now contain /a.txt
    expect(window.__ssg_mem['/a.txt']).toBe('A')

    // localStorage mirror should be updated (ssg_files_v1)
    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
    expect(map['/a.txt']).toBe('A')

    // restore flag should be set
    expect(window.__ssg_last_snapshot_restore).toBeTruthy()
})
