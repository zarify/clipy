const assert = require('assert')
const { StorageAdapter, InMemoryStorage } = require('../src/js/storage')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  const mem = new InMemoryStorage()
  const sa = new StorageAdapter(mem)

  // autosave
  sa.saveAutosave('hello')
  const a = sa.getAutosave()
  assert(a && a.code === 'hello', 'autosave failed')

  // snapshots
  sa.saveSnapshot('one')
  sa.saveSnapshot('two')
  sa.saveSnapshot('three')
  let snaps = sa.listSnapshots()
  assert(snaps.length === 3, 'snap count')
  assert(snaps[1].code === 'two')

  // delete middle
  sa.deleteSnapshots([1])
  snaps = sa.listSnapshots()
  assert(snaps.length === 2 && snaps[1].code === 'three')

  console.log('OK')
}

run().catch(e => { console.error(e); process.exit(1) })
