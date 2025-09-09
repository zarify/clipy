import { jest } from '@jest/globals'

describe('author-storage (localStorage + IndexedDB fallback)', () => {
    beforeEach(() => {
        jest.resetModules()
        // Clear localStorage and ensure no indexedDB to force fallback paths
        if (typeof localStorage !== 'undefined') localStorage.clear()
        try { delete window.indexedDB } catch (_e) { window.indexedDB = undefined }
    })

    test('get/save/clear author config in localStorage', async () => {
        const mod = await import('../author-storage.js')
        const { getAuthorConfigFromLocalStorage, saveAuthorConfigToLocalStorage, clearAuthorConfigInLocalStorage } = mod

        expect(getAuthorConfigFromLocalStorage()).toBeNull()
        const ok = saveAuthorConfigToLocalStorage({ id: 'a', version: '1.0' })
        expect(ok).toBe(true)
        const cfg = getAuthorConfigFromLocalStorage()
        expect(cfg).toMatchObject({ id: 'a', version: '1.0' })
        const cleared = clearAuthorConfigInLocalStorage()
        expect(cleared).toBe(true)
        expect(getAuthorConfigFromLocalStorage()).toBeNull()
    })

    test('saveDraft falls back to localStorage when IndexedDB unavailable', async () => {
        const mod = await import('../author-storage.js')
        const { saveDraft } = mod

        const rec = { id: 'd1', config: { id: 'c1', version: 'v1' }, data: 'x' }
        const saved = await saveDraft(rec)
        expect(saved).toMatchObject({ id: 'd1' })

        // Verify localStorage contains the draft under author_draft:d1
        const raw = localStorage.getItem('author_draft:d1')
        expect(raw).toBeTruthy()
        const parsed = JSON.parse(raw)
        expect(parsed.config).toMatchObject({ id: 'c1', version: 'v1' })
    })

    test('listDrafts scans localStorage keys and loadDraft/deleteDraft operate', async () => {
        const mod = await import('../author-storage.js')
        const { listDrafts, loadDraft, deleteDraft } = mod

        // seed localStorage with two drafts
        localStorage.setItem('author_draft:dA', JSON.stringify({ id: 'dA', config: { id: 'cfg', version: '1' } }))
        localStorage.setItem('author_draft:dB', JSON.stringify({ id: 'dB', config: { id: 'cfg2', version: '2' } }))

        const all = await listDrafts()
        expect(Array.isArray(all)).toBe(true)
        expect(all.find(x => x.id === 'dA')).toBeTruthy()

        const loaded = await loadDraft('dB')
        expect(loaded).toMatchObject({ id: 'dB' })

        const del = await deleteDraft('dB')
        expect(del).toBe(true)
        expect(localStorage.getItem('author_draft:dB')).toBeNull()
    })

    test('findDraftByConfigIdAndVersion locates matching draft', async () => {
        const mod = await import('../author-storage.js')
        const { findDraftByConfigIdAndVersion } = mod

        localStorage.setItem('author_draft:x1', JSON.stringify({ id: 'x1', config: { id: 'mycfg', version: '9' } }))
        localStorage.setItem('author_draft:x2', JSON.stringify({ id: 'x2', config: { id: 'other', version: '1' } }))

        const found = await findDraftByConfigIdAndVersion('mycfg', '9')
        expect(found).toBeTruthy()
        expect(found.id).toBe('x1')
    })
})
