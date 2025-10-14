/**
 * Tests for markdown rendering in feedback UI
 * - verifies that author-provided markdown in titles, matched messages,
 *   pass/fail feedback and failureMessage are rendered as HTML (i.e., markdown)
 *   rather than raw text.
 *
 * We run these tests using Jest with the project's default JSDOM test environment.
 */

import fs from 'fs'
import path from 'path'
import { JSDOM } from 'jsdom'

// Load the utils and feedback-ui modules using a DOM environment
// We'll create a simple document and then import the script under test.

describe('feedback-ui markdown rendering', () => {
    let dom
    let window
    let document
    let feedbackUI
    let utils

    beforeAll(async () => {
        // Create a fresh JSDOM environment and load supporting vendor scripts
        dom = new JSDOM(`<!doctype html><html><head></head><body>
      <div id="fdbk-list"></div>
    </body></html>`, { runScripts: 'dangerously', resources: 'usable' })
        window = dom.window
        document = window.document

        // Provide global DOM APIs expected by the project's modules
        global.window = window
        global.document = document
        global.HTMLElement = window.HTMLElement

        // Mock the minimal '$' helper used in utils (if the module expects it internally)
        // Import utils and feedback-ui via dynamic import so they evaluate in Node's module system
        const utilsPath = path.resolve(process.cwd(), 'src/js/utils.js')
        const feedbackUIPath = path.resolve(process.cwd(), 'src/js/feedback-ui.js')

        // Copy the files into the JSDOM window by loading their content and evaluating
        // but instead we import them via Node import; since they rely on DOM, our globals should be ok.
        utils = await import(utilsPath)
        feedbackUI = await import(feedbackUIPath)

        // Initialize the UI (exposes some global functions used by the module)
        try { feedbackUI.initializeFeedbackUI() } catch (e) { /* ignore init errors in test harness */ }
    })

    afterAll(() => {
        if (dom && dom.window) dom.window.close()
        delete global.window
        delete global.document
        delete global.HTMLElement
    })

    test('renders feedback entry title as markdown', () => {
        const cfg = { feedback: [{ id: 'f1', title: '**Bold Title**' }] }
        feedbackUI.setFeedbackConfig(cfg)

        const host = document.getElementById('fdbk-list')
        expect(host).toBeTruthy()
        // find rendered title element
        const titleEl = host.querySelector('.feedback-title')
        expect(titleEl).toBeTruthy()
        // Markdown bold should render as <strong> or <b>
        const inner = titleEl.innerHTML
        expect(/<strong>|<b>/.test(inner)).toBe(true)
    })

    test('renders matched.message as markdown', () => {
        const cfg = { feedback: [{ id: 'm1', title: 'match test' }] }
        feedbackUI.setFeedbackConfig(cfg)
        // set a match with markdown in message
        const matches = [{ id: 'm1', message: '`code` inline' }]
        feedbackUI.setFeedbackMatches(matches)

        const host = document.getElementById('fdbk-list')
        const msgEl = host.querySelector('.feedback-msg-matched')
        expect(msgEl).toBeTruthy()
        expect(msgEl.innerHTML.includes('<code>')).toBe(true)
    })

    test('renders test pass/fail feedback and failureMessage as markdown in modal rows', () => {
        // Create a config with one test
        const cfg = { tests: [{ id: 't1', description: 'T1', pass_feedback: '**Yay**', fail_feedback: '*Oh no*', failureMessage: 'Failure: `x`' }] }
        feedbackUI.setFeedbackConfig(cfg)

        // Create results with a failing test and meta attached
        const results = [{ id: 't1', passed: false, stdout: '', stderr: '', skipped: false, meta: cfg.tests[0] }]
        feedbackUI.setTestResults(results)

        // Open modal (this builds the modal content)
        try { feedbackUI.showOrUpdateTestResultsModal(results) } catch (e) { }
        const modal = document.getElementById('test-results-modal')
        expect(modal).toBeTruthy()

        // Look for fail feedback and failureMessage rendered
        const failFeedback = modal.querySelector('.test-fail-feedback')
        expect(failFeedback).toBeTruthy()
        expect(/<em>|<i>/.test(failFeedback.innerHTML)).toBe(true)

        const failureMessage = modal.querySelector('.test-failure-message')
        expect(failureMessage).toBeTruthy()
        expect(failureMessage.innerHTML.includes('<code>') || failureMessage.innerHTML.includes('<code')).toBe(true)
    })

    test('sanitizes dangerous HTML in author-provided content', () => {
        const host = document.getElementById('fdbk-list')
        // Title sanitization: malicious attributes and script tags should be removed
        const cfg = { feedback: [{ id: 'sf1', title: '**Safe** <img src=x onerror="window.__x=1"><script>window.__x2=1</script>' }] }
        feedbackUI.setFeedbackConfig(cfg)
        const titleEl = host.querySelector('.feedback-title')
        expect(titleEl).toBeTruthy()
        const inner = titleEl.innerHTML
        // No raw <script> tags or event attributes should remain
        expect(/<script/i.test(inner)).toBe(false)
        expect(/onerror/i.test(inner)).toBe(false)
        expect(/javascript:/i.test(inner)).toBe(false)
        // Markdown rendering should still occur
        expect(/<strong>|<b>/.test(inner)).toBe(true)

        // Matched message sanitization: javascript: links and onerror removed
        feedbackUI.setFeedbackConfig({ feedback: [{ id: 'ms1', title: 'm' }] })
        feedbackUI.setFeedbackMatches([{ id: 'ms1', message: '[link](javascript:alert(1)) <img src=x onerror="window.__y=1" />' }])
        const msgEl = host.querySelector('.feedback-msg-matched')
        expect(msgEl).toBeTruthy()
        const msgHTML = msgEl.innerHTML
        expect(/javascript:/i.test(msgHTML)).toBe(false)
        expect(/onerror/i.test(msgHTML)).toBe(false)

        // Modal sanitization: fail_feedback and failureMessage should be cleaned
        const cfg2 = { tests: [{ id: 'st1', description: 'ST1', fail_feedback: 'Oops <img src=x onerror="alert(1)">', failureMessage: '<script>window.__z=1</script>Bad' }] }
        feedbackUI.setFeedbackConfig(cfg2)
        const results = [{ id: 'st1', passed: false, stdout: '', stderr: '', skipped: false, meta: cfg2.tests[0] }]
        feedbackUI.setTestResults(results)
        try { feedbackUI.showOrUpdateTestResultsModal(results) } catch (e) { }
        const modal = document.getElementById('test-results-modal')
        expect(modal).toBeTruthy()
        const failFeedback = modal.querySelector('.test-fail-feedback')
        expect(failFeedback).toBeTruthy()
        expect(/<script/i.test(failFeedback.innerHTML)).toBe(false)
        expect(/onerror/i.test(failFeedback.innerHTML)).toBe(false)
        const failureMessage = modal.querySelector('.test-failure-message')
        expect(failureMessage).toBeTruthy()
        expect(/<script/i.test(failureMessage.innerHTML)).toBe(false)
    })
})
