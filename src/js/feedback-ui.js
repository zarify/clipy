import { $ } from './utils.js'

let _matches = []
let _config = { feedback: [] }

function renderList() {
    try {
        const host = $('feedback-list')
        if (!host) return
        host.innerHTML = ''

        // Build a map of matches by id for quick lookup
        const matchMap = new Map()
        for (const m of (_matches || [])) matchMap.set(m.id, m)

        // If no configured entries, show placeholder
        if (!Array.isArray(_config.feedback) || !_config.feedback.length) {
            host.textContent = '(no feedback)'
            return
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

export function initializeFeedbackUI() {
    try {
        // expose hooks for other modules to push matches or config
        window.__ssg_set_feedback_matches = setFeedbackMatches
        window.__ssg_set_feedback_config = setFeedbackConfig
    } catch (_e) { }
}

export default { setFeedbackConfig, setFeedbackMatches, initializeFeedbackUI }
