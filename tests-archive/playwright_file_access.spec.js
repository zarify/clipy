const { test, expect } = require('./fixtures')

// Requires a static server at http://localhost:8000
test('file access: opening and reading foo.txt from main.py', async ({ page }) => {
  await page.goto('http://localhost:8000')
  await page.waitForSelector('#editor-host')

  // Create foo.txt in the persistent FileManager or VFS backend
  await page.evaluate(() => {
    const content = 'hello world'
    try { if (window.FileManager) return window.FileManager.write('/foo.txt', content) } catch (e) { }
    try { if (window.__ssg_vfs_backend) return window.__ssg_vfs_backend.write('/foo.txt', content) } catch (e) { }
  })

  // Give the UI/VFS a moment to settle so pre-run sync sees the new file
  // Wait for VFS readiness so pre-run sync will see the new file
  await page.evaluate(() => window.__ssg_vfs_ready)

  // Ensure the runtime FS sees the file: if runtime FS is present, write directly; otherwise ask backend to mount
  await page.evaluate(async () => {
    const content = 'hello world'
    try {
      if (window.__ssg_runtime_fs && typeof window.__ssg_runtime_fs.writeFile === 'function') {
        try { window.__ssg_runtime_fs.mkdir('/'); } catch (_) { }
        try { window.__ssg_runtime_fs.writeFile('/foo.txt', content) } catch (_) { }
        return
      }
    } catch (_) { }
    try { if (window.__ssg_vfs_backend && typeof window.__ssg_vfs_backend.mountToEmscripten === 'function' && window.__ssg_runtime_fs) await window.__ssg_vfs_backend.mountToEmscripten(window.__ssg_runtime_fs) } catch (e) { }
  })

  // Wait until the runtime-visible FS contains /foo.txt to avoid racy mounts
  try {
    await page.evaluate(() => window.waitForFile && window.waitForFile('/foo.txt', 3000))
  } catch (e) { /* best-effort */ }

  // Write main.py to open and print the file contents
  const userCode = 'with open("foo.txt") as f:\n    data = f.read()\n    print(f"File contents: {data}")'
  await page.evaluate((code) => {
    try { if (window.FileManager) return window.FileManager.write('/main.py', code) } catch (e) { }
    try { if (window.__ssg_vfs_backend) return window.__ssg_vfs_backend.write('/main.py', code) } catch (e) { }
  }, userCode)
  // Wait for backend sync/readiness after writing main.py
  await page.evaluate(() => window.__ssg_vfs_ready)
  // Ensure the editor is showing main.py and contains the user code so Run will execute it
  await page.evaluate((code) => {
    try { if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab('main.py') } catch (e) { }
    try { if (window.cm) window.cm.setValue(code); else document.getElementById('code').value = code } catch (e) { }
  }, userCode)

  // Run the program
  await page.click('#run')
  // wait briefly for runtime to start and produce output
  await page.waitForTimeout(800)

  // Inspect terminal for expected content and absence of the OSError seen previously
  const terminal = await page.$eval('#terminal-output', el => el.textContent)
  // Should print the file contents
  expect(terminal).toContain('File contents: hello world')
  // Should not raise the OSError 44 observed earlier
  expect(terminal).not.toContain('OSError: 44')
})
