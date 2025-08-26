// CodeMirror editor initialization and management
import { $ } from './utils.js'
import { getConfig } from './config.js'

let cm = null
let textarea = null

export function initializeEditor() {
    const config = getConfig()

    // Get DOM elements
    textarea = $('code')
    const host = $('editor-host')

    if (!textarea || !host) {
        console.error('Required editor elements not found')
        return null
    }

    // Set initial content
    textarea.value = config?.starter || '# write Python here'

    // Initialize CodeMirror editor if available
    if (window.CodeMirror) {
        cm = window.CodeMirror(host, {
            value: textarea.value,
            mode: 'python',
            lineNumbers: true,
            indentUnit: 4,
            theme: 'default'
        })

        // Ctrl-Enter to run
        cm.setOption('extraKeys', {
            'Ctrl-Enter': () => {
                const runBtn = $('run')
                if (runBtn) runBtn.click()
            }
        })

        // Expose globally for debugging
        try {
            window.cm = cm
            console.log('CodeMirror initialized:', {
                readOnly: cm.getOption('readOnly'),
                value: cm.getValue(),
                mode: cm.getOption('mode')
            })
        } catch (e) {
            console.error('Error exposing CodeMirror:', e)
        }

        // Position textarea outside visible area but still detectable by tests
        const mainTextarea = document.getElementById('code');
        if (mainTextarea) {
            mainTextarea.style.position = 'absolute';
            mainTextarea.style.top = '-9999px';  // Move way off screen
            mainTextarea.style.left = '-9999px';
            mainTextarea.style.width = '1px';
            mainTextarea.style.height = '1px';
            mainTextarea.style.opacity = '1';  // Keep opaque for Playwright
            mainTextarea.style.zIndex = '1';   // Normal z-index
            mainTextarea.style.pointerEvents = 'auto';
            mainTextarea.style.background = 'transparent';
            mainTextarea.style.border = 'none';
            mainTextarea.style.resize = 'none';
            mainTextarea.style.color = 'black';
            mainTextarea.style.outline = 'none';
            mainTextarea.style.display = 'block';
        }

        // Sync CodeMirror changes back to textarea for test compatibility
        cm.on('change', () => {
            textarea.value = cm.getValue()
            textarea.dispatchEvent(new Event('input', { bubbles: true }))
        })

        // Sync textarea changes to CodeMirror (for tests that fill the textarea)
        textarea.addEventListener('input', () => {
            if (cm.getValue() !== textarea.value) {
                cm.setValue(textarea.value)
            }
        })

        // Watch for programmatic changes to textarea value property (for Playwright fills)
        let lastValue = textarea.value
        const checkForProgrammaticChanges = () => {
            if (textarea.value !== lastValue) {
                lastValue = textarea.value
                if (cm.getValue() !== textarea.value) {
                    cm.setValue(textarea.value)
                }
            }
        }
        setInterval(checkForProgrammaticChanges, 50)  // Check more frequently

        return cm
    } else {
        console.warn('CodeMirror not available, using textarea fallback')
        return null
    }
}

export function getCodeMirror() {
    return cm
}

export function getTextarea() {
    return textarea
}

export function getCurrentContent() {
    if (cm) return cm.getValue()
    if (textarea) return textarea.value
    return ''
}

export function setCurrentContent(content) {
    if (cm) cm.setValue(content)
    else if (textarea) textarea.value = content
}
