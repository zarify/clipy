/*
 Simple Node script to download known vendor files into src/vendor.
 Run: node scripts/fetch_vendors.js

 This script is intentionally conservative: it will not overwrite existing files unless --force is passed.
*/
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outDir = path.resolve(__dirname, '..', 'src', 'vendor')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const files = [
    {
        url: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css',
        name: 'codemirror.min.css'
    },
    {
        url: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js',
        name: 'codemirror.min.js'
    },
    {
        url: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/python/python.min.js',
        name: 'codemirror-mode-python.min.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
        name: 'marked.min.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js',
        name: 'purify.min.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.8.0/build/highlight.min.js',
        name: 'highlight.min.js'
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/highlight.js@11.8.0/styles/github.min.css',
        name: 'highlight-github.min.css'
    }
];

const args = process.argv.slice(2);
const force = args.includes('--force');
async function download(file) {
    const outPath = path.join(outDir, file.name)
    if (fs.existsSync(outPath) && !force) {
        console.log('Skipping existing', file.name)
        return
    }
    console.log('Downloading', file.url, '->', outPath)
    const res = await fetch(file.url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.arrayBuffer()
    fs.writeFileSync(outPath, Buffer.from(data))
}

; (async () => {
    for (const f of files) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await download(f)
        } catch (err) {
            console.error('Failed to download', f.url, err.message)
        }
    }
    console.log('Done')
})()
