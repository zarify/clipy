import { $ } from './utils.js'

let _matches = []
let _config = { feedback: [] }
let _testResults = []
let _streamBuffers = {}

function renderList() {
    try {
        const host = $('feedback-list')
        if (!host) return
        // Clear host first, then add run-tests control at top
        host.innerHTML = ''
        const controlRow = document.createElement('div')
        controlRow.style.display = 'flex'
        controlRow.style.justifyContent = 'flex-end'
        controlRow.style.marginBottom = '6px'
        const runBtn = document.createElement('button')
        runBtn.className = 'btn'
        runBtn.id = 'run-tests-btn'
        runBtn.textContent = 'Run tests'
        // Determine whether there are author tests in the config; if not, disable the button
        const cfgTests = Array.isArray(_config && _config.tests ? _config.tests : null) ? _config.tests : []
        if (!Array.isArray(cfgTests) || cfgTests.length === 0) {
            runBtn.disabled = true
            runBtn.title = 'No tests defined in config'
            runBtn.setAttribute('aria-disabled', 'true')
        } else {
            runBtn.title = 'Run author-provided tests'
            runBtn.setAttribute('aria-disabled', 'false')
        }

        runBtn.addEventListener('click', () => {
            try {
                // Trace user interaction for debugging: ensure the custom event is dispatched
                try { console.debug && console.debug('[feedback-ui] run-tests button clicked') } catch (_e) { }
                window.dispatchEvent(new CustomEvent('ssg:run-tests-click'))
            } catch (_e) { }
        })
        controlRow.appendChild(runBtn)
        host.appendChild(controlRow)

        // Build a map of matches by id for quick lookup
        const matchMap = new Map()
        for (const m of (_matches || [])) matchMap.set(m.id, m)

        // If no configured entries, show placeholder but keep run-tests control
        if (!Array.isArray(_config.feedback) || !_config.feedback.length) {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no feedback)'
            host.appendChild(p)
            // continue rendering empty sections so run-tests control remains visible
        }

        // Create two sections: edit and run
        const editSection = document.createElement('div')
        editSection.className = 'feedback-section feedback-edit-section'
        const editHeader = document.createElement('h3')
        editHeader.textContent = 'Editor feedback'
        editSection.appendChild(editHeader)

        const runSection = document.createElement('div')
        runSection.className = 'feedback-section feedback-run-section'
        const runHeader = document.createElement('h3')
        runHeader.textContent = 'Run-time feedback'
        runSection.appendChild(runHeader)

        // --- Test results section (if any) ---
        const testsSection = document.createElement('div')
        testsSection.className = 'feedback-section feedback-tests-section'
        const testsHeader = document.createElement('h3')
        testsHeader.textContent = 'Test results'
        testsSection.appendChild(testsHeader)

        if (Array.isArray(_testResults) && _testResults.length) {
            // Author test metadata can be found in _config.tests (optional)
            const cfgTests = Array.isArray((_config && _config.tests) ? _config.tests : []) ? _config.tests : []
            for (const r of _testResults) {
                const tr = document.createElement('div')
                tr.className = 'feedback-entry test-entry ' + (r.passed ? 'test-pass' : 'test-fail')
                tr.setAttribute('data-test-id', String(r.id || ''))

                const titleRow = document.createElement('div')
                titleRow.className = 'feedback-title-row'
                const icon = document.createElement('span')
                icon.className = 'feedback-icon'
                icon.textContent = r.passed ? '✅' : '❌'
                titleRow.appendChild(icon)
                const titleEl = document.createElement('div')
                titleEl.className = 'feedback-title'

                // Prefer author-provided description/title from config.tests when available
                let authorEntry = null
                try { authorEntry = cfgTests.find(t => String(t.id) === String(r.id)) } catch (e) { authorEntry = null }
                const displayTitle = (authorEntry && (authorEntry.description || authorEntry.title)) ? (authorEntry.description || authorEntry.title) : ((r.description) ? r.description : (r.id || ''))
                titleEl.textContent = displayTitle
                titleRow.appendChild(titleEl)
                tr.appendChild(titleRow)

                // Only surface failure details (stderr/stdout/traceback) if the author requested it
                // by setting `show_traceback: true` on the test config entry.  If no author entry
                // exists, fallback to previous behavior and show details for failing tests.
                const shouldShowDetails = authorEntry ? !!authorEntry.show_traceback : (!r.passed && (r.stdout || r.stderr || r.reason))

                if (shouldShowDetails && (!r.passed && (r.stdout || r.stderr || r.reason))) {
                    const details = document.createElement('div')
                    details.className = 'feedback-msg'
                    let text = ''
                    if (r.reason) text += '[' + r.reason + '] '
                    if (r.stderr) text += 'stderr: ' + r.stderr + '\n'
                    if (r.stdout) text += 'stdout: ' + r.stdout
                    details.textContent = text
                    tr.appendChild(details)
                }

                tr.addEventListener('click', () => {
                    try { window.dispatchEvent(new CustomEvent('ssg:test-click', { detail: r })) } catch (_e) { }
                })

                testsSection.appendChild(tr)
            }
        } else {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no test results)'
            testsSection.appendChild(p)
        }

        for (const entry of _config.feedback) {
            const id = entry.id || ''
            const title = entry.title || id
            const matched = matchMap.get(id)

            const wrapper = document.createElement('div')
            wrapper.className = 'feedback-entry'
            wrapper.setAttribute('data-id', id)

            // severity (hint | info | warning) - default to info
            const sev = (entry.severity || 'info').toLowerCase()
            wrapper.classList.add('severity-' + sev)

            // title row with icon
            const titleRow = document.createElement('div')
            titleRow.className = 'feedback-title-row'

            const icon = document.createElement('span')
            icon.className = 'feedback-icon'
            icon.textContent = (sev === 'hint') ? '💡' : (sev === 'warning') ? '⚠️' : 'ℹ️'
            titleRow.appendChild(icon)

            const titleEl = document.createElement('div')
            titleEl.className = 'feedback-title'
            titleEl.textContent = title
            titleRow.appendChild(titleEl)

            wrapper.appendChild(titleRow)

            // If matched, show the message under the title
            if (matched && matched.message) {
                const msg = document.createElement('div')
                msg.className = 'feedback-msg feedback-msg-matched matched-' + sev
                msg.textContent = matched.message
                wrapper.appendChild(msg)
            } else if (entry.visibleByDefault) {
                // Show an empty placeholder or hint for visible-by-default entries
                const hint = document.createElement('div')
                hint.className = 'feedback-msg feedback-msg-hidden'
                hint.textContent = ''
                wrapper.appendChild(hint)
            }

            // Clicking a title should emit the feedback-click with the canonical entry + match
            const attachClick = (el) => {
                el.addEventListener('click', () => {
                    try {
                        const payload = Object.assign({}, entry, { match: matched || null })
                        window.dispatchEvent(new CustomEvent('ssg:feedback-click', { detail: payload }))
                    } catch (_e) { }
                })
            }

            attachClick(wrapper)

            // Place into appropriate section(s) based on `when` array
            const when = Array.isArray(entry.when) ? entry.when : ['edit']
            if (when.includes('edit')) editSection.appendChild(wrapper)
            if (when.includes('run')) {
                const clone = wrapper.cloneNode(true)
                attachClick(clone)
                runSection.appendChild(clone)
            }
        }

        // If a section is empty, show a placeholder
        if (!editSection.querySelector('.feedback-entry')) {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no editor feedback)'
            editSection.appendChild(p)
        }

        if (!runSection.querySelector('.feedback-entry')) {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no run-time feedback)'
            runSection.appendChild(p)
        }

        host.appendChild(editSection)
        host.appendChild(runSection)
    } catch (_e) { }
}

export function setFeedbackConfig(cfg) {
    _config = cfg || { feedback: [] }
    renderList()
}

export function setFeedbackMatches(matches) {
    _matches = matches || []
    renderList()
}

export function setTestResults(results) {
    _testResults = Array.isArray(results) ? results : []
    try { console.debug && console.debug('[feedback-ui] setTestResults', _testResults.length) } catch (e) { }
    renderList()
    try { showTestResultsModal(_testResults) } catch (e) { }
}

export function appendTestOutput({ id, type, text }) {
    try {
        if (!id) return
        _streamBuffers[id] = _streamBuffers[id] || { stdout: '', stderr: '' }
        if (type === 'stdout') _streamBuffers[id].stdout += text
        else if (type === 'stderr') _streamBuffers[id].stderr += text

        // If we already have a result entry for this id, update it
        const idx = _testResults.findIndex(r => String(r.id) === String(id))
        if (idx !== -1) {
            const existing = _testResults[idx]
            existing.stdout = _streamBuffers[id].stdout
            existing.stderr = _streamBuffers[id].stderr
            renderList()
        }
    } catch (_e) { }
}

// Modal helpers for showing test-run summaries
function createResultsModal() {
    let modal = document.getElementById('test-results-modal')
    if (modal) return modal
    modal = document.createElement('div')
    modal.id = 'test-results-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.style.position = 'fixed'
    modal.style.left = '0'
    modal.style.top = '0'
    modal.style.right = '0'
    modal.style.bottom = '0'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '9999'

    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    overlay.style.left = '0'
    overlay.style.top = '0'
    overlay.style.right = '0'
    overlay.style.bottom = '0'
    overlay.style.background = 'rgba(0,0,0,0.45)'
    modal.appendChild(overlay)

    const box = document.createElement('div')
    box.className = 'test-results-box'
    box.style.position = 'relative'
    box.style.maxWidth = '720px'
    box.style.width = '90%'
    box.style.maxHeight = '80%'
    box.style.overflow = 'auto'
    box.style.background = '#fff'
    box.style.borderRadius = '8px'
    box.style.padding = '18px'
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
    modal.appendChild(box)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'btn'
    closeBtn.textContent = 'Close'
    closeBtn.style.position = 'absolute'
    closeBtn.style.right = '12px'
    closeBtn.style.top = '12px'
    closeBtn.addEventListener('click', () => closeTestResultsModal())
    box.appendChild(closeBtn)

    const title = document.createElement('h2')
    title.textContent = 'Test results'
    title.style.marginTop = '6px'
    title.style.marginBottom = '12px'
    box.appendChild(title)

    const content = document.createElement('div')
    content.className = 'test-results-content'
    box.appendChild(content)

    // close when clicking overlay
    overlay.addEventListener('click', () => closeTestResultsModal())

    document.body.appendChild(modal)
    return modal
}

function closeTestResultsModal() {
    const modal = document.getElementById('test-results-modal')
    if (!modal) return
    try { modal.remove() } catch (e) { modal.style.display = 'none' }
}

function showTestResultsModal(results) {
    if (!results || !Array.isArray(results)) return
    // Build modal
    const modal = createResultsModal()
    const content = modal.querySelector('.test-results-content')
    if (!content) return
    content.innerHTML = ''

    // Map config tests for metadata lookup
    const cfgMap = new Map()
    try {
        if (_config && Array.isArray(_config.tests)) {
            for (const t of _config.tests) cfgMap.set(String(t.id), t)
        }
    } catch (e) { }

    for (const r of results) {
        const row = document.createElement('div')
        row.className = 'test-result-row'
        row.style.borderTop = '1px solid #eee'
        row.style.padding = '10px 0'

        const header = document.createElement('div')
        header.style.display = 'flex'
        header.style.alignItems = 'center'
        header.style.justifyContent = 'space-between'

        const left = document.createElement('div')
        left.style.display = 'flex'
        left.style.alignItems = 'center'

        const emoji = document.createElement('div')
        emoji.style.fontSize = '20px'
        emoji.style.marginRight = '10px'
        emoji.textContent = r.passed ? '✅' : '❌'
        left.appendChild(emoji)

        const title = document.createElement('div')
        const meta = cfgMap.get(String(r.id)) || {}
        title.textContent = meta.description || r.description || (r.id || '')
        title.style.fontWeight = '600'
        left.appendChild(title)

        header.appendChild(left)

        const status = document.createElement('div')
        status.textContent = r.passed ? 'Passed' : 'Failed'
        status.style.fontWeight = '600'
        header.appendChild(status)

        row.appendChild(header)

        // Optional feedback blocks
        const fb = document.createElement('div')
        fb.style.marginTop = '8px'
        fb.style.whiteSpace = 'pre-wrap'

        if (r.passed && meta && meta.pass_feedback) {
            const pf = document.createElement('div')
            pf.className = 'test-pass-feedback'
            pf.textContent = String(meta.pass_feedback)
            pf.style.color = '#0a6'
            fb.appendChild(pf)
        } else if (!r.passed && meta && meta.fail_feedback) {
            const ff = document.createElement('div')
            ff.className = 'test-fail-feedback'
            ff.textContent = String(meta.fail_feedback)
            ff.style.color = '#d33'
            fb.appendChild(ff)
        }

        // Show stderr/stdout/reason if present (collapsed)
        const details = []
        if (r.reason) details.push('Reason: ' + r.reason)
        if (r.stderr) details.push('stderr: ' + r.stderr)
        if (r.stdout) details.push('stdout: ' + r.stdout)
        if (details.length) {
            const det = document.createElement('div')
            det.className = 'test-io'
            det.style.marginTop = '8px'
            det.style.background = '#f8f8f8'
            det.style.padding = '8px'
            det.style.borderRadius = '4px'
            det.style.fontFamily = 'monospace'
            det.style.whiteSpace = 'pre-wrap'
            det.textContent = details.join('\n')
            fb.appendChild(det)
        }

        row.appendChild(fb)
        content.appendChild(row)
    }

    // Focus for a11y
    const box = modal.querySelector('.test-results-box')
    if (box) box.focus()
}

export function initializeFeedbackUI() {
    try {
        // expose hooks for other modules to push matches or config
        window.__ssg_set_feedback_matches = setFeedbackMatches
        window.__ssg_set_feedback_config = setFeedbackConfig
        window.__ssg_set_test_results = setTestResults
        window.__ssg_append_test_output = appendTestOutput
    } catch (_e) { }
}

export default { setFeedbackConfig, setFeedbackMatches, initializeFeedbackUI }
