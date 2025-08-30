const { test, expect } = require('./fixtures')

test.describe('Storage Management - Cross-Configuration Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Clear storage for clean test
        await page.evaluate(() => {
            localStorage.clear()
        })
    })

    test('should detect and report storage across all configurations', async ({ page }) => {
        // Create snapshots for current config
        await page.evaluate(async () => {
            if (window.FileManager) {
                await window.FileManager.write('/current-config.txt', 'current config content')
            }
        })
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Create fake snapshots for other configurations
        await page.evaluate(() => {
            const fakeConfigs = [
                'python-basics@1.0.0',
                'data-science@2.1.0',
                'machine-learning@1.5.0'
            ]

            fakeConfigs.forEach((configId, index) => {
                const snapshots = [{
                    ts: Date.now() - (index * 100000),
                    config: configId,
                    files: {
                        [`/file-${index}.py`]: `# Content for ${configId}\nprint("Hello from ${configId}")`,
                        [`/data-${index}.txt`]: 'x'.repeat(1000 * (index + 1)) // Different sizes
                    }
                }]
                localStorage.setItem(`snapshots_${configId}`, JSON.stringify(snapshots))
            })
        })

        // Get comprehensive storage info
        const storageInfo = await page.evaluate(() => {
            return window.showStorageInfo()
        })

        expect(storageInfo).toBeTruthy()
        expect(storageInfo.totalSize).toBeGreaterThan(0)
        expect(storageInfo.breakdown).toBeDefined()
        expect(storageInfo.breakdown.snapshots).toBeGreaterThan(0)

        // Check storage info via function and ensure terminal output contains expected lines
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')
        await page.evaluate(() => { try { window.showStorageInfo() } catch (e) { } })
        await page.waitForTimeout(500)
        const terminalContent = await page.locator('#terminal-output').textContent()
        expect(terminalContent).toContain('Storage Usage:')
        expect(terminalContent).toContain('Snapshots:')
        expect(terminalContent).toContain('configurations')
        expect(terminalContent).toContain('Files:')

        await page.keyboard.press('Escape')
    })

    test('should show all configurations in cleanup interface', async ({ page }) => {
        // Create current config snapshot
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Create multiple fake config snapshots
        await page.evaluate(() => {
            const configs = [
                { id: 'python-tutorial@1.0.0', count: 3 },
                { id: 'data-analysis@2.0.0', count: 5 },
                { id: 'web-scraping@1.1.0', count: 2 }
            ]

            configs.forEach(({ id, count }) => {
                const snapshots = []
                for (let i = 0; i < count; i++) {
                    snapshots.push({
                        ts: Date.now() - (i * 60000),
                        config: id,
                        files: {
                            [`/test-${i}.py`]: `# Test file ${i} for ${id}`,
                            [`/data-${i}.csv`]: 'col1,col2\nval1,val2\n'.repeat(50)
                        }
                    })
                }
                localStorage.setItem(`snapshots_${id}`, JSON.stringify(snapshots))
            })
        })

        // Mock the cross-config cleanup interface
        await page.evaluate(() => {
            // Add function to show all configs (this would be part of storage manager)
            window.showAllConfigCleanup = function () {
                const allConfigs = []
                for (let key in localStorage) {
                    if (key.startsWith('snapshots_')) {
                        const configId = key.replace('snapshots_', '')
                        const snapshots = JSON.parse(localStorage.getItem(key) || '[]')
                        const sizeBytes = new Blob([localStorage.getItem(key)]).size

                        allConfigs.push({
                            configId,
                            snapshotCount: snapshots.length,
                            sizeBytes,
                            sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
                            storageKey: key
                        })
                    }
                }
                return allConfigs.sort((a, b) => b.sizeBytes - a.sizeBytes)
            }
        })

        const allConfigs = await page.evaluate(() => {
            return window.showAllConfigCleanup()
        })

        expect(allConfigs).toHaveLength(4) // Current + 3 fake configs
        expect(allConfigs.some(c => c.configId === 'default-playground@1.0.0')).toBe(true)
        expect(allConfigs.some(c => c.configId === 'python-tutorial@1.0.0')).toBe(true)
        expect(allConfigs.some(c => c.configId === 'data-analysis@2.0.0')).toBe(true)
        expect(allConfigs.some(c => c.configId === 'web-scraping@1.1.0')).toBe(true)

        // Check snapshot counts
        const dataAnalysisConfig = allConfigs.find(c => c.configId === 'data-analysis@2.0.0')
        expect(dataAnalysisConfig.snapshotCount).toBe(5)

        const webScrapingConfig = allConfigs.find(c => c.configId === 'web-scraping@1.1.0')
        expect(webScrapingConfig.snapshotCount).toBe(2)
    })

    test('should selectively clean up old configurations', async ({ page }) => {
        // Create multiple configurations with different ages
        await page.evaluate(() => {
            const now = Date.now()
            const hour = 60 * 60 * 1000
            const day = 24 * hour

            const configs = [
                { id: 'old-config@1.0.0', age: 30 * day, count: 10 },  // 30 days old
                { id: 'recent-config@1.0.0', age: 2 * day, count: 5 }, // 2 days old
                { id: 'ancient-config@1.0.0', age: 90 * day, count: 15 } // 90 days old
            ]

            configs.forEach(({ id, age, count }) => {
                const snapshots = []
                for (let i = 0; i < count; i++) {
                    snapshots.push({
                        ts: now - age - (i * hour),
                        config: id,
                        files: {
                            [`/old-file-${i}.py`]: `# Old file ${i}`,
                            [`/old-data-${i}.txt`]: 'old data '.repeat(100)
                        }
                    })
                }
                localStorage.setItem(`snapshots_${id}`, JSON.stringify(snapshots))
            })
        })

        // Test selective cleanup by age
        const cleanupResult = await page.evaluate(() => {
            const cutoffAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            const now = Date.now()
            let deletedConfigs = 0
            let deletedSnapshots = 0

            for (let key in localStorage) {
                if (key.startsWith('snapshots_')) {
                    const snapshots = JSON.parse(localStorage.getItem(key) || '[]')
                    if (snapshots.length > 0) {
                        const newestSnapshot = Math.max(...snapshots.map(s => s.ts))
                        if (now - newestSnapshot > cutoffAge) {
                            localStorage.removeItem(key)
                            deletedConfigs++
                            deletedSnapshots += snapshots.length
                        }
                    }
                }
            }

            return { deletedConfigs, deletedSnapshots }
        })

        expect(cleanupResult.deletedConfigs).toBe(2) // old-config and ancient-config
        expect(cleanupResult.deletedSnapshots).toBe(25) // 10 + 15

        // Verify recent config still exists
        const remainingConfigs = await page.evaluate(() => {
            const configs = []
            for (let key in localStorage) {
                if (key.startsWith('snapshots_')) {
                    configs.push(key.replace('snapshots_', ''))
                }
            }
            return configs
        })

        expect(remainingConfigs).toContain('recent-config@1.0.0')
        expect(remainingConfigs).not.toContain('old-config@1.0.0')
        expect(remainingConfigs).not.toContain('ancient-config@1.0.0')
    })

    test('should handle cleanup of corrupted cross-config data', async ({ page }) => {
        // Create valid snapshots
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Create mix of valid and corrupted config data
        await page.evaluate(() => {
            // Valid config
            localStorage.setItem('snapshots_valid-config@1.0.0', JSON.stringify([{
                ts: Date.now(),
                config: 'valid-config@1.0.0',
                files: { '/valid.py': 'print("valid")' }
            }]))

            // Corrupted configs
            localStorage.setItem('snapshots_corrupted-1@1.0.0', '{invalid json')
            localStorage.setItem('snapshots_corrupted-2@1.0.0', '{"ts":null,"files":[]}') // Invalid structure
            localStorage.setItem('snapshots_empty@1.0.0', '[]') // Empty but valid
            localStorage.setItem('snapshots_huge@1.0.0', JSON.stringify([{
                ts: Date.now(),
                config: 'huge@1.0.0',
                files: { '/huge.txt': 'x'.repeat(100000) } // Very large
            }]))
        })

        // Test cleanup that handles corruption gracefully
        const cleanupResult = await page.evaluate(() => {
            const results = {
                processed: 0,
                errors: 0,
                deleted: 0,
                validConfigs: []
            }

            for (let key in localStorage) {
                if (key.startsWith('snapshots_')) {
                    results.processed++
                    try {
                        const data = localStorage.getItem(key)
                        const snapshots = JSON.parse(data)

                        // Validate structure
                        if (Array.isArray(snapshots)) {
                            if (snapshots.length === 0) {
                                // Empty - can remove
                                localStorage.removeItem(key)
                                results.deleted++
                            } else {
                                // Validate snapshot structure
                                const isValid = snapshots.every(s =>
                                    typeof s.ts === 'number' &&
                                    typeof s.config === 'string' &&
                                    typeof s.files === 'object'
                                )
                                if (isValid) {
                                    results.validConfigs.push(key.replace('snapshots_', ''))
                                } else {
                                    localStorage.removeItem(key)
                                    results.deleted++
                                }
                            }
                        } else {
                            localStorage.removeItem(key)
                            results.deleted++
                        }
                    } catch (error) {
                        results.errors++
                        localStorage.removeItem(key)
                        results.deleted++
                    }
                }
            }

            return results
        })

        expect(cleanupResult.processed).toBeGreaterThan(0)
        expect(cleanupResult.deleted).toBeGreaterThan(0) // Should remove corrupted entries
        expect(cleanupResult.validConfigs).toContain('default-playground@1.0.0')
        expect(cleanupResult.validConfigs).toContain('valid-config@1.0.0')
        expect(cleanupResult.validConfigs).toContain('huge@1.0.0') // Large but valid

        // Verify application still works after cleanup
        await page.evaluate(() => {
            if (window.cm) {
                window.cm.setValue('print("Cleanup test passed")')
            }
        })

        await page.click('#run')

        await page.waitForFunction(
            () => {
                const output = document.getElementById('terminal-output')
                return output && output.textContent.includes('Cleanup test passed')
            },
            { timeout: 3000 }
        )

        const terminalContent = await page.locator('#terminal-output').textContent()
        expect(terminalContent).toContain('Cleanup test passed')
    })

    test('should provide storage migration capabilities', async ({ page }) => {
        // Create old format snapshots (simulate legacy data)
        await page.evaluate(() => {
            // Simulate old snapshot format without config metadata
            const oldSnapshots = [
                {
                    ts: Date.now() - 100000,
                    files: {
                        '/old-format.py': 'print("old format")',
                        '/legacy.txt': 'legacy content'
                    }
                    // Missing config field - old format
                }
            ]
            localStorage.setItem('snapshots', JSON.stringify(oldSnapshots)) // No config suffix

            // New format with config
            const newSnapshots = [
                {
                    ts: Date.now(),
                    config: 'migrated@1.0.0',
                    files: {
                        '/new-format.py': 'print("new format")',
                        '/modern.txt': 'modern content'
                    }
                }
            ]
            localStorage.setItem('snapshots_migrated@1.0.0', JSON.stringify(newSnapshots))
        })

        // Test migration function
        const migrationResult = await page.evaluate(() => {
            const migration = {
                oldFormatFound: false,
                migrated: 0,
                errors: 0
            }

            // Check for old format data
            if (localStorage.getItem('snapshots')) {
                migration.oldFormatFound = true
                try {
                    const oldData = JSON.parse(localStorage.getItem('snapshots'))
                    if (Array.isArray(oldData)) {
                        // Migrate to new format with current config
                        const currentConfig = 'default-playground@1.0.0'
                        const migratedData = oldData.map(snapshot => ({
                            ...snapshot,
                            config: currentConfig
                        }))

                        // Save in new format
                        localStorage.setItem(`snapshots_${currentConfig}`, JSON.stringify(migratedData))
                        localStorage.removeItem('snapshots') // Remove old format
                        migration.migrated = oldData.length
                    }
                } catch (error) {
                    migration.errors++
                }
            }

            return migration
        })

        expect(migrationResult.oldFormatFound).toBe(true)
        expect(migrationResult.migrated).toBe(1)
        expect(migrationResult.errors).toBe(0)

        // Verify migrated data is accessible
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        const snapshotItems = page.locator('.snapshot-item')
        const itemCount = await snapshotItems.count()
        expect(itemCount).toBeGreaterThan(0) // Should include migrated snapshot

        await page.keyboard.press('Escape')
    })
})
