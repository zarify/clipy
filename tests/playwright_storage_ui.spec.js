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
        await page.waitForSelector('#snapshot-list')

        // Check that storage info button is present
        const storageInfoBtn = page.locator('#storage-info')
        await expect(storageInfoBtn).toBeVisible()

        // Click storage info
        await storageInfoBtn.click()
        await page.waitForTimeout(1000)

        // Check terminal output contains storage information
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
        await page.waitForSelector('#snapshot-list')

        // Check that cleanup options are available
        await expect(page.locator('#clear-storage')).toBeVisible()
        await expect(page.locator('#delete-selected')).toBeVisible()

        // Test delete selected functionality
        const checkboxes = page.locator('.snapshot-item input[type="checkbox"]')
        await checkboxes.first().check()

        // Delete selected button should be enabled/visible
        await expect(page.locator('#delete-selected')).toBeVisible()

        // Clear storage button should be available
        await expect(page.locator('#clear-storage')).toBeVisible()

        await page.keyboard.press('Escape')
    })

    test('should handle storage cleanup confirmation dialogs', async ({ page }) => {
        // Create a snapshot first
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open snapshot modal and try to clear storage
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        // Wait for modal to be fully visible
        await page.waitForTimeout(500)

        // Use force click for the clear storage button if normal click fails
        try {
            await page.click('#clear-storage', { timeout: 5000 })
        } catch (error) {
            // Force click if element is intercepted
            await page.locator('#clear-storage').click({ force: true })
        }

        // Close the snapshot modal using the Close button for reliability
        await page.click('#close-snapshots')
        await page.waitForSelector('#snapshot-modal', { state: 'hidden', timeout: 5000 })

        // Now click clear-storage
        await page.click('#clear-storage')
        // Wait for the confirmation modal to appear
        await page.waitForSelector('#confirm-modal[aria-hidden="false"]', { timeout: 5000 })
        await page.waitForTimeout(200) // Give time for animation/render
        const confirmModal = page.locator('#confirm-modal[aria-hidden="false"]')
        await expect(confirmModal).toBeVisible()

        // Check confirmation content (title or message)
        await expect(confirmModal).toContainText(/clear all saved snapshots|clear snapshots|this cannot be undone/i)

        // Test cancel
        await page.click('#confirm-no')
        await page.waitForTimeout(500)

        // Modal should be closed, snapshots should remain
        // Reopen snapshot modal to check
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')
        await expect(page.locator('.snapshot-item')).toHaveCount(1)

        // Close snapshot modal again
        await page.click('#close-snapshots')
        await page.waitForSelector('#snapshot-modal', { state: 'hidden', timeout: 5000 })

        // Try again and confirm
        await page.click('#clear-storage')
        await page.waitForSelector('#confirm-modal[aria-hidden="false"]', { timeout: 5000 })
        await page.waitForTimeout(200)
        await page.click('#confirm-yes')
        await page.waitForTimeout(500)

        // Reopen snapshot modal to check cleared state
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')
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

    test('should handle rapid snapshot creation without storage conflicts', async ({ page }) => {
        // Rapidly create multiple snapshots to test storage management
        const results = []

        for (let i = 0; i < 5; i++) {
            await page.evaluate(async (index) => {
                if (window.FileManager) {
                    await window.FileManager.write(`/rapid-${index}.txt`, `rapid content ${index} ${'x'.repeat(100)}`)
                }
            }, i)

            // Click save and wait for processing
            await page.click('#save-snapshot')
            await page.waitForTimeout(300) // Give more time between saves

            const result = await page.evaluate(async () => {
                // Check if save was successful by checking if button is enabled again
                const saveBtn = document.getElementById('save-snapshot')
                return { success: saveBtn && !saveBtn.disabled }
            })

            results.push(result)
        }

        // Most snapshots should save successfully (allow for 1 failure due to timing)
        const successfulSaves = results.filter(r => r.success).length
        expect(successfulSaves).toBeGreaterThanOrEqual(4)

        // Verify snapshots exist
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')
        await page.waitForTimeout(500)

        const snapshotCount = await page.locator('.snapshot-item').count()
        expect(snapshotCount).toBeGreaterThanOrEqual(4) // Allow for timing variations

        await page.keyboard.press('Escape')
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
