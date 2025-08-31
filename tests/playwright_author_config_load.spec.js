const { test, expect } = require('./fixtures')

// End-to-end test: write an author config into localStorage and verify the
// main app loads every relevant field into runtime, UI, and storage keys.

const APP = 'http://localhost:8000'

test.describe('Author config integration', () => {
    test('loads author_config from localStorage and applies all fields', async ({ page }) => {
        await page.goto(APP)
        await page.waitForSelector('#editor-host')

        // Compose a comprehensive config object covering known fields
        const authorCfg = {
            id: 'playwright-author-test',
            version: '2.5',
            title: 'Playwright Author Config',
            description: 'A config used to test author loading',
            starter: "print('starter-run')",
            instructions: '# Hello\n\nThis is a **markdown** instruction.\n\n```python\nprint(1)\n```',
            links: [{ title: 'Help', url: 'https://example.com/help' }],
            runtime: { type: 'micropython', url: '/vendor/micropython.mjs' },
            execution: { timeoutSeconds: 45, maxOutputLines: 500 },
            feedback: [
                { id: 'f1', title: 'Hint', pattern: { type: 'regex', target: 'stdout', expression: 'starter-run' }, visibleByDefault: true }
            ],
            tests: [
                { id: 't1', description: 'basic print', setup: '', stdin: '', expected_stdout: 'starter-run', expected_stderr: '' }
            ],
            files: {
                '/main.py': "print('starter-run')",
                '/lib/util.py': "def helper():\n    return 42"
            }
        }

        // Inject author_config into localStorage before reload so app picks it up
        await page.evaluate((cfg) => {
            localStorage.setItem('author_config', JSON.stringify(cfg))
        }, authorCfg)

        // Reload the app so the UI can read the stored author_config via the
        // config modal. The app does not auto-apply author_config on startup,
        // so open the config modal and click the "Load author config" control.
        await page.reload()

        // Open the config modal by activating the header config-info / title line
        await page.click('.config-info')
        // Wait for the modal to populate and the author section button to appear
        await page.waitForSelector('.config-author-section button', { timeout: 3000 })
        // Click the Load author config button inside the modal
        await page.click('.config-author-section button')

        // Wait for the app to consider the config loaded (setCurrentConfig())
        await page.waitForFunction(() => window.Config && window.Config.current && window.Config.current.id === 'playwright-author-test', { timeout: 5000 })

        // Validate module-level config shape
        const loaded = await page.evaluate(() => {
            const cfg = window.Config && window.Config.current ? window.Config.current : null
            const out = { ok: !!cfg }
            if (!cfg) return out
            out.id = cfg.id
            out.version = cfg.version
            out.title = cfg.title
            out.description = cfg.description
            out.runtimeUrl = cfg.runtime && cfg.runtime.url
            out.exec = cfg.execution
            out.feedbackLen = Array.isArray(cfg.feedback) ? cfg.feedback.length : (cfg.feedback && (cfg.feedback.regex || cfg.feedback.ast) ? true : false)
            out.testsLen = Array.isArray(cfg.tests) ? cfg.tests.length : 0
            out.instructions = cfg.instructions
            try { out.snapshotKey = window.Config.getConfigKey() } catch (e) { out.snapshotKey = null }
            return out
        })

        expect(loaded.ok).toBe(true)
        expect(loaded.id).toBe('playwright-author-test')
        expect(loaded.version).toBe('2.5')
        expect(loaded.title).toBe('Playwright Author Config')
        expect(loaded.description).toBe('A config used to test author loading')
        expect(loaded.runtimeUrl).toMatch(/\.mjs|\.wasm$/)
        expect(loaded.exec.timeoutSeconds).toBe(45)
        expect(loaded.testsLen).toBeGreaterThanOrEqual(1)
        expect(loaded.feedbackLen).toBeTruthy()
        expect(loaded.instructions).toContain('# Hello')
        expect(loaded.snapshotKey).toMatch(/^snapshots_playwright-author-test@2\.5$/)

        // Verify UI header shows the identity
        const headerText = await page.locator('.config-title-line').textContent()
        expect(headerText).toContain('playwright-author-test@2.5')

        // Verify instructions rendered as markdown (some simple checks)
        const instrHtml = await page.locator('#instructions-content').innerHTML()
        expect(instrHtml).toContain('<h1')
        expect(instrHtml.toLowerCase()).toContain('<code')

        // Wait until FileManager shows our expected file (avoid fixed sleeps)
        await page.waitForFunction(() => {
            const fm = window.FileManager || (window.TabManager && window.TabManager.getFileManager && window.TabManager.getFileManager())
            if (!fm || typeof fm.list !== 'function') return false
            try {
                const list = fm.list()
                return Array.isArray(list) && list.includes('/lib/util.py')
            } catch (e) { return false }
        }, { timeout: 5000 })

        // Verify files were written into the in-memory FileManager
        const filesState = await page.evaluate(async () => {
            const fm = window.FileManager || (window.TabManager && window.TabManager.getFileManager && window.TabManager.getFileManager())
            const out = {}
            if (!fm) return out
            try {
                const list = fm.list()
                for (const p of list) {
                    try { out[p] = await fm.read(p) } catch (_e) { out[p] = null }
                }
            } catch (_e) { }
            return out
        })

        // Expect our files to be present
        expect(filesState['/main.py']).toBe("print('starter-run')")
        expect(filesState['/lib/util.py']).toBeDefined()
        expect(filesState['/lib/util.py']).toContain('def helper')

        // Ensure snapshot key exists in localStorage after a save snapshot operation
        await page.click('#save-snapshot')
        await page.waitForTimeout(400)
        const hasSnapshots = await page.evaluate(() => {
            const k = window.Config.getConfigKey()
            const val = localStorage.getItem(k)
            return val ? JSON.parse(val) : null
        })
        expect(hasSnapshots).toBeTruthy()
        expect(Array.isArray(hasSnapshots)).toBe(true)

        // Confirm feedback UI has the run-tests button enabled (because tests exist)
        const runBtnDisabled = await page.locator('#run-tests-btn').isDisabled()
        expect(runBtnDisabled).toBe(false)
    })
})
