// Minimal fake MicroPython loader for tests
export async function loadMicroPython(opts = {}) {
    const { stdout = () => { }, stderr = () => { }, stdin = null, inputHandler = null } = opts

    // Simple in-memory FS
    const FS = {
        files: {},
        writeFile: function (p, data) { this.files[p] = data },
        readFile: function (p) { return this.files[p] },
        mkdirTree: function (_p) { /* noop */ }
    }

    // Helper to determine number of input prompts in a code string
    function countPrompts(code) {
        // detect for-range loops like for i in range(N):
        const m = code.match(/for\s+\w+\s+in\s+range\((\d+)\)/)
        if (m && /input\(/.test(code)) return parseInt(m[1], 10)
        return (code.match(/input\(/g) || []).length
    }

    // runPythonAsync will simulate input prompts and call stdout for prints
    async function runPythonAsync(code) {
        // If the code is an import expression like 'import main', attempt to
        // load and execute the corresponding file from the fake FS so the
        // runner's writeFilesToFS + import pattern behaves as expected.
        const importMatch = (typeof code === 'string') && code.match(/^\s*import\s+([A-Za-z0-9_]+)\s*$/)
        let codeToAnalyze = code
        if (importMatch) {
            const mod = importMatch[1]
            const path = '/' + mod + '.py'
            if (FS.files[path]) {
                codeToAnalyze = FS.files[path]
            } else {
                codeToAnalyze = ''
            }
        }

        const prompts = countPrompts(codeToAnalyze)
        const answers = []
        for (let i = 0; i < prompts; i++) {
            if (typeof inputHandler === 'function') {
                try {
                    const v = await inputHandler('')
                    answers.push(v == null ? '' : String(v))
                    continue
                } catch (_e) { }
            }
            if (typeof stdin === 'function') {
                try {
                    const v = await stdin()
                    answers.push(v == null ? '' : String(v))
                    continue
                } catch (_e) { }
            }
            answers.push('')
        }

        // Very simple printing behavior: if code contains a single print(word)
        // we emulate printing the collected answers joined by newlines.
        const out = answers.join('\n')
        if (out) stdout(out)
        return ''
    }

    function runPython(code) { return runPythonAsync(code) }

    // Expose a minimal interrupt function placeholder
    function interruptExecution() { /* noop */ }

    return { FS, runPythonAsync, runPython, interruptExecution }
}
