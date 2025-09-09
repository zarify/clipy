test('FileManager.delete protects MAIN_FILE and does not delete it', async () => {
    const mod = await import('../vfs-client.js')
    const { createFileManager, MAIN_FILE } = mod

    const host = { localStorage: { getItem: () => JSON.stringify({ [MAIN_FILE]: 'starter' }), setItem: () => { } } }
    const fm = createFileManager(host)

    // Attempt to delete MAIN_FILE
    await expect(fm.delete(MAIN_FILE)).resolves.toBeUndefined()

    // Ensure MAIN_FILE still present in storage
    const after = JSON.parse(host.localStorage.getItem())
    expect(after[MAIN_FILE]).toBe('starter')
})
