/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('author-tests edge cases', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
        localStorage.clear()
        window.Config = { current: {} }
    })

    afterEach(() => {
        delete window.Config
        jest.clearAllMocks()
        if (global.confirm) delete global.confirm
    })

    test('migrates legacy flat array into grouped shape with conditional field', async () => {
        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        const legacy = [{ id: 't-legacy', description: 'legacy test' }]
        ta.value = JSON.stringify(legacy)
        document.body.appendChild(ta)

        const mod = await import('../author-tests.js')
        mod.initAuthorTests()

        expect(window.Config.current.tests).toBeDefined()
        const tests = window.Config.current.tests
        expect(Array.isArray(tests.ungrouped)).toBe(true)
        expect(tests.ungrouped[0].id).toBe('t-legacy')
        // migrated conditional should be present
        expect(tests.ungrouped[0].conditional).toBeDefined()
        expect(tests.ungrouped[0].conditional.runIf).toBe('previous_passed')
    })

    test('calculates and displays correct test numbers for groups and ungrouped', async () => {
        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        const cfg = {
            groups: [{ id: 'g1', name: 'G1', tests: [{ id: 't1', description: 'in-group' }] }],
            ungrouped: [{ id: 'tu1', description: 'ungrouped' }]
        }
        ta.value = JSON.stringify(cfg)
        document.body.appendChild(ta)

        const mod = await import('../author-tests.js')
        mod.initAuthorTests()

        // find card for in-group test and assert number 1.1
        const cards = Array.from(document.querySelectorAll('.feedback-entry'))
        const inGroupCard = cards.find(c => c.textContent.includes('in-group'))
        expect(inGroupCard).toBeDefined()
        const numberSpan = inGroupCard.querySelector('span')
        expect(numberSpan.textContent).toBe('1.1')

        const ungroupedCard = cards.find(c => c.textContent.includes('ungrouped'))
        expect(ungroupedCard).toBeDefined()
        const ungroupedNumber = ungroupedCard.querySelector('span')
        expect(ungroupedNumber.textContent).toBe('2')
    })

    test('deleting a group moves its tests to ungrouped', async () => {
        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        const cfg = {
            groups: [{ id: 'gdel', name: 'DelGroup', tests: [{ id: 'tg', description: 'to-move' }] }],
            ungrouped: []
        }
        ta.value = JSON.stringify(cfg)
        document.body.appendChild(ta)

        // ensure confirm returns true so deletion proceeds
        global.confirm = () => true

        const mod = await import('../author-tests.js')
        mod.initAuthorTests()

        // find the group header delete button (btn-danger) and click it
        const headers = Array.from(document.querySelectorAll('.group-header'))
        expect(headers.length).toBeGreaterThan(0)
        const header = headers[0]
        const delBtn = Array.from(header.querySelectorAll('button')).find(b => b.textContent === 'Delete')
        expect(delBtn).toBeDefined()
        delBtn.click()

        // after deletion, tests should be in ungrouped
        const tests = window.Config.current.tests
        expect(tests.groups.length).toBe(0)
        expect(tests.ungrouped.length).toBeGreaterThanOrEqual(1)
        expect(tests.ungrouped[0].id).toBe('tg')
    })

    test('moving groups up and down changes group order', async () => {
        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        const cfg = {
            groups: [
                { id: 'gA', name: 'A', tests: [] },
                { id: 'gB', name: 'B', tests: [] }
            ],
            ungrouped: []
        }
        ta.value = JSON.stringify(cfg)
        document.body.appendChild(ta)

        const mod = await import('../author-tests.js')
        mod.initAuthorTests()

        // find group headers and move second group up
        let headers = Array.from(document.querySelectorAll('.group-header'))
        expect(headers.length).toBe(2)
        const secondHeader = headers[1]
        const upBtn = Array.from(secondHeader.querySelectorAll('button')).find(b => b.textContent === '↑')
        expect(upBtn).toBeDefined()
        upBtn.click()

        // groups in window.Config should have swapped
        const groups = window.Config.current.tests.groups
        expect(groups[0].id).toBe('gB')
        expect(groups[1].id).toBe('gA')

        // move first group down (now gB at index 0) to restore order
        headers = Array.from(document.querySelectorAll('.group-header'))
        const firstHeader = headers[0]
        const downBtn = Array.from(firstHeader.querySelectorAll('button')).find(b => b.textContent === '↓')
        downBtn.click()
        const groups2 = window.Config.current.tests.groups
        expect(groups2[0].id).toBe('gA')
        expect(groups2[1].id).toBe('gB')
    })
})
