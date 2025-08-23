import * as mpmod from '../src/vendor/micropython.mjs'

const term = id => document.getElementById(id)
const append = (t)=>{ const out=term('terminal'); out.textContent += '\n' + t; out.scrollTop = out.scrollHeight }

let worker = null
let sab = null
let tick = 0

function installUI(){
  term('send').addEventListener('click', ()=>{
    const v = term('input-box').value || ''
    // ensure newline
    if(worker) worker.postMessage({type:'send', text: v + '\n'})
    append('[UI] sent: ' + JSON.stringify(v))
  })

  term('run').addEventListener('click', async ()=>{
    if(!worker) return append('[error] worker not initialized')
    append('[info] starting program (worker)')
    const program = `
print('ready for input')
a = input('A: ')
print('you typed A=>', a)
b = input('B: ')
print('you typed B=>', b)
print('done')
`
    worker.postMessage({type:'run', code: program})
  })

  term('clear').addEventListener('click', ()=> term('terminal').textContent='(terminal)')
}

function startWorker(){
  if(worker) return
  try{ sab = typeof SharedArrayBuffer !== 'undefined' ? new SharedArrayBuffer(4) : null }catch(e){ sab = null }

  worker = new Worker('./interactive_worker.js', { type: 'module' })
  worker.onmessage = (ev)=>{
    const msg = ev.data
    if(msg.type === 'stdout') append('[py] ' + msg.text)
    else if(msg.type === 'stderr') append('[py err] ' + msg.text)
    else if(msg.type === 'status') append('[worker] ' + msg.text)
    else if(msg.type === 'ready') append('[worker] ready')
  }

  // send init including SharedArrayBuffer (if available)
  worker.postMessage({type:'init', sab: sab})
  append('[info] worker spawned' + (sab? ' (SAB available)':' (no SAB)'))
}

// heartbeat to show UI responsiveness
setInterval(()=>{ tick++; term('tick').textContent = 'tick: ' + tick }, 500)

installUI()
startWorker()
append('UI ready — Start program to run inside a Worker; page should stay responsive')
