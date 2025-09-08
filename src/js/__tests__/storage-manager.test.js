test('getStorageUsage empty and populated breakdown', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    // Create a fake storage that stores keys as own properties so `for..in` works
    const storage = {}
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { storage[k] = v }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { } })

    const emptyUsage = mgr.getStorageUsage()
    expect(emptyUsage.totalSize).toBeDefined()
    expect(Number(emptyUsage.totalSize)).toBeGreaterThanOrEqual(0)
    expect(emptyUsage.percentage).toBe(0)
    expect(emptyUsage.isWarning).toBeFalsy()

    // Populate storage with different keys
    storage['snapshots_cfg'] = JSON.stringify([1, 2, 3])
    storage['ssg_files_v1'] = "filecontents"
    storage['autosave'] = "autos"
    storage['other_key'] = "x"

    const usage = mgr.getStorageUsage()
    expect(usage.totalSize).toBeGreaterThan(0)
    expect(usage.breakdown.snapshots).toBeGreaterThan(0)
    expect(usage.breakdown.files).toBeGreaterThan(0)
    expect(usage.breakdown.autosave).toBeGreaterThan(0)
    expect(usage.breakdown.other).toBeGreaterThan(0)
})

test('getAllSnapshotConfigs returns snapshot entries', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    const storage = {}
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { storage[k] = v }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    // Add two snapshot configs
    storage['snapshots_alpha'] = JSON.stringify([{ "ts": 1 }, { "ts": 2 }])
    storage['snapshots_beta'] = JSON.stringify([{ "ts": 3 }])

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { } })
    const configs = mgr.getAllSnapshotConfigs()
    const ids = configs.map(c => c.configId).sort()
    expect(ids).toEqual(['alpha', 'beta'])
    const alpha = configs.find(c => c.configId === 'alpha')
    expect(alpha.snapshotCount).toBe(2)
})

test('cleanupOldSnapshots truncates to 3 most recent', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    const storage = {}
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { storage[k] = v }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    const key = 'snapshots_current'
    // create 5 snapshots with increasing ts
    const snaps = [{ ts: 1 }, { ts: 2 }, { ts: 3 }, { ts: 4 }, { ts: 5 }]
    storage[key] = JSON.stringify(snaps)

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { }, getConfigKey: () => key })
    await mgr._internal.cleanupOldSnapshots()
    const after = JSON.parse(storage.getItem(key) || '[]')
    expect(Array.isArray(after)).toBeTruthy()
    expect(after.length).toBeLessThanOrEqual(3)
    // should keep the highest ts entries (5,4,3)
    expect(after.map(s => s.ts)).toEqual([5, 4, 3])
})

test('cleanupOtherConfigs removes non-current snapshots', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    const storage = {}
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { storage[k] = v }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    storage['snapshots_current'] = JSON.stringify([])
    storage['snapshots_other'] = JSON.stringify([1])
    storage['snapshots_another'] = JSON.stringify([1, 2])

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { }, getConfigKey: () => 'snapshots_current' })
    await mgr._internal.cleanupOtherConfigs()
    expect(storage.getItem('snapshots_other')).toBeNull()
    expect(storage.getItem('snapshots_another')).toBeNull()
    expect(storage.getItem('snapshots_current')).not.toBeNull()
})

test('safeSetItem handles QuotaExceededError and cancel path', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    // storage that always throws quota on setItem
    const storage = {}
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    // showConfirmModal that returns cancel
    const showConfirm = async (title, msg) => 'cancel'

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { }, showConfirmModal: showConfirm })

    const res = await mgr.safeSetItem('k', 'v')
    expect(res.success).toBeFalsy()
})

test('safeSetItem recovers after cleanup when user chooses cleanup-old-snapshots', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    const storage = {}
    let firstFail = true
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { if (firstFail && k === 'k') { firstFail = false; const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err } storage[k] = v }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    // showConfirmModal that returns boolean true so storage-manager maps it to cleanup-old-snapshots
    const showConfirm = async (title, msg) => true

    // Create a manager wired to a config key so cleanupOldSnapshots can run
    const key = 'snapshots_cfg'
    storage[key] = JSON.stringify([{ ts: 1 }, { ts: 2 }, { ts: 3 }, { ts: 4 }])

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { }, showConfirmModal: showConfirm, getConfigKey: () => key })

    const res = await mgr.safeSetItem('k', 'v')
    expect(res.success).toBeTruthy()
    expect(res.recovered).toBeTruthy()
    expect(storage['k']).toBe('v')
})

test('safeSetItem rethrows non-quota error', async () => {
    const mod = await import('../storage-manager.js')
    const { createStorageManager } = mod

    const storage = {}
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { throw new Error('boom') }, enumerable: false })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false })

    const mgr = createStorageManager({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { }, showConfirmModal: async () => 'cancel' })

    expect(() => mgr.safeSetItem('k', 'v')).toThrow(/boom/)
})
