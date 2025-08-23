// Worker module to run MicroPython off-main-thread.
// It accepts messages:
// - {type: 'init', sab?: SharedArrayBuffer}
// - {type: 'run', code: string}
// - {type: 'send', text: string}

let mp = null
let stdinQueue = []
let sab = null
let sabView = null

function postStdout(text){ self.postMessage({type:'stdout', text}) }
function postStderr(text){ self.postMessage({type:'stderr', text}) }
function postStatus(text){ self.postMessage({type:'status', text}) }

async function initRuntime(){
  try{
    const mod = await import('./vendor/micropython.mjs')
    if(!mod.loadMicroPython) throw new Error('loadMicroPython not found in vendored module')
    const td = new TextDecoder()
    mp = await mod.loadMicroPython({
      stdin: workerStdin,
      stdout: (c) => { if(c instanceof Uint8Array) postStdout(td.decode(c)); else postStdout(String(c)) },
      stderr: (c) => { if(c instanceof Uint8Array) postStderr(td.decode(c)); else postStderr(String(c)) },
      url: './vendor/micropython.wasm',
      linebuffer: true
    })
    postStatus('worker: runtime initialized')
    self.postMessage({type:'ready'})
  }catch(e){ postStatus('worker: init failed: ' + String(e)) }
}

function workerStdin(){
  if(stdinQueue.length) return stdinQueue.shift().charCodeAt(0)
  if(sabView){
    postStatus('worker: waiting for input via Atomics.wait')
    Atomics.wait(sabView, 0, 0)
    // After wake, reset flag and read from queue
    Atomics.store(sabView, 0, 0)
    if(stdinQueue.length) return stdinQueue.shift().charCodeAt(0)
    return null
  }
  return null
}

self.onmessage = async (ev) => {
  const msg = ev.data
  if(msg.type === 'init'){
    if(msg.sab){ sab = msg.sab; sabView = new Int32Array(sab) }
    postStatus('worker: init')
    await initRuntime()
  }else if(msg.type === 'send'){
    stdinQueue.push(...msg.text.split(''))
    postStatus('worker: queued ' + JSON.stringify(msg.text))
    if(sabView){ Atomics.store(sabView, 0, 1); Atomics.notify(sabView, 0, 1) }
  }else if(msg.type === 'run'){
    if(!mp) return postStatus('worker: runtime not ready')
    postStatus('worker: running program')
    try{
      if(typeof mp.runPythonAsync === 'function'){
        const p = mp.runPythonAsync(msg.code)
        if(p && typeof p.then === 'function') await p
      }else if(typeof mp.runPython === 'function'){
        mp.runPython(msg.code)
      }else postStatus('worker: no run API')
      postStatus('worker: finished')
    }catch(e){ postStderr('worker runtime error: ' + String(e)) }
  }
}
