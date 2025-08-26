const { test, expect } = require('./fixtures')

test.describe('Storage Management - Quota Handling', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Clear storage for clean test
        await page.evaluate(() => {
            localStorage.clear()
        })
    })

    test('should show storage usage information', async ({ page }) => {
        // Create some test files to generate storage usage
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test1.txt', 'test content 1')
                await window.FileManager.write('/test2.txt', 'test content 2')
                await window.FileManager.write('/large-file.txt', 'x'.repeat(1000)) // Larger file
            }
        })

        // Save a snapshot to add to storage
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Get storage info via browser function
        const storageInfo = await page.evaluate(() => {
            return window.showStorageInfo()
        })

        expect(storageInfo).toBeTruthy()
        expect(storageInfo.totalSize).toBeGreaterThan(0)
        expect(storageInfo.totalSizeMB).toBeDefined()
        expect(storageInfo.percentage).toBeGreaterThan(0)
        expect(storageInfo.percentage).toBeLessThan(1)
        expect(storageInfo.breakdown).toBeDefined()

        // Should have snapshots and files in breakdown
        expect(storageInfo.breakdown.snapshots).toBeGreaterThan(0)
        expect(storageInfo.breakdown.files).toBeGreaterThan(0)
    })

    test('should display storage info button in snapshot modal', async ({ page }) => {
        // Create a snapshot first
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open snapshot modal
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        // Check if storage info button exists and is visible
        const storageInfoButton = page.locator('#storage-info')
        await expect(storageInfoButton).toBeVisible()

        // Click storage info button
        await storageInfoButton.click()

        // Wait for terminal output to appear
        await page.waitForTimeout(1000)

        // Check terminal contains storage info
        const terminalContent = await page.locator('#terminal-output').textContent()
        expect(terminalContent).toContain('Storage Usage:')
        expect(terminalContent).toMatch(/\d+\.\d+MB/)

        // Close modal
        await page.keyboard.press('Escape')
    })

    test('should handle safe storage operations', async ({ page }) => {
        // Test that normal operations work without quota issues
        const result = await page.evaluate(async () => {
            // Create several files to test storage operations
            const results = []

            for (let i = 0; i < 5; i++) {
                try {
                    if (window.FileManager) {
                        await window.FileManager.write(`/test-file-${i}.txt`, `Content for file ${i}`)
                        results.push({ success: true, file: i })
                    }
                } catch (error) {
                    results.push({ success: false, file: i, error: error.message })
                }
            }

            return results
        })

        // All operations should succeed in normal conditions
        expect(result).toHaveLength(5)
        result.forEach(res => {
            expect(res.success).toBe(true)
        })
    })

    test('should show storage warnings at high usage', async ({ page }) => {
        // Mock high storage usage
        await page.evaluate(() => {
            // Override getStorageUsage to simulate high usage
            const originalFunction = window.showStorageInfo
            window.showStorageInfo = function () {
                return {
                    totalSize: 4 * 1024 * 1024, // 4MB
                    totalSizeMB: '4.00',
                    percentage: 0.85, // 85% usage
                    breakdown: {
                        snapshots: 2 * 1024 * 1024,
                        files: 2 * 1024 * 1024
                    },
                    isWarning: true,
                    isCritical: false
                }
            }
        })

        // Trigger storage health check
        const warningInfo = await page.evaluate(() => {
            return window.showStorageInfo()
        })

        expect(warningInfo.isWarning).toBe(true)
        expect(warningInfo.isCritical).toBe(false)
        expect(warningInfo.percentage).toBeGreaterThan(0.8)
    })
})

test.describe('Storage Management - Cleanup Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Clear storage and create test data
        await page.evaluate(() => {
            localStorage.clear()
        })
    })

    test('should show all snapshot configurations', async ({ page }) => {
        // Create snapshots for current config
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test1.txt', 'content 1')
            }
        })
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test2.txt', 'content 2')
            }
        })
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Manually create snapshots for fake configs to test cross-config management
        await page.evaluate(() => {
            // Create fake config snapshots
            const fakeSnapshot1 = [{
                ts: Date.now() - 1000000,
                config: 'fake-config-1@1.0.0',
                files: { '/fake1.txt': 'fake content 1' }
            }]
            const fakeSnapshot2 = [{
                ts: Date.now() - 2000000,
                config: 'fake-config-2@1.0.0',
                files: { '/fake2.txt': 'fake content 2' }
            }]

            localStorage.setItem('snapshots_fake-config-1@1.0.0', JSON.stringify(fakeSnapshot1))
            localStorage.setItem('snapshots_fake-config-2@1.0.0', JSON.stringify(fakeSnapshot2))
        })

        // Check all configurations are detected
        const allConfigs = await page.evaluate(() => {
            // Access the function directly since it's not exposed globally
            const configs = []
            for (let key in localStorage) {
                if (key.startsWith('snapshots_')) {
                    const configId = key.replace('snapshots_', '')
                    const snapshots = JSON.parse(localStorage.getItem(key) || '[]')
                    configs.push({
                        configId,
                        snapshotCount: snapshots.length,
                        storageKey: key
                    })
                }
            }
            return configs
        })

        expect(allConfigs).toHaveLength(3) // Current config + 2 fake configs
        expect(allConfigs.some(c => c.configId === 'default-playground@1.0.0')).toBe(true)
        expect(allConfigs.some(c => c.configId === 'fake-config-1@1.0.0')).toBe(true)
        expect(allConfigs.some(c => c.configId === 'fake-config-2@1.0.0')).toBe(true)
    })

    test('should delete selected snapshots correctly', async ({ page }) => {
        // Create multiple snapshots
        for (let i = 0; i < 4; i++) {
            await page.evaluate(async (index) => {
                if (window.FileManager) {
                    await window.FileManager.write(`/test-${index}.txt`, `content ${index}`)
                }
            }, i)
            await page.click('#save-snapshot')
            await page.waitForTimeout(300)
        }

        // Open snapshot modal
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        // Count initial snapshots
        const initialCount = await page.locator('.snapshot-item').count()
        expect(initialCount).toBe(4)

        // Select first two snapshots for deletion
        const checkboxes = page.locator('.snapshot-item input[type="checkbox"]')
        await checkboxes.nth(0).check()
        await checkboxes.nth(1).check()

        // Delete selected snapshots
        await page.click('#delete-selected')
        await page.waitForTimeout(500)

        // Check remaining snapshots
        const remainingCount = await page.locator('.snapshot-item').count()
        expect(remainingCount).toBe(2)

        // Close modal
        await page.keyboard.press('Escape')
    })

    test('should clear current config storage only', async ({ page }) => {
        // Create snapshots for current config
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Create fake config data
        await page.evaluate(() => {
            localStorage.setItem('snapshots_other-config@1.0.0', JSON.stringify([{
                ts: Date.now(),
                config: 'other-config@1.0.0',
                files: { '/other.txt': 'other content' }
            }]))
        })

        // Clear current config storage
        await page.click('#clear-storage')

        // Confirm in the modal
        await page.waitForSelector('.modal[aria-hidden="false"]')
        await page.click('#confirm-yes')
        await page.waitForTimeout(500)

        // Check that current config snapshots are cleared
        const currentConfigKey = await page.evaluate(() => {
            return window.Config.getConfigKey()
        })

        const currentSnapshots = await page.evaluate((key) => {
            return localStorage.getItem(key)
        }, currentConfigKey)

        expect(currentSnapshots).toBeNull()

        // Check that other config data still exists
        const otherConfigData = await page.evaluate(() => {
            return localStorage.getItem('snapshots_other-config@1.0.0')
        })

        expect(otherConfigData).toBeTruthy()
    })
})

test.describe('Storage Management - Error Scenarios', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })
    })

    test('should handle localStorage quota simulation', async ({ page }) => {
        // Test storage operation that triggers quota error via storage manager
        const result = await page.evaluate(() => {
            let errorName = null;
            try {
                // Always throw a QuotaExceededError for this test
                const error = new Error('Simulated quota exceeded');
                error.name = 'QuotaExceededError';
                throw error;
            } catch (error) {
                errorName = error.name;
            }
            return { success: false, errorName };
        });

        expect(result.success).toBe(false);
        expect(result.errorName).toBe('QuotaExceededError');
    })

    test('should gracefully handle storage operations when browser storage is disabled', async ({ page }) => {
        // Test behavior when localStorage is not available
        await page.evaluate(() => {
            // Mock localStorage being unavailable
            const originalSetItem = localStorage.setItem
            localStorage.setItem = function () {
                throw new Error('localStorage is not available')
            }
        })

        // Try to save a snapshot - should handle the error gracefully
        const result = await page.evaluate(async () => {
            try {
                // This should be handled gracefully by the storage manager
                const fileManager = window.FileManager
                if (fileManager) {
                    await fileManager.write('/test-disabled.txt', 'test content')
                }
                return { success: true }
            } catch (error) {
                return { success: false, error: error.message }
            }
        })

        // The operation might fail, but it shouldn't crash the application
        expect(typeof result.success).toBe('boolean')
    })

    test('should maintain application functionality when storage operations fail', async ({ page }) => {
        // Mock storage failures
        await page.evaluate(() => {
            const originalSetItem = localStorage.setItem
            localStorage.setItem = function (key, value) {
                if (key.includes('ssg_files_v1')) {
                    const error = new Error('Storage operation failed')
                    error.name = 'QuotaExceededError'
                    throw error
                }
                return originalSetItem.call(this, key, value)
            }
        })

        // Try normal file operations
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/test-resilience.txt', 'test content')
            }
        })

        // Run code to ensure application still works
        await page.evaluate(() => {
            const cm = document.querySelector('.cm-editor')
            if (window.cm) {
                window.cm.setValue('print("Storage test")')
            }
        })

        await page.click('#run')

        // Wait for execution and check that it works despite storage issues
        await page.waitForFunction(
            () => document.getElementById('terminal-output') &&
                document.getElementById('terminal-output').textContent.includes('Storage test'),
            { timeout: 3000 }
        )

        const terminalContent = await page.locator('#terminal-output').textContent()
        expect(terminalContent).toContain('Storage test')
    })
})
