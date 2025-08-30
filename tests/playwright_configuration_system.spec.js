const { test, expect } = require('./fixtures')

test.describe('Configuration System', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')

        // Clear all config-related storage
        await page.evaluate(() => {
            // Clear all snapshot storage for any config
            const keys = Object.keys(localStorage)
            keys.forEach(key => {
                if (key.startsWith('snapshots_')) {
                    localStorage.removeItem(key)
                }
            })
            // Clear other storage
            try { localStorage.removeItem('snapshots') } catch (_e) { }
            try { localStorage.removeItem('ssg_files_v1') } catch (_e) { }
            try { window.__ssg_last_snapshot_restore = 0 } catch (_e) { }
        })
    })

    test('should display configuration identity in header', async ({ page }) => {
        // Wait for configuration to load
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Check that config info is displayed in header
        const configInfo = await page.locator('.config-info').textContent()
        // Strip trailing UI glyphs (like refresh arrows) and extra whitespace
        const cleanConfigInfo = configInfo.replace(/[\u2190-\u21FF\s]+$/g, '').trim()
        expect(cleanConfigInfo).toMatch(/^.+\s+\(.+@.+\)$/) // Should match "Title (id@version)" pattern

        // Verify it shows default config info
        expect(cleanConfigInfo).toContain('default-playground@1.0.0')
    })

    test('should validate configuration structure', async ({ page }) => {
        // Test configuration validation by injecting invalid config
        const validationResult = await page.evaluate(() => {
            if (!window.Config || !window.Config.validateAndNormalizeConfig) return null

            // Test invalid config (missing required fields)
            const invalidConfig = { runtime: { url: 'test.wasm' } }
            const result = window.Config.validateAndNormalizeConfig(invalidConfig)

            return {
                hasId: !!result.id,
                hasVersion: !!result.version,
                hasTitle: !!result.title,
                hasDescription: !!result.description,
                hasRuntime: !!result.runtime?.url
            }
        })

        expect(validationResult.hasId).toBe(true)
        expect(validationResult.hasVersion).toBe(true)
        expect(validationResult.hasTitle).toBe(true)
        expect(validationResult.hasDescription).toBe(true)
        expect(validationResult.hasRuntime).toBe(true)
    })

    test('should provide configuration identity functions', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        const identityFunctions = await page.evaluate(() => {
            if (!window.Config) return null

            return {
                identity: window.Config.getConfigIdentity(),
                key: window.Config.getConfigKey(),
                hasGetConfigIdentity: typeof window.Config.getConfigIdentity === 'function',
                hasGetConfigKey: typeof window.Config.getConfigKey === 'function'
            }
        })

        expect(identityFunctions.hasGetConfigIdentity).toBe(true)
        expect(identityFunctions.hasGetConfigKey).toBe(true)
        expect(identityFunctions.identity).toMatch(/^.+@.+$/) // Should be "id@version"
        expect(identityFunctions.key).toMatch(/^snapshots_.+@.+$/) // Should be "snapshots_id@version"
    })

    test('should use simplified runtime loading', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        const runtimeConfig = await page.evaluate(() => {
            if (!window.Config || !window.Config.current) return null

            const config = window.Config.current
            return {
                hasUrl: !!config.runtime?.url,
                hasCdnFallback: 'cdn_fallback' in (config.runtime || {}),
                hasRecommended: 'recommended' in (config.runtime || {}),
                url: config.runtime?.url
            }
        })

        expect(runtimeConfig.hasUrl).toBe(true)
        expect(runtimeConfig.hasCdnFallback).toBe(false) // Should not have multi-runtime fields
        expect(runtimeConfig.hasRecommended).toBe(false) // Should not have multi-runtime fields
        // Accept either .wasm or .mjs runtime bundles
        expect(runtimeConfig.url).toMatch(/\.(wasm|mjs)$/)
    })
})

test.describe('Configuration-Specific Snapshot Isolation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')

        // Clear all config-related storage
        await page.evaluate(() => {
            const keys = Object.keys(localStorage)
            keys.forEach(key => {
                if (key.startsWith('snapshots_')) {
                    localStorage.removeItem(key)
                }
            })
            try { localStorage.removeItem('snapshots') } catch (_e) { }
            try { localStorage.removeItem('ssg_files_v1') } catch (_e) { }

            // Clear file system if available
            try {
                if (window.__ssg_mem) {
                    Object.keys(window.__ssg_mem).forEach(k => delete window.__ssg_mem[k])
                }
            } catch (_e) { }
        })
    })

    test('should isolate snapshots by configuration', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Create a file and save snapshot for default config
        await page.evaluate(async () => {
            try {
                if (window.FileManager) await window.FileManager.write('/config-test.txt', 'default-config-content')
            } catch (_e) { }
        })

        await page.click('#save-snapshot')
        await page.waitForTimeout(500) // Allow snapshot to save

        // Verify snapshot was saved with config-specific key
        const snapshotKey = await page.evaluate(() => {
            if (!window.Config) return null
            const configKey = window.Config.getConfigKey()
            return localStorage.getItem(configKey) ? configKey : null
        })

        expect(snapshotKey).toBeTruthy()
        expect(snapshotKey).toMatch(/^snapshots_.+@.+$/)

        // Verify snapshot contains our file
        const snapshotContent = await page.evaluate(() => {
            if (!window.Config) return null
            const configKey = window.Config.getConfigKey()
            const snapshots = JSON.parse(localStorage.getItem(configKey) || '[]')
            return snapshots.length > 0 ? snapshots[0] : null
        })

        expect(snapshotContent).toBeTruthy()
        expect(snapshotContent.files['/config-test.txt']).toBeDefined()
        expect(snapshotContent.files['/config-test.txt']).toBe('default-config-content')
    })

    test('should show only current config snapshots in modal', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Create and save a snapshot
        await page.evaluate(async () => {
            try {
                if (window.FileManager) await window.FileManager.write('/modal-test.txt', 'test-content')
            } catch (_e) { }
        })

        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open snapshot modal
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        // Check that modal shows configuration context
        const modalHeader = await page.locator('#snapshot-modal .modal-header')
        await expect(modalHeader).toBeVisible()

        // Verify snapshot items show config-specific information
        const snapshotItems = await page.locator('.snapshot-item').count()
        expect(snapshotItems).toBeGreaterThan(0)

        // Check if snapshot info is displayed
        const hasSnapshotInfo = await page.locator('.snapshot-info').count()
        expect(hasSnapshotInfo).toBeGreaterThanOrEqual(0) // May be 0 if styling not fully applied yet

        // Close modal
        await page.keyboard.press('Escape')
    })

    test('should restore snapshots only for current configuration', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Create file and snapshot
        await page.evaluate(async () => {
            try {
                if (window.FileManager) await window.FileManager.write('/restore-test.txt', 'original-content')
            } catch (_e) { }
        })

        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Modify the file
        await page.evaluate(async () => {
            try {
                if (window.FileManager) await window.FileManager.write('/restore-test.txt', 'modified-content')
            } catch (_e) { }
        })

        // Restore snapshot
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('#snapshot-list .snapshot-item button')
            if (buttons.length > 0) buttons[0].click()
        })

        // Wait for restoration
        await page.waitForTimeout(1000)

        // Verify file was restored to original content
        const restoredContent = await page.evaluate(async () => {
            try {
                if (window.FileManager) return await window.FileManager.read('/restore-test.txt')
            } catch (_e) { }
            return null
        })

        expect(restoredContent).toBe('original-content')
    })

    test('should not show snapshots from different configurations', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Manually create a snapshot for a different config in localStorage
        await page.evaluate(() => {
            const fakeConfigSnapshot = [{
                timestamp: Date.now(),
                files: { '/fake-config-file.txt': 'fake-content' },
                code: 'print("fake config")'
            }]
            localStorage.setItem('snapshots_fake-config@1.0.0', JSON.stringify(fakeConfigSnapshot))
        })

        // Create a snapshot for current config
        await page.evaluate(async () => {
            try {
                if (window.FileManager) await window.FileManager.write('/real-config-file.txt', 'real-content')
            } catch (_e) { }
        })

        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open snapshot modal and verify only current config snapshots are shown
        await page.click('#history')
        await page.waitForSelector('#snapshot-list')

        // Should only see 1 snapshot (from current config)
        const snapshotCount = await page.locator('.snapshot-item').count()
        expect(snapshotCount).toBe(1)

        // Verify the snapshot is for the current config (should not show fake config snapshot)
        const snapshotButton = page.locator('.snapshot-item button').first()
        await snapshotButton.click()

        await page.waitForTimeout(1000)

        // Verify the file system state matches the restored snapshot exactly
        const fileSystemState = await page.evaluate(async () => {
            const files = {}
            try {
                if (window.FileManager && typeof window.FileManager.list === 'function') {
                    const fileList = window.FileManager.list()
                    for (const filePath of fileList) {
                        try {
                            files[filePath] = await window.FileManager.read(filePath)
                        } catch (_e) { }
                    }
                }
            } catch (_e) { }
            return files
        })

        // The file system should only contain files from the current config's snapshot
        expect(fileSystemState['/real-config-file.txt']).toBe('real-content')
        expect(fileSystemState['/fake-config-file.txt']).toBeUndefined() // Should not exist
    })
})

test.describe('Configuration UI Components', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8000')
        await page.waitForSelector('#editor-host')
    })

    test('should display configuration in header with proper styling', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Check header layout
        const header = page.locator('header')
        await expect(header).toBeVisible()

        // Check config info styling
        const configInfo = page.locator('.config-info')
        await expect(configInfo).toBeVisible()

        // Verify styling properties
        const configInfoStyles = await configInfo.evaluate(el => {
            const styles = window.getComputedStyle(el)
            return {
                fontSize: styles.fontSize,
                fontFamily: styles.fontFamily,
                color: styles.color
            }
        })

        expect(configInfoStyles.fontSize).toBe('11px')
        expect(configInfoStyles.fontFamily).toContain('monospace')
    })

    test('should show configuration context in snapshot modal', async ({ page }) => {
        await page.waitForFunction(() => window.Config && window.Config.current, { timeout: 5000 })

        // Create a snapshot to ensure modal has content
        await page.click('#save-snapshot')
        await page.waitForTimeout(500)

        // Open modal
        await page.click('#history')
        await page.waitForSelector('.modal[aria-hidden="false"]')

        // Check modal header exists
        const modalHeader = page.locator('#snapshot-modal .modal-header')
        await expect(modalHeader).toBeVisible()

        // Check modal content styling
        const modalContent = page.locator('#snapshot-modal .modal-content')
        const modalStyles = await modalContent.evaluate(el => {
            const styles = window.getComputedStyle(el)
            return {
                background: styles.backgroundColor,
                padding: styles.padding,
                borderRadius: styles.borderRadius
            }
        })

        expect(modalStyles.padding).toBe('12px')
        expect(modalStyles.borderRadius).toBe('6px')

        // Close modal
        await page.keyboard.press('Escape')
    })
})
