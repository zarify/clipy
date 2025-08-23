import { loadMicroPython } from '../src/vendor/micropython.mjs';

const out = document.getElementById('term');
const log = (s)=>{out.textContent += s + '\n'; out.scrollTop = out.scrollHeight};

let MP = null;
let resolveInput = null;
let stderrBuffer = [];

function stdout(s){ log('[py] ' + s); }
function stderr(s){ stderrBuffer.push(s); log('[py] err: ' + s); }

function registerHostModule(Module){
  // Expose host.get_input() which returns a Promise resolved by UI
  const host = {
    get_input: () => {
      return new Promise(resolve => { resolveInput = resolve; });
    }
  };
  Module.registerJsModule('host', host);
  log('[js] host module registered');
}

async function runTest(){
  log('[js] loading runtime...');
  MP = await loadMicroPython({ url: '../src/vendor/micropython.wasm', stdout:stdout, stderr:stderr });
  log('[js] runtime loaded');
  registerHostModule(MP);

  function transformAndWrap(userCode){
    // Replace input(...) with await host.get_input(...)
    const replaced = userCode.replace(/\binput\s*\(/g, 'await host.get_input(');
    const indented = replaced.split('\n').map(line => '    '+line).join('\n');
    const header = `# Try to import asyncio, falling back to uasyncio if present\ntry:\n    import asyncio\nexcept Exception:\n    try:\n        import uasyncio as asyncio\n    except Exception:\n        asyncio = None\n\n# Ensure host module is available\ntry:\n    import host\nexcept Exception:\n    pass\n\nasync def __user_main():\n`;
    const footer = `\nif asyncio is None:\n    print('No asyncio/uasyncio available')\nelse:\n    try:\n        asyncio.run(__user_main())\n    except Exception:\n        try:\n            loop = asyncio.get_event_loop()\n            try:\n                loop.run_until_complete(__user_main())\n            except AttributeError:\n                try:\n                    loop.create_task(__user_main())\n                    if hasattr(loop, 'run_forever'):\n                        loop.run_forever()\n                    elif hasattr(loop, 'run'):\n                        loop.run()\n                    else:\n                        print('Could not run asyncio: no run/run_forever available on loop')\n                except Exception as e:\n                    print('Could not run asyncio:', e)\n        except Exception as e:\n            print('Could not run asyncio:', e)\n`;
    const runner = header + indented + footer;
    // compute headerLines: lines before the user's first line
    const headerLines = header.split('\n').length;
    return { code: runner, headerLines };
  }

  // Example: run a plain input() script (could be replaced with editor content)
  const userCode = "print('Please enter your name:')\nname = input()\nprint('Hello '+name)\n";
  const { code, headerLines } = transformAndWrap(userCode);
  // clear stderr buffer for this run
  stderrBuffer = [];

  log('[js] running async python...');
  try{
    const r = await MP.runPythonAsync(code);
    log('[js] runPythonAsync returned: ' + String(r));
  }catch(e){
    log('[js] run error: ' + e);
  }

  // Post-process stderr tracebacks to remap line numbers back to user source
  if(stderrBuffer.length){
    const tb = stderrBuffer.join('\n');
    const userLines = userCode.split('\n');
    // Replace occurrences like: File "<stdin>", line N
    const mapped = tb.replace(/File "([^"]+)", line (\d+)/g, (m, fname, n)=>{
      const nn = Math.max(1, Number(n) - headerLines);
      return `File "${fname}", line ${nn}`;
    });
    log('[py mapped traceback]');
    log(mapped);

    // show a small source context for the first reported line if available
    const m = mapped.match(/line (\d+)/);
    if(m){
      const errLine = Math.max(1, Number(m[1]));
      const contextStart = Math.max(0, errLine-3);
      log('--- source context (student code) ---');
      for(let i=contextStart;i<Math.min(userLines.length, errLine+2);i++){
        const prefix = (i+1===errLine)?'-> ':'   ';
        log(prefix + String(i+1).padStart(3,' ') + ': ' + userLines[i]);
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('load').addEventListener('click', ()=>runTest());
  document.getElementById('send').addEventListener('click', ()=>{
    const v = document.getElementById('stdin').value;
    if(!resolveInput){ log('[js] no pending input resolver'); return; }
    resolveInput(v);
    resolveInput = null;
    log('[js] UI sent: ' + v);
  });
});
