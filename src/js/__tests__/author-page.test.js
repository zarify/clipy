/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('author-page initialization and add-file flow', () => {
    beforeEach(() => {
        // ensure fresh module import and clean DOM/localStorage
        jest.resetModules()
        document.documentElement.innerHTML = ''
        localStorage.clear()

        // Minimal DOM structure expected by author-page.js
        const metaTitle = document.createElement('input')
        metaTitle.id = 'meta-title'
        document.body.appendChild(metaTitle)

        const metaId = document.createElement('input')
        metaId.id = 'meta-id'
        document.body.appendChild(metaId)

        const metaVersion = document.createElement('input')
        metaVersion.id = 'meta-version'
        document.body.appendChild(metaVersion)

        const ta = document.createElement('textarea')
        ta.id = 'file-editor'
        document.body.appendChild(ta)

        const tabs = document.createElement('div')
        tabs.id = 'file-tabs'
        document.body.appendChild(tabs)

        const current = document.createElement('span')
        current.id = 'editor-current-file'
        document.body.appendChild(current)

        const addFileBtn = document.createElement('button')
        addFileBtn.id = 'add-file'
        document.body.appendChild(addFileBtn)

        // Elements referenced by setupHandlers / other flows
        const fileUpload = document.createElement('input')
        fileUpload.type = 'file'
        fileUpload.id = 'file-upload'
        document.body.appendChild(fileUpload)

        const importFile = document.createElement('input')
        importFile.type = 'file'
        importFile.id = 'import-file'
        document.body.appendChild(importFile)

        const exportBtn = document.createElement('button')
        exportBtn.id = 'export-btn'
        document.body.appendChild(exportBtn)

        const importBtn = document.createElement('button')
        importBtn.id = 'import-btn'
        document.body.appendChild(importBtn)

        const newConfig = document.createElement('button')
        newConfig.id = 'new-config'
        document.body.appendChild(newConfig)

        const saveDraft = document.createElement('button')
        saveDraft.id = 'save-draft'
        document.body.appendChild(saveDraft)

        const loadDraft = document.createElement('button')
        loadDraft.id = 'load-draft'
        document.body.appendChild(loadDraft)

        const loadDraftsClose = document.createElement('button')
        loadDraftsClose.id = 'load-drafts-close'
        document.body.appendChild(loadDraftsClose)

        const saveDraftSuccessClose = document.createElement('button')
        saveDraftSuccessClose.id = 'save-draft-success-close'
        document.body.appendChild(saveDraftSuccessClose)

        const backToApp = document.createElement('button')
        backToApp.id = 'back-to-app'
        document.body.appendChild(backToApp)

        const changelogBtn = document.createElement('button')
        changelogBtn.id = 'changelog-btn'
        document.body.appendChild(changelogBtn)

        const changelogClose = document.createElement('button')
        changelogClose.id = 'changelog-close'
        document.body.appendChild(changelogClose)

        // Modals and content containers
        const changelogModal = document.createElement('div')
        changelogModal.id = 'changelog-modal'
        const changelogContent = document.createElement('div')
        changelogContent.id = 'changelog-content'
        document.body.appendChild(changelogModal)
        document.body.appendChild(changelogContent)

        const loadDraftsModal = document.createElement('div')
        loadDraftsModal.id = 'load-drafts-modal'
        const loadDraftsContent = document.createElement('div')
        loadDraftsContent.id = 'load-drafts-content'
        const loadDraftsTitle = document.createElement('h3')
        loadDraftsTitle.id = 'load-drafts-modal-title'
        document.body.appendChild(loadDraftsModal)
        document.body.appendChild(loadDraftsContent)
        document.body.appendChild(loadDraftsTitle)

        const saveDraftSuccessModal = document.createElement('div')
        saveDraftSuccessModal.id = 'save-draft-success-modal'
        const saveDraftSuccessContent = document.createElement('div')
        saveDraftSuccessContent.id = 'save-draft-success-content'
        document.body.appendChild(saveDraftSuccessModal)
        document.body.appendChild(saveDraftSuccessContent)

        // Optional editors referenced
        const metaDesc = document.createElement('textarea')
        metaDesc.id = 'meta-description'
        document.body.appendChild(metaDesc)

        const instructions = document.createElement('textarea')
        instructions.id = 'instructions-editor'
        document.body.appendChild(instructions)

        const feedbackEditor = document.createElement('textarea')
        feedbackEditor.id = 'feedback-editor'
        document.body.appendChild(feedbackEditor)

        const testsEditor = document.createElement('textarea')
        testsEditor.id = 'tests-editor'
        document.body.appendChild(testsEditor)

        // Provide a minimal CodeMirror stub so loadEditor takes the CM path
        global.CodeMirror = {
            fromTextArea: (el) => {
                const stub = {
                    _value: el.value || '',
                    on: (ev, fn) => { /* ignore */ },
                    setValue: (v) => { stub._value = v },
                    getValue: () => stub._value,
                    refresh: () => { /* noop */ }
                }
                return stub
            }
        }
    })

    afterEach(() => {
        delete global.CodeMirror
        jest.clearAllMocks()
    })

    test('restores default main.py when no saved config', async () => {
        // Import module which registers DOMContentLoaded handler
        await import('../author-page.js')

        // Ensure a metadata tab button exists so the module's init can click it
        const metaBtn = document.createElement('button')
        metaBtn.className = 'tab-btn'
        metaBtn.dataset.tab = 'metadata'
        document.body.appendChild(metaBtn)

        // Fire DOMContentLoaded to trigger initialization (listener is on window)
        window.dispatchEvent(new Event('DOMContentLoaded'))

        // Allow any timers/async tasks to run
        await new Promise((r) => setTimeout(r, 10))

        const current = document.getElementById('editor-current-file')
        expect(current).not.toBeNull()
        expect(current.textContent).toBe('/main.py')

        const tabs = document.getElementById('file-tabs')
        expect(tabs).not.toBeNull()
        // Should have at least one tab for /main.py
        const labels = Array.from(tabs.querySelectorAll('span')).map(s => s.textContent)
        expect(labels).toContain('/main.py')
    })

    test('add-file button creates a new file and opens it', async () => {
        // Mock prompt to return a file path
        const origPrompt = global.prompt
        global.prompt = () => '/lib/util.py'

        await import('../author-page.js')

        const metaBtn = document.createElement('button')
        metaBtn.className = 'tab-btn'
        metaBtn.dataset.tab = 'metadata'
        document.body.appendChild(metaBtn)

        window.dispatchEvent(new Event('DOMContentLoaded'))

        // click the add-file button
        const btn = document.getElementById('add-file')
        btn.click()

        // allow debounce/save cycle
        await new Promise((r) => setTimeout(r, 20))

        const tabs = document.getElementById('file-tabs')
        const labels = Array.from(tabs.querySelectorAll('span')).map(s => s.textContent)
        expect(labels).toContain('/lib/util.py')

        const current = document.getElementById('editor-current-file')
        expect(current.textContent).toBe('/lib/util.py')

        global.prompt = origPrompt
    })
})
