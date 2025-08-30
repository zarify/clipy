import { validateAndNormalizeConfig } from './config.js'
import { saveAuthorConfigToLocalStorage, getAuthorConfigFromLocalStorage, clearAuthorConfigInLocalStorage, saveDraft, listDrafts, loadDraft } from './author-storage.js'

function $(id) { return document.getElementById(id) }

let editor = null
let files = {} // map path -> content or { content, binary, mime }
let currentFile = '/main.py'
let autosaveTimer = null
const AUTOSAVE_DELAY = 500
const BINARY_LIMIT = 204800 // 200KB

function debounceSave() {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveToLocalStorage(), AUTOSAVE_DELAY)
}

function loadEditor() {
    const ta = $('file-editor')
    try {
        editor = CodeMirror.fromTextArea(ta, { lineNumbers: true, mode: 'python' })
        // store CM instance for tests to access if needed
        try { window.__author_code_mirror = editor } catch (_e) { }
        editor.on('change', () => {
            const val = editor.getValue()
            files[currentFile] = String(val)
            debounceSave()
        })
        // ensure initial layout is correct
        try { if (editor && typeof editor.refresh === 'function') editor.refresh() } catch (_e) { }
    } catch (e) {
        console.warn('CodeMirror not available, falling back to textarea')
        ta.addEventListener('input', () => {
            files[currentFile] = ta.value
            debounceSave()
        })
    }
}

function renderFileList() {
    // Render as tabs
    const tabs = $('file-tabs')
    tabs.innerHTML = ''
    for (const p of Object.keys(files)) {
        const t = document.createElement('button')
        t.className = 'btn'
        t.style.padding = '6px'
        t.textContent = p
        t.addEventListener('click', () => openFile(p))
        tabs.appendChild(t)
    }
}

function openFile(path) {
    currentFile = path
    $('editor-current-file').textContent = path
    const content = files[path]
    if (typeof content === 'string') {
        if (editor) editor.setValue(content)
        else $('file-editor').value = content
    } else if (content && content.binary) {
        // binary preview: show metadata and disable editing
        const text = `-- binary file (${content.mime || 'application/octet-stream'}), ${content.content ? Math.ceil((content.content.length * 3) / 4) : 0} bytes base64 --`
        if (editor) editor.setValue(text)
        else $('file-editor').value = text
    }
}

function saveToLocalStorage() {
    try {
        const cfg = buildCurrentConfig()
        // try to validate/normalize but don't block autosave on failure
        try {
            const norm = validateAndNormalizeConfig(cfg)
            saveAuthorConfigToLocalStorage(norm)
            $('validation').textContent = ''
        } catch (e) {
            // keep raw config but show validation message
            try { localStorage.setItem('author_config', JSON.stringify(cfg)) } catch (_e) { }
            $('validation').textContent = 'Validation: ' + (e && e.message ? e.message : e)
        }
    } catch (e) { console.error('autosave failed', e) }
}

function buildCurrentConfig() {
    const title = $('meta-title').value || ''
    const id = $('meta-id').value || ''
    const version = $('meta-version').value || ''
    const description = $('meta-description') ? $('meta-description').value || '' : ''
    const instructions = $('instructions-editor') ? $('instructions-editor').value || '' : ''
    const feedbackRaw = $('feedback-editor') ? $('feedback-editor').value || '' : ''
    const testsRaw = $('tests-editor') ? $('tests-editor').value || '' : ''
    const starter = files['/main.py'] || ''
    const cfg = { id, title, version, description, instructions, feedback: feedbackRaw, tests: testsRaw, starter, files }
    return cfg
}

function restoreFromLocalStorage() {
    const raw = getAuthorConfigFromLocalStorage()
    if (!raw) {
        // initialize defaults
        files = { '/main.py': '# starter code\n' }
        renderFileList()
        openFile('/main.py')
        return
    }
    try {
        // raw may be normalized or raw shape
        files = raw.files || { '/main.py': raw.starter || '# starter code\n' }
        $('meta-title').value = raw.title || ''
        $('meta-id').value = raw.id || ''
        $('meta-version').value = raw.version || ''
        if ($('meta-description')) $('meta-description').value = raw.description || ''
        if ($('instructions-editor')) $('instructions-editor').value = raw.instructions || ''
        if ($('feedback-editor')) $('feedback-editor').value = raw.feedback || ''
        if ($('tests-editor')) $('tests-editor').value = raw.tests || ''
    } catch (e) { files = { '/main.py': '# starter code\n' } }
    renderFileList()
    openFile(Object.keys(files)[0] || '/main.py')
}

async function handleUpload(ev) {
    const f = ev.target.files && ev.target.files[0]
    if (!f) return
    if (f.size > BINARY_LIMIT) {
        alert('Binary too large (>200KB). Please host externally or reduce size.')
        return
    }
    const isText = f.type.startsWith('text') || f.name.endsWith('.py') || f.name.endsWith('.txt') || f.type === ''
    if (isText) {
        const txt = await f.text()
        files['/' + f.name] = txt
        renderFileList()
        openFile('/' + f.name)
        debounceSave()
        return
    }
    // binary
    const ab = await f.arrayBuffer()
    const b64 = arrayBufferToBase64(ab)
    files['/' + f.name] = { content: b64, binary: true, mime: f.type || 'application/octet-stream' }
    renderFileList()
    openFile('/' + f.name)
    debounceSave()
}

function arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
}

function setupHandlers() {
    // Tab switching: delegate to showTab so code-tab refresh logic runs
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', (ev) => {
        const tab = b.dataset.tab
        try { showTab(tab) } catch (_e) { }
    }))

    function showTab(tab) {
        document.querySelectorAll('.author-tab').forEach(t => t.classList.remove('active'))
        const el = document.getElementById('tab-' + tab)
        if (el) el.classList.add('active')
        document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'))
        const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]')
        if (btn) btn.classList.add('active')
        // If switching to the code tab, refresh CodeMirror so it lays out gutters and content
        if (tab === 'code') {
            // refresh after a tiny delay so the editor can measure its container
            setTimeout(() => {
                try { if (editor && typeof editor.refresh === 'function') editor.refresh() } catch (_e) { }
                try { openFile(currentFile) } catch (_e) { }
            }, 40)
        }
    }

    // Metadata & editors
    $('meta-title').addEventListener('input', debounceSave)
    $('meta-id').addEventListener('input', debounceSave)
    $('meta-version').addEventListener('input', debounceSave)
    if ($('meta-description')) $('meta-description').addEventListener('input', debounceSave)
    if ($('instructions-editor')) $('instructions-editor').addEventListener('input', debounceSave)
    if ($('feedback-editor')) $('feedback-editor').addEventListener('input', debounceSave)
    if ($('tests-editor')) $('tests-editor').addEventListener('input', debounceSave)
    $('add-file').addEventListener('click', () => {
        const name = prompt('File path (e.g. /lib/util.py)')
        if (!name) return
        files[name] = ''
        renderFileList()
        openFile(name)
        debounceSave()
    })
    $('file-upload').addEventListener('change', handleUpload)
    // Export stub (not yet implemented)
    $('export-btn').addEventListener('click', () => {
        alert('Export not implemented yet — coming soon.')
    })

    // Import stub (not yet implemented)
    $('import-btn').addEventListener('click', () => {
        alert('Import not implemented yet — coming soon.')
    })
    $('import-file').addEventListener('change', (ev) => {
        // Clear the input and show a stub message
        ev.target.value = ''
        alert('Import not implemented yet — coming soon.')
    })

    $('use-in-app').addEventListener('click', () => {
        try {
            const cfg = buildCurrentConfig()
            // try to normalize, but if validation fails still write raw so app can inspect
            try {
                const norm = validateAndNormalizeConfig(cfg)
                localStorage.setItem('author_config', JSON.stringify(norm))
            } catch (_err) {
                localStorage.setItem('author_config', JSON.stringify(cfg))
            }
            // navigate to app root
            window.location.href = '/'
        } catch (e) { alert('Failed to set author_config: ' + e.message) }
    })

    // Draft buttons are stubs for now; explicit IndexedDB draft functionality will be added later
    $('save-draft').addEventListener('click', () => {
        alert('Save Draft not implemented yet — drafts will be added later.')
    })
    $('load-draft').addEventListener('click', () => {
        alert('Load Drafts not implemented yet — drafts will be added later.')
    })
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadEditor()
    restoreFromLocalStorage()
    setupHandlers()
    // Show metadata tab by default so inputs are visible for tests
    try { document.querySelector('.tab-btn[data-tab="metadata"]').click() } catch (_e) { }
})
