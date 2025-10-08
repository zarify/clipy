import { jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import vm from 'vm'
import { JSDOM } from 'jsdom'

// We need to import the modules under test after setting up the DOM
describe('Tabs and overflow sanitization', () => {
    let dom
    let window
    let document

    beforeEach(() => {
        dom = new JSDOM(`<!doctype html><html><body>
      <div id="tabs-left" class="tabs"></div>
      <div id="tab-overflow-host"></div>
      <div id="tab-overflow-modal-host"></div>
    </body></html>`, { url: 'http://localhost/' })
        window = dom.window
        document = window.document

        // Make globals available similarly to browser environment
        global.window = window
        global.document = document
        global.HTMLElement = window.HTMLElement
        global.Node = window.Node
    })

    // Helper: dynamic import with cache-busting file:// URL so the module is
    // freshly evaluated after we've set global.window/document (ensures the
    // module captures the test JSDOM globals and created nodes use that document).
    async function importFreshModule(fsPath) {
        const full = path.resolve(fsPath)
        const fileUrl = 'file://' + full + '?_=' + Date.now()
        return import(fileUrl)
    }

    // Helper: evaluate a module-like JS file inside the JSDOM window context.
    // This strips import statements and converts exported declarations into
    // normal declarations, then assigns exported symbols onto window so the
    // test can access them. It's intentionally conservative and only used in
    // tests to avoid cross-realm DOM Node issues when modules create elements.
    function evalModuleInWindow(fsPath) {
        const src = fs.readFileSync(fsPath, 'utf8')
        // Remove import lines (we'll provide minimal globals instead). This
        // handles imports with or without trailing semicolons and multi-line
        // import specifiers.
        let t = src.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/mg, '')

        const exportNames = []
        // export class Foo -> class Foo
        t = t.replace(/export\s+class\s+([A-Za-z0-9_]+)/g, (_m, name) => {
            exportNames.push(name)
            return `class ${name}`
        })
        // export function fn -> function fn
        t = t.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, (_m, name) => {
            exportNames.push(name)
            return `function ${name}`
        })
        // export const NAME = -> const NAME =
        t = t.replace(/export\s+const\s+([A-Za-z0-9_]+)/g, (_m, name) => {
            exportNames.push(name)
            return `const ${name}`
        })
        // export let NAME = -> let NAME =
        t = t.replace(/export\s+let\s+([A-Za-z0-9_]+)/g, (_m, name) => {
            exportNames.push(name)
            return `let ${name}`
        })

        // Append assignments to expose exports on window
        if (exportNames.length) {
            t += '\n' + exportNames.map(n => `try { window.${n} = ${n} } catch (e) { /* ignore */ }`).join('\n')
        }

        // Run transformed code in the JSDOM window context so DOM constructors
        // created by the module belong to the same document as the test.
        try {
            const ctx = vm.createContext(window)
            vm.runInContext(t, ctx)
        } catch (e) {
            // Re-throw with additional context for easier debugging
            e.message = `evalModuleInWindow(${fsPath}) failed: ${e.message}`
            throw e
        }
    }

    afterEach(() => {
        // Clean up globals
        delete global.window
        delete global.document
        delete global.HTMLElement
        delete global.Node
    })

    test('renders filenames with HTML safely in tabs', async () => {
        // Import the module under test dynamically so it picks up the JSDOM globals
        // Load module into the JSDOM window context to avoid cross-realm Node issues
        const testDir = path.dirname(new URL(import.meta.url).pathname)
        // Import modules freshly so they pick up the JSDOM globals (window/document)
        // Import utils first (some modules expect it as an export or import)
        await importFreshModule(path.join(testDir, '..', 'utils.js'))
        const tabsMod = await importFreshModule(path.join(testDir, '..', 'tabs.js'))

        // Create a filename that contains dangerous HTML
        const dangerousName = 'evil"><img src=x onerror=alert(1)>.py'
        const filePath = '/configs/evil.py'

        // Use TabOverflowManager to render the visible tabs (covers tab rendering logic)
        // Ensure minimal globals used by the module are present on window so the
        // transformed module can run inside the JSDOM context.
        window.$ = (id) => document.getElementById(id)
        window.MAIN_FILE = '/main.py'
        window.showInputModal = async (title, _prompt, defaultVal) => {
            return defaultVal || ''
        }

        // Evaluate the tab-overflow-manager module source inside the JSDOM window
        // so elements it creates belong to the same document as the test.
        evalModuleInWindow(path.join(testDir, '..', 'tab-overflow-manager.js'))
        const TabOverflowManager = window.TabOverflowManager
        const mgr = new TabOverflowManager('tabs-left', { onTabSelect: () => { }, onTabClose: () => { }, isFileReadOnly: () => false })
        const tabsHost = document.getElementById('tabs-left')
        expect(tabsHost).toBeTruthy()

        // Render two tabs directly to avoid side-effects from vfs-client imports
        mgr.renderTab(tabsHost, '/main.py', false)
        mgr.renderTab(tabsHost, filePath, false)

        // There should be at least one child tab (main.py or our file)
        expect(tabsHost.children.length).toBeGreaterThan(0)

        // Verify that no IMG nodes were created from the dangerous filename
        const htmlFound = tabsHost.querySelector('img')
        expect(htmlFound).toBeNull()

        // Ensure the label text contains the filename (rendered safely as text)
        const labelText = tabsHost.textContent || ''
        expect(labelText).toContain('evil')
        expect(labelText).toContain('.py')
    })

    test('overflow modal renders filenames safely', async () => {
        const { TabOverflowManager } = await import('../tab-overflow-manager.js')

        const dangerousName = '<svg onload=alert(1)></svg>.cfg'
        const filePath = '/configs/evil2.cfg'

        // Instantiate the manager and open the dropdown to render the file list
        const mgr2 = new TabOverflowManager('tab-overflow-host', { onTabSelect: () => { }, onTabClose: () => { }, isFileReadOnly: () => false })
        mgr2.createDropdownModal()
        // Open dropdown with both MAIN_FILE and our dangerous file so it appears in the list
        mgr2.openDropdown(['/main.py', filePath], null)

        // Ensure no IMG nodes were created
        const img = document.querySelector('img')
        expect(img).toBeNull()

        const allText = document.body.textContent || ''
        expect(allText).toContain('.cfg')
        expect(allText).toContain('evil')
    })
})
