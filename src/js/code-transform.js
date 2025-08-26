// Code transformation and wrapping utilities
import { transformWalrusPatterns, normalizeIndentation } from './utils.js'

// Helper function to safely replace input() calls with await host.get_input() calls
// Uses tokenizer-aware replacement to skip strings and comments
function safeReplaceInput(src) {
    let out = ''
    const N = src.length
    let i = 0
    let state = 'normal' // normal | single | double | tri-single | tri-double | comment

    while (i < N) {
        // detect triple-quoted strings first
        if (state === 'normal') {
            // line comment
            if (src[i] === '#') {
                // copy until newline or end
                const j = src.indexOf('\n', i)
                if (j === -1) {
                    out += src.slice(i)
                    break
                }
                out += src.slice(i, j + 1)
                i = j + 1
                continue
            }

            // triple single
            if (src.startsWith("'''", i)) {
                state = 'tri-single'
                out += "'''"
                i += 3
                continue
            }

            // triple double
            if (src.startsWith('"""', i)) {
                state = 'tri-double'
                out += '"""'
                i += 3
                continue
            }

            // single-quote
            if (src[i] === "'") {
                state = 'single'
                out += src[i++]
                continue
            }

            // double-quote
            if (src[i] === '"') {
                state = 'double'
                out += src[i++]
                continue
            }

            // detect identifier 'input' with word boundary and a following '('
            if (src.startsWith('input', i) && (i === 0 || !(/[A-Za-z0-9_]/.test(src[i - 1])))) {
                // lookahead for optional whitespace then '('
                let j = i + 5
                while (j < N && /\s/.test(src[j])) j++
                if (j < N && src[j] === '(') {
                    out += 'await host.get_input'
                    i += 5
                    continue
                }
            }

            // default: copy char
            out += src[i++]
        } else if (state === 'single') {
            // inside single-quoted string
            if (src[i] === '\\') {
                out += src.substr(i, 2)
                i += 2
                continue
            }
            if (src[i] === "'") {
                state = 'normal'
                out += src[i++]
                continue
            }
            out += src[i++]
        } else if (state === 'double') {
            if (src[i] === '\\') {
                out += src.substr(i, 2)
                i += 2
                continue
            }
            if (src[i] === '"') {
                state = 'normal'
                out += src[i++]
                continue
            }
            out += src[i++]
        } else if (state === 'tri-single') {
            if (src.startsWith("'''", i)) {
                state = 'normal'
                out += "'''"
                i += 3
                continue
            }
            out += src[i++]
        } else if (state === 'tri-double') {
            if (src.startsWith('"""', i)) {
                state = 'normal'
                out += '"""'
                i += 3
                continue
            }
            out += src[i++]
        } else {
            // unknown state fallback
            out += src[i++]
        }
    }
    return out
}

// Helper: transform user source by replacing input(...) with await host.get_input(...)
// and wrap in an async runner. Returns {code: wrappedCode, headerLines}
export function transformAndWrap(userCode) {
    // First handle walrus patterns
    const processedCode = transformWalrusPatterns(userCode)

    // Then replace input() calls
    const replaced = safeReplaceInput(processedCode)

    const headerLinesArr = [
        'import host',
        '# Asyncio compatibility wrapper: prefer asyncio.run or uasyncio.run, fallback to get_event_loop().run_until_complete',
        'try:',
        "    import asyncio as _asyncio",
        "    _run = getattr(_asyncio, 'run', None)",
        "except Exception:",
        "    _asyncio = None\n    _run = None",
        "# prefer uasyncio.run if available (MicroPython often exposes this)",
        "try:",
        "    import uasyncio as _ua",
        "    if _run is None:",
        "        _run = getattr(_ua, 'run', None)",
        "except Exception:",
        "    _ua = None",
        "# fallback: use asyncio.get_event_loop().run_until_complete if present",
        "if _run is None and _asyncio is not None:",
        "    try:",
        "        _loop = _asyncio.get_event_loop()",
        "        if hasattr(_loop, 'run_until_complete'):",
        "            def _run(coro): _loop.run_until_complete(coro)",
        "    except Exception:",
        "        _run = None",
        "",
        "async def __ssg_main():"
    ]

    const indent = (line) => '    ' + line

    // Normalize and indent the user code
    const body = normalizeIndentation(replaced).split('\n').map(indent).join('\n')

    const footer = `if _run is None:\n    raise ImportError('no async runner available')\n_run(__ssg_main())`
    const full = headerLinesArr.join('\n') + '\n' + body + '\n' + footer

    return { code: full, headerLines: headerLinesArr.length }
}

// Map and display tracebacks that originate in transformed code back to user source
export function mapTracebackAndShow(rawText, headerLines, userCode, appendTerminal) {
    if (!rawText) return

    // Replace occurrences like: File "<stdin>", line N[, column C]
    const mapped = rawText.replace(/File \"([^\"]+)\", line (\d+)(?:, column (\d+))?/g, (m, fname, ln, col) => {
        const mappedLn = Math.max(1, Number(ln) - headerLines)
        if (col) return `File "${fname}", line ${mappedLn}, column ${col}`
        return `File "${fname}", line ${mappedLn}`
    })

    appendTerminal(mapped, 'stderr')
    appendTerminalDebug('[mapped traceback]')
    appendTerminalDebug(mapped)

    // Optionally show small source context for first mapped line
    const m = mapped.match(/line (\d+)/)
    if (m) {
        const errLine = Math.max(1, Number(m[1]))
        const userLines = userCode.split('\n')
        const contextStart = Math.max(0, errLine - 3)
        appendTerminalDebug('--- source context (student code) ---')
        for (let i = contextStart; i < Math.min(userLines.length, errLine + 2); i++) {
            const prefix = (i + 1 === errLine) ? '-> ' : '   '
            appendTerminalDebug(prefix + String(i + 1).padStart(3, ' ') + ': ' + userLines[i])
        }
    }
}
