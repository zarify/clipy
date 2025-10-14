/**
 * @jest-environment jsdom
 */

import { setupSideTabs, activateSideTab } from '../src/js/terminal.js'

// Minimal DOM fixture matching the author UI structure used by the terminal
beforeEach(() => {
    document.body.innerHTML = `
    <div>
      <button id="tab-btn-instructions" data-tab="instructions" class="tab-btn btn">Instructions</button>
      <button id="tab-btn-terminal" data-tab="terminal" class="tab-btn btn">Terminal</button>
      <button id="tab-btn-feedback" data-tab="feedback" class="tab-btn btn">Feedback</button>

      <div id="instructions" style="display:none">
        <div id="instructions-content"></div>
      </div>
      <div id="terminal" style="display:none">
        <div id="terminal-output"></div>
      </div>
      <div id="fdbk" style="display:none">
        <div id="feedback-content"></div>
      </div>
    </div>
  `
})

afterEach(() => {
    document.body.innerHTML = ''
    // Clear any global listeners added by the module
    try { window.removeEventListener('ssg:config-changed', () => { }) } catch (_e) { }
})

test('Instructions tab is focused when ssg:config-changed is dispatched', () => {
    // Initialize side tabs which will attach handlers and set default
    setupSideTabs()

    // Sanity: ensure instructions was the default selected
    const instrBtn = document.getElementById('tab-btn-instructions')
    expect(instrBtn.getAttribute('aria-selected')).toBe('true')

    // Simulate programmatic activation of a different tab
    activateSideTab('terminal')
    const termBtn = document.getElementById('tab-btn-terminal')
    expect(termBtn.getAttribute('aria-selected')).toBe('true')

    // Dispatch the global config-changed event
    const fakeConfig = { id: 'test', version: '1.0' }
    window.dispatchEvent(new CustomEvent('ssg:config-changed', { detail: { config: fakeConfig } }))

    // The terminal module should have focused the instructions tab
    expect(instrBtn.getAttribute('aria-selected')).toBe('true')
})
