// Worker module: loads vendored MicroPython and runs code off-main-thread.
// Listens for messages: {type:'init', sab}, {type:'send', text}, {type:'run', code}

importScripts();

let mp = null
let stdinQueue = []
let sab = null
let sabView = null

function postStdout(text){self.postMessage({type:'stdout', text})}
function postStderr(text){self.postMessage({type:'stderr', text})}
function postStatus(text){self.postMessage({type:'status', text})}

async function initRuntime(options={}){
  const td = new TextDecoder()
  // import the vendored micropython module dynamically
  try{
    // use import() to load the ESM; in workers importScripts isn't available for modules, so use import()
    const mod = await import('../src/vendor/micropython.mjs')
    if(!mod.loadMicroPython) throw new Error('loadMicroPython not found in vendored module')

    mp = await mod.loadMicroPython({
      stdin: workerStdin,
      stdout: (c)=>{
        if(c instanceof Uint8Array) postStdout(td.decode(c))
        else postStdout(String(c))
      },
      stderr: (c)=>{
        if(c instanceof Uint8Array) postStderr(td.decode(c))
        else postStderr(String(c))
      },
      url: '../src/vendor/micropython.wasm',
      linebuffer: true
    })

    postStatus('Runtime initialized')
    self.postMessage({type:'ready'})
  }catch(e){
    postStatus('init failed: ' + String(e))
  }
}

function workerStdin(){
  // return single byte (number) or null for EOF behavior
  if(stdinQueue.length) return stdinQueue.shift().charCodeAt(0)
  // if SAB is present, block on Atomics.wait until main thread posts data
  if(sabView){
    postStatus('worker: waiting for input via Atomics.wait')
    // 0 means no data; main thread will set 1 and put a single byte into queue
    Atomics.wait(sabView, 0, 0)
    // after wake, check queue again
    if(stdinQueue.length) return stdinQueue.shift().charCodeAt(0)
    return null
  }
  // no SAB, return null (EOF)
  return null
}

self.onmessage = async (ev)=>{
  const msg = ev.data
  if(msg.type === 'init'){
    if(msg.sab){ sab = msg.sab; sabView = new Int32Array(sab) }
    postStatus('worker: init received; sab=' + (sab? 'yes':'no'))
    await initRuntime()
  }else if(msg.type === 'send'){
    // enqueue text and wake worker if possible
    stdinQueue.push(...msg.text.split(''))
    postStatus('worker: queued ' + JSON.stringify(msg.text))
    if(sabView){
      // set flag to 1 and notify
      Atomics.store(sabView, 0, 1)
      Atomics.notify(sabView, 0, 1)
    }
  }else if(msg.type === 'run'){
    if(!mp) return postStatus('worker: runtime not ready')
    postStatus('worker: running program')
    try{
      if(typeof mp.runPythonAsync === 'function'){
        const p = mp.runPythonAsync(msg.code)
        // await the promise to completion
        if(p && typeof p.then === 'function') await p
      }else if(typeof mp.runPython === 'function'){
        mp.runPython(msg.code)
      }else postStatus('worker: no runPython API')
      postStatus('worker: program finished')
    }catch(e){ postStderr('runtime error: ' + String(e)) }
  }
}
