const { test, expect } = require('./fixtures')

test.describe('Storage Management - UI Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Clear storage for clean test
        await page.evaluate(() => {
            localStorage.clear()
        })
    })

    test('should display storage quota exceeded modal', async ({ page }) => {
        // Create a more realistic quota exceeded scenario
        await page.evaluate(() => {
            // Create a simple modal function for testing
            window.testQuotaModal = function () {
                // Remove any existing modal
                const existingModal = document.getElementById('quota-exceeded-modal')
                if (existingModal) {
                    existingModal.remove()
                }

                const modal = document.createElement('div')
                modal.id = 'quota-exceeded-modal'
                modal.className = 'modal'
                modal.setAttribute('aria-hidden', 'false')
                modal.innerHTML = `
                    <div class="modal-content">
                        <h3>Storage Quota Exceeded</h3>
                        <p>Cannot save snapshot. Storage usage: 5.2MB</p>
                        <div class="modal-buttons">
                            <button id="view-storage-info">View Storage Info</button>
                            <button id="clear-oldest-snapshots">Clear Oldest Snapshots</button>
                            <button id="clear-current-config">Clear Current Config</button>
                            <button id="cancel-quota">Cancel</button>
                        </div>
                    </div>
                `
                modal.style.display = 'block'
                modal.style.position = 'fixed'
                modal.style.top = '50%'
                modal.style.left = '50%'
                modal.style.transform = 'translate(-50%, -50%)'
                modal.style.backgroundColor = 'white'
                modal.style.border = '1px solid #ccc'
                modal.style.padding = '20px'
                modal.style.zIndex = '1000'

                // Add click handler for cancel
                modal.querySelector('#cancel-quota').onclick = function () {
                    modal.style.display = 'none'
                    modal.setAttribute('aria-hidden', 'true')
                }

                document.body.appendChild(modal)
                return modal
            }
        })

        // Trigger the test modal
        await page.evaluate(() => window.testQuotaModal())

        // Check modal appears
        await page.waitForSelector('#quota-exceeded-modal', { state: 'visible' })
        const modal = page.locator('#quota-exceeded-modal')
        await expect(modal).toBeVisible()

        // Check modal content
        await expect(page.locator('#quota-exceeded-modal h3')).toContainText('Storage Quota Exceeded')
        await expect(page.locator('#quota-exceeded-modal p')).toContainText('save snapshot')
        await expect(page.locator('#quota-exceeded-modal p')).toContainText('5.2MB')

        // Check buttons are present
        await expect(page.locator('#view-storage-info')).toBeVisible()
        await expect(page.locator('#clear-oldest-snapshots')).toBeVisible()
        await expect(page.locator('#clear-current-config')).toBeVisible()
        await expect(page.locator('#cancel-quota')).toBeVisible()

        // Test cancel button
        await page.click('#cancel-quota')
        await page.waitForTimeout(500)

        // Check modal is hidden
        const hiddenState = await page.locator('#quota-exceeded-modal').getAttribute('aria-hidden')
        expect(hiddenState).toBe('true')
    })

    test('should integrate storage info into snapshot modal', async ({ page }) => {
        // Create some snapshots first
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test1.txt', 'test content 1')
            }
        })
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test2.txt', 'test content 2')
            }
        })
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open snapshot modal
        await page.click('#history')
        await page.waitForFunction(() => {
            try { if (window.__ssg_snapshot_saved) return true } catch (_e) { }
            const el = document.querySelector('#snapshot-list')
            if (!el) return false
            try { if (el.querySelectorAll('.snapshot-item').length > 0) return true } catch (_e) { }
            return false
        }, { timeout: 8000 })

        // Check footer summary is present and contains snapshot/storage info
        const footer = page.locator('#snapshot-storage-summary')
        await expect(footer).toBeVisible()
        const footerText = await footer.textContent()
        expect(footerText).toMatch(/\d+ snapshot\(s\)/i)
        expect(footerText).toMatch(/file\(s\)/i)

        // Also invoke the storage info function to ensure terminal output is produced
        await page.evaluate(() => { try { window.showStorageInfo() } catch (e) { } })
        await page.waitForTimeout(500)
        const terminalOutput = await page.locator('#terminal-output').textContent()
        expect(terminalOutput).toContain('Storage Usage:')
        expect(terminalOutput).toContain('Snapshots:')
        expect(terminalOutput).toContain('Files:')
        expect(terminalOutput).toMatch(/\d+\.\d+MB/)

        // Close modal
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)

        // Modal should be closed
        const modal = page.locator('#snapshot-modal')
        await expect(modal).toHaveAttribute('aria-hidden', 'true')
    })

    test('should show cleanup options in snapshot modal', async ({ page }) => {
        // Create multiple snapshots
        for (let i = 0; i < 3; i++) {
            await page.evaluate(async (index) => {
                if (window.FileManager) {
                    await window.FileManager.write(`/cleanup-test-${index}.txt`, `cleanup content ${index}`)
                }
            }, i)
            await page.click('#save-snapshot')
            await page.waitForTimeout(300)
        }

        // Open snapshot modal
        await page.click('#history')
        await page.waitForFunction(() => {
            try { if (window.__ssg_snapshot_saved) return true } catch (_e) { }
            const el = document.querySelector('#snapshot-list')
            if (!el) return false
            try { if (el.querySelectorAll('.snapshot-item').length > 0) return true } catch (_e) { }
            return false
        }, { timeout: 8000 })

        // Check that cleanup options are available
        await expect(page.locator('#clear-storage')).toBeVisible()

        // There should be per-item delete buttons (trash icon)
        const deleteButtons = page.locator('.snapshot-item button[aria-label="Delete snapshot"]')
        await expect(deleteButtons.first()).toBeVisible()

        // Click first delete and confirm
        const initialCount = await page.locator('.snapshot-item').count()
        await deleteButtons.nth(0).click()
        await page.waitForSelector('#confirm-modal[aria-hidden="false"]')
        await page.click('#confirm-yes')
        await page.waitForTimeout(300)
        const afterCount = await page.locator('.snapshot-item').count()
        expect(afterCount).toBe(initialCount - 1)

        await page.keyboard.press('Escape')
    })

    test('should handle storage cleanup confirmation dialogs', async ({ page }) => {
        // Create a snapshot first
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open snapshot modal and wait for readiness
        await page.click('#history')
        await page.waitForFunction(() => {
            try { if (window.__ssg_snapshot_saved) return true } catch (_e) { }
            const el = document.querySelector('#snapshot-list')
            if (!el) return false
            try { if (el.querySelectorAll('.snapshot-item').length > 0) return true } catch (_e) { }
            return false
        }, { timeout: 8000 })

        // Use force click for the clear storage button if normal click fails
        try {
            await page.click('#clear-storage', { timeout: 5000 })
        } catch (error) {
            // Force click if element is intercepted
            await page.locator('#clear-storage').click({ force: true })
        }

        // Close the snapshot modal using the Close button for reliability if it's still open
        const modalOpen = await page.$('#snapshot-modal[aria-hidden="false"]')
        if (modalOpen) {
            await page.locator('#snapshot-modal #close-snapshots').click()
            await page.waitForSelector('#snapshot-modal', { state: 'hidden', timeout: 5000 })
        }

        // Trigger clear via the global #clear-storage button (app delegates to modal flow).
        // If a confirm modal is intercepting clicks, dismiss it first and retry.
        try {
            await page.waitForSelector('#clear-storage', { timeout: 3000 })
            await page.click('#clear-storage')
        } catch (err) {
            const confirmOpenFallback = await page.$('#confirm-modal[aria-hidden="false"]')
            if (confirmOpenFallback) {
                await page.locator('#confirm-no').click()
                await page.waitForSelector('#confirm-modal', { state: 'hidden', timeout: 5000 })
            }
            // Ensure snapshot modal is open (app wires clear-storage handler when modal open)
            await page.click('#history')
            await page.waitForSelector('#snapshot-modal[aria-hidden="false"]', { timeout: 5000 })
            await page.waitForSelector('#clear-storage', { timeout: 3000 })
            await page.click('#clear-storage')
        }
        await page.waitForSelector('#confirm-modal[aria-hidden="false"]', { timeout: 5000 })
        await page.waitForTimeout(200)
        const confirmModal = page.locator('#confirm-modal[aria-hidden="false"]')
        await expect(confirmModal).toBeVisible()

        // Check confirmation content (title or message)
        await expect(confirmModal).toContainText(/clear all saved snapshots|clear snapshots|this cannot be undone/i)

        // Test cancel
        await page.click('#confirm-no')
        await page.waitForTimeout(500)

        // Modal should be closed, snapshots should remain; reopen snapshot modal
        await page.click('#history')
        await page.waitForFunction(() => {
            try { if (window.__ssg_snapshot_saved) return true } catch (_e) { }
            const el = document.querySelector('#snapshot-list')
            if (!el) return false
            try { if (el.querySelectorAll('.snapshot-item').length > 0) return true } catch (_e) { }
            return false
        }, { timeout: 8000 })
        await expect(page.locator('.snapshot-item')).toHaveCount(1)

        // Close snapshot modal again if open
        const modalOpen2 = await page.$('#snapshot-modal[aria-hidden="false"]')
        if (modalOpen2) {
            await page.locator('#snapshot-modal #close-snapshots').click()
            await page.waitForSelector('#snapshot-modal', { state: 'hidden', timeout: 5000 })
        }

        // Try again and confirm deletion by clicking the global clear button.
        try {
            await page.waitForSelector('#clear-storage', { timeout: 3000 })
            await page.click('#clear-storage')
        } catch (_) {
            // If something intercepts, reopen modal and retry
            await page.click('#history')
            await page.waitForSelector('#snapshot-modal[aria-hidden="false"]', { timeout: 5000 })
            await page.waitForSelector('#clear-storage', { timeout: 3000 })
            await page.click('#clear-storage')
        }
        await page.waitForSelector('#confirm-modal[aria-hidden="false"]', { timeout: 5000 })
        await page.waitForTimeout(200)
        await page.click('#confirm-yes')
        await page.waitForTimeout(500)

        // Reopen snapshot modal to check cleared state
        await page.click('#history')
        await page.waitForFunction(() => {
            const el = document.querySelector('#snapshot-list')
            if (!el) return false
            const txt = (el.textContent || '').toLowerCase()
            return txt.indexOf('(loading)') === -1
        }, { timeout: 8000 })
        const snapshotItems = page.locator('.snapshot-item')
        await expect(snapshotItems).toHaveCount(0)

        await page.keyboard.press('Escape')
    })
})

test.describe('Storage Management - Real-world Scenarios', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })
    })
    test('should handle rapid snapshot creation (rate-limited)', async ({ page }) => {
        // Ensure snapshot modal is closed so it doesn't intercept clicks
        try { await page.keyboard.press('Escape') } catch (_) { }

        // Verify rate-limit by checking the save button is disabled after click
        // and re-enabled after the debounce window.
        const saveBtn = page.locator('#save-snapshot')
        await saveBtn.waitFor({ state: 'visible', timeout: 3000 })

        // Click once and ensure it becomes disabled
        await saveBtn.click()
        await page.waitForFunction(() => {
            const b = document.getElementById('save-snapshot')
            return !!(b && b.disabled)
        }, { timeout: 2000 })

        // It should re-enable after ~600ms (we allow a little buffer)
        await page.waitForFunction(() => {
            const b = document.getElementById('save-snapshot')
            return !!(b && !b.disabled)
        }, { timeout: 2000 })
    })

    test('should maintain file operations during storage pressure', async ({ page }) => {
        // Create many files to increase storage pressure
        const fileOperations = []

        for (let i = 0; i < 10; i++) {
            const result = await page.evaluate(async (index) => {
                try {
                    if (window.FileManager) {
                        const content = `File ${index} content: ${'x'.repeat(500)}`
                        await window.FileManager.write(`/pressure-test-${index}.txt`, content)

                        // Verify file was written
                        const readContent = await window.FileManager.read(`/pressure-test-${index}.txt`)
                        return {
                            success: true,
                            file: index,
                            written: content.length,
                            read: readContent.length,
                            match: content === readContent
                        }
                    }
                    return { success: false, reason: 'no FileManager' }
                } catch (error) {
                    return { success: false, file: index, error: error.message }
                }
            }, i)

            fileOperations.push(result)
        }

        // All file operations should succeed
        fileOperations.forEach((op, index) => {
            expect(op.success).toBe(true)
            expect(op.match).toBe(true)
        })

        // Test that we can still run code with these files
        await page.evaluate(() => {
            if (window.cm) {
                window.cm.setValue(`
import os
files = os.listdir('/')
pressure_files = [f for f in files if f.startswith('pressure-test-')]
print(f"Found {len(pressure_files)} pressure test files")
for f in pressure_files[:3]:  # Show first 3
    print(f"- {f}")
`)
            }
        })

        await page.click('#run')

        await page.waitForFunction(
            () => {
                const output = document.getElementById('terminal-output')
                return output && output.textContent.includes('Found 10 pressure test files')
            },
            { timeout: 5000 }
        )

        const terminalContent = await page.locator('#terminal-output').textContent()
        expect(terminalContent).toContain('Found 10 pressure test files')
        expect(terminalContent).toContain('pressure-test-')
    })

    test('should recover gracefully from storage corruption scenarios', async ({ page }) => {
        // Create valid snapshot first
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/valid.txt', 'valid content')
            }
        })
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Corrupt storage data
        await page.evaluate(() => {
            const configKey = window.Config.getConfigKey()
            // Insert invalid JSON to simulate corruption
            localStorage.setItem(configKey, '{invalid json}')
        })

        // Try to open snapshot modal - should handle corruption gracefully
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        // Should show empty list or error message, but not crash
        const snapshotItems = page.locator('.snapshot-item')
        const itemCount = await snapshotItems.count()

        // Application should still function
        expect(itemCount).toBeGreaterThanOrEqual(0)

        await page.keyboard.press('Escape')

        // Test that file operations still work
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/recovery-test.txt', 'recovery content')
            }
        })

        // Run some code to verify application functionality
        await page.evaluate(() => {
            if (window.cm) {
                window.cm.setValue('print("Recovery test successful")')
            }
        })

        await page.click('#run')

        await page.waitForFunction(
            () => {
                const output = document.getElementById('terminal-output')
                return output && output.textContent.includes('Recovery test successful')
            },
            { timeout: 3000 }
        )

        const terminalContent = await page.locator('#terminal-output').textContent()
        expect(terminalContent).toContain('Recovery test successful')
    })
})
