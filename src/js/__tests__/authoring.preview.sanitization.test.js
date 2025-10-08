/**
 * Focused tests for authoring UI sanitization:
 * - updateInstructionsPreview should sanitize rendered markdown
 * - openChangelogModal should sanitize fetched markdown before inserting
 * - openLoadDraftsModal should not render untrusted draft fields as active HTML
 */

import { jest } from '@jest/globals'

beforeEach(() => {
    // clear DOM
    document.body.innerHTML = ''
    // Ensure required elements are present
    const ta = document.createElement('textarea')
    ta.id = 'instructions-editor'
    document.body.appendChild(ta)
    const preview = document.createElement('div')
    preview.id = 'instructions-preview'
    document.body.appendChild(preview)

    // Modals
    const changelogModal = document.createElement('div')
    changelogModal.id = 'changelog-modal'
    const changelogContent = document.createElement('div')
    changelogContent.id = 'changelog-content'
    changelogModal.appendChild(changelogContent)
    document.body.appendChild(changelogModal)

    const loadDraftsModal = document.createElement('div')
    loadDraftsModal.id = 'load-drafts-modal'
    const loadDraftsContent = document.createElement('div')
    loadDraftsContent.id = 'load-drafts-content'
    loadDraftsModal.appendChild(loadDraftsContent)
    document.body.appendChild(loadDraftsModal)

    // Provide DOMPurify and marked stubs if not present
    if (!window.DOMPurify) {
        window.DOMPurify = { sanitize: (s) => String(s).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/on[a-z]+=((\"[^\"]*\")|(\'[^\']*\')|([^\s>]+))/gi, '') }
    }
    if (!window.marked) {
        window.marked = { parse: (md) => String(md) }
    }
})

test('updateInstructionsPreview sanitizes malicious markdown input', async () => {
    const mod = await import('../author-page.js')
    const { updateInstructionsPreview } = mod
    const ta = document.getElementById('instructions-editor')
    ta.value = 'Hello<img src=x onerror=window.__a=1>world<script>window.__b=1</script>'

    // remove any globals
    try { delete global.__a } catch (_) { }
    try { delete global.__b } catch (_) { }

    updateInstructionsPreview()

    const preview = document.getElementById('instructions-preview')
    expect(preview).not.toBeNull()
    const html = preview.innerHTML
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).toMatch(/Hello/) // visible text remains
    expect(html).toMatch(/world/)
})

// Mock fetch for changelog content
function mockFetchResponse(body, ok = true) {
    return Promise.resolve({ ok, text: () => Promise.resolve(body) })
}

test('openChangelogModal sanitizes fetched changelog markdown', async () => {
    // stub fetch
    const origFetch = window.fetch
    window.fetch = () => mockFetchResponse('Line1\n\n<img src=x onerror=window.__c=1>Safe')

    const mod = await import('../author-page.js')
    const { openChangelogModal } = mod

    // clear any globals
    try { delete global.__c } catch (_) { }

    await openChangelogModal()

    const content = document.getElementById('changelog-content')
    expect(content).not.toBeNull()
    const html = content.innerHTML
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).toMatch(/Line1/)

    // restore fetch
    window.fetch = origFetch
})

// Stub storage functions used by openLoadDraftsModal to return a malicious draft
// Use unstable_mockModule for ESM modules so the mock is applied before import
jest.unstable_mockModule('../author-storage.js', () => ({
    saveAuthorConfigToLocalStorage: async (cfg) => true,
    getAuthorConfigFromLocalStorage: async () => null,
    clearAuthorConfigInLocalStorage: async () => true,
    saveDraft: async (d) => ({ ...d, id: 1 }),
    listDrafts: async () => {
        return [
            { id: 1, name: 'Evil', updatedAt: Date.now(), config: { title: 'T', id: 'evil', version: '1.0', description: '<img src=x onerror=window.__d=1>' } }
        ]
    },
    loadDraft: async (id) => ({ id, name: 'Evil', config: { title: 'T', id: 'evil', version: '1.0' } }),
    deleteDraft: async (id) => true,
    findDraftByConfigIdAndVersion: async (id, ver) => null
}))

test('openLoadDraftsModal does not render untrusted draft fields as active HTML', async () => {
    const mod = await import('../author-page.js')
    const { openLoadDraftsModal } = mod

    // clear any globals
    try { delete global.__d } catch (_) { }

    await openLoadDraftsModal()

    const content = document.getElementById('load-drafts-content')
    expect(content).not.toBeNull()
    const html = content.innerHTML
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).toMatch(/Evil/)
})
