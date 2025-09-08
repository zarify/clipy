(async function () {
  // Simple test runner for VFS
  const path = '../src/js/vfs-backend.js'
  const mod = await import(path)
  const { createLocalStorageBackend } = mod

  // Provide a simple global localStorage mock for Node
  if (typeof globalThis.localStorage === 'undefined') {
    let store = {}
    globalThis.localStorage = {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null },
      setItem(k, v) { store[k] = String(v) },
      removeItem(k) { delete store[k] }
    }
  }

  const backend = createLocalStorageBackend()

  console.log('vfs_test: write/read/delete/list...')
  await backend.write('/hello.txt', 'world')
  const v = await backend.read('/hello.txt')
  if (v !== 'world') throw new Error('read mismatch')
  const list1 = await backend.list()
  if (!list1.includes('/hello.txt')) throw new Error('list missing')
  await backend.delete('/hello.txt')
  const v2 = await backend.read('/hello.txt')
  if (v2 !== null) throw new Error('delete failed')

  console.log('vfs_test: mountToEmscripten and syncFromEmscripten...')
  // Create a fake FS object
  const fakeFS = {
    _files: {
      '/a.txt': 'A',
      '/b/c.txt': 'C'
    },
    writeFile(path, contents) { this._files[path] = contents },
    readFile(path, opts) { return this._files[path] },
    readdir(root) { return Object.keys(this._files) },
    _listFiles() { return Object.keys(this._files) }
  }

  // write some files to backend and mount
  await backend.write('/a.txt', 'A')
  await backend.write('/b/c.txt', 'C')
  await backend.mountToEmscripten(fakeFS)
  if (fakeFS.readFile('/a.txt') !== 'A') throw new Error('mount a.txt failed')
  if (fakeFS.readFile('/b/c.txt') !== 'C') throw new Error('mount b/c.txt failed')

  // mutate FS and sync back
  fakeFS._files['/a.txt'] = 'A2'
  fakeFS._files['/new.txt'] = 'NEW'
  await backend.syncFromEmscripten(fakeFS)
  const newA = await backend.read('/a.txt')
  const newNew = await backend.read('/new.txt')
  if (newA !== 'A2') throw new Error('sync a.txt failed')
  if (newNew !== 'NEW') throw new Error('sync new.txt failed')

  console.log('All VFS tests passed')
})().catch(e => { console.error(e); process.exit(1) })
