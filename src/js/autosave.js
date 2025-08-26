// Autosave functionality
import { $ } from './utils.js'
import { getCodeMirror, getTextarea } from './editor.js'

let autosaveTimer = null

export function initializeAutosave() {
    const cm = getCodeMirror()
    const textarea = getTextarea()

    // Hook editor change events
    if (cm) {
        cm.on('change', scheduleAutosave)
    } else if (textarea) {
        textarea.addEventListener('input', scheduleAutosave)
    }
}

function scheduleAutosave() {
    const autosaveIndicator = $('autosave-indicator')

    // While saving, show a short status without filename to avoid width jumps
    try {
        if (autosaveIndicator) autosaveIndicator.textContent = 'Saving...'
    } catch (_e) { }

    if (autosaveTimer) clearTimeout(autosaveTimer)

    autosaveTimer = setTimeout(() => {
        const cm = getCodeMirror()
        const textarea = getTextarea()
        const content = (cm ? cm.getValue() : (textarea ? textarea.value : ''))

        localStorage.setItem('autosave', JSON.stringify({
            ts: Date.now(),
            code: content
        }))

        // After save, include the active filename if available
        try {
            const activePath = (window.TabManager && typeof window.TabManager.getActive === 'function')
                ? window.TabManager.getActive()
                : null
            if (autosaveIndicator) {
                autosaveIndicator.textContent = activePath
                    ? ('Saved (' + activePath + ')')
                    : 'Saved'
            }
        } catch (_e) {
            try {
                if (autosaveIndicator) autosaveIndicator.textContent = 'Saved'
            } catch (__e) { }
        }
    }, 300)
}
