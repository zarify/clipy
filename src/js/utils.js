// Core utilities and DOM helpers
export function $(id) {
    return document.getElementById(id)
}

export class DebounceTimer {
    constructor(delay = 300) {
        this.delay = delay
        this.timer = null
    }

    schedule(callback) {
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(callback, this.delay)
    }

    cancel() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}

export function normalizeIndentation(code) {
    // Convert tabs to 4 spaces and normalize leading whitespace
    return code.split('\n').map(line => {
        const match = line.match(/^([ \t]*)([\s\S]*)$/)
        const leading = (match && match[1]) || ''
        const rest = (match && match[2]) || ''

        // Convert leading tabs/spaces to spaces-only (tab = 4 spaces)
        let spaceCount = 0
        for (let i = 0; i < leading.length; i++) {
            spaceCount += (leading[i] === '\t') ? 4 : 1
        }
        return ' '.repeat(spaceCount) + rest
    }).join('\n')
}

export function transformWalrusPatterns(code) {
    // Support-lift simple walrus patterns where input() is used inside an
    // assignment expression in an `if` or `while` header.
    try {
        // Pattern with quoted prompt: if var := input("prompt"):
        code = code.replace(/^([ \t]*)(if|while)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*input\s*\(\s*(['\"])(.*?)\4\s*\)\s*:/gm,
            (m, indent, kw, vname, q, prompt) => {
                return `${indent}${vname} = input(${q}${prompt}${q})\n${indent}${kw} ${vname}:`
            })

        // Pattern without prompt string: if var := input():
        code = code.replace(/^([ \t]*)(if|while)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*input\s*\(\s*\)\s*:/gm,
            (m, indent, kw, vname) => {
                return `${indent}${vname} = input()\n${indent}${kw} ${vname}:`
            })
    } catch (_e) { }

    return code
}
