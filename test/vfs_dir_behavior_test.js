(async function(){
  const mod = await import('../src/lib/vfs.js')
  const { createLocalStorageBackend } = mod

  // mock localStorage in Node
  if(typeof globalThis.localStorage === 'undefined'){
    let store = {}
    globalThis.localStorage = {
      getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null },
      setItem(k,v){ store[k] = String(v) },
      removeItem(k){ delete store[k] }
    }
  }

  const backend = createLocalStorageBackend()

  console.log('vfs_dir_behavior_test: sync nested files from FS')
  // fake FS with nested dirs
  const fakeFS = {
    _files: {
      '/top.txt': 'TOP',
      '/dir1/file1.txt': 'F1',
      '/dir1/sub/file2.txt': 'F2'
    },
    _listFiles(){ return Object.keys(this._files) },
    readFile(path, opts){ return this._files[path] },
    writeFile(path, content){ this._files[path] = content },
    readdir(root){
      // simplistic readdir: return entries for root only
      if(root === '/') return ['top.txt', 'dir1']
      if(root === '/dir1') return ['file1.txt', 'sub']
      if(root === '/dir1/sub') return ['file2.txt']
      return []
    },
    isDir(path){ return !!(path === '/dir1' || path === '/dir1/sub') }
  }

  // sync FS -> backend
  await backend.syncFromEmscripten(fakeFS)
  const list = await backend.list()
  if(!list.includes('/top.txt')) throw new Error('missing /top.txt')
  if(!list.includes('/dir1/file1.txt')) throw new Error('missing /dir1/file1.txt')
  if(!list.includes('/dir1/sub/file2.txt')) throw new Error('missing /dir1/sub/file2.txt')
  if((await backend.read('/dir1/sub/file2.txt')) !== 'F2') throw new Error('content mismatch for nested file')

  console.log('vfs_dir_behavior_test: mount nested files into FS')
  // create empty FS and mount
  const targetFS = { _files: {}, writeFile(path, content){ this._files[path]=content }, readFile(path){ return this._files[path] }, mkdir(path){ /* ignore */ } }
  await backend.mountToEmscripten(targetFS)
  if(targetFS.readFile('/top.txt') !== 'TOP') throw new Error('mount top.txt failed')
  if(targetFS.readFile('/dir1/file1.txt') !== 'F1') throw new Error('mount file1 failed')

  console.log('vfs_dir_behavior_test: path traversal rejection')
  let threw = false
  try{ await backend.write('../evil.txt', 'x') }catch(e){ threw = true }
  if(!threw) throw new Error('expected path traversal rejection')

  console.log('All nested directory VFS tests passed')
})().catch(e=>{ console.error(e); process.exit(1) })
