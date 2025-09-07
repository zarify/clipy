// Playwright test for zero-knowledge verification system
import { test, expect } from '@playwright/test'

test.describe('Zero-Knowledge Verification System', () => {
    test('should display verification code when all tests pass and student ID is set', async ({ page }) => {
        // Navigate to the main app
        await page.goto('http://localhost:8000/')

        // Wait for the app to load
        await page.waitForSelector('h1', { timeout: 10000 })
        await page.waitForSelector('#editor-host')

        // Activate the Feedback tab first
        await page.click('#tab-btn-feedback')

        // Set student ID
        const studentIdInput = page.locator('#student-id-input')
        await studentIdInput.fill('test-student-123')

        // Wait for feedback config API to be available
        await page.waitForFunction(() => typeof window.__ssg_set_feedback_config === 'function', { timeout: 5000 })

        // Set up the test configuration
        await page.evaluate(() => {
            window.Config = window.Config || { current: {} }
            window.Config.current = {
                id: 'test-config',
                version: '1.0',
                title: 'Test Configuration',
                tests: [
                    {
                        id: 'test1',
                        description: 'Simple print test',
                        main: 'print("Hello, World!")',
                        stdin: '',
                        expected_stdout: 'Hello, World!',
                        expected_stderr: '',
                        timeoutMs: 5000
                    }
                ],
                feedback: []
            }

            // Apply the config
            if (window.__ssg_set_feedback_config) {
                window.__ssg_set_feedback_config(window.Config.current)
            }

            // Clear previous test results
            if (window.__ssg_set_test_results) {
                window.__ssg_set_test_results([])
            }
        })

        // Wait for the Run tests button to be enabled
        await page.waitForSelector('#run-tests-btn')
        await page.waitForFunction(() => {
            const b = document.getElementById('run-tests-btn')
            return b && !b.disabled
        }, { timeout: 5000 })

        // Dispatch the test run event
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ssg:run-tests-click')))

        // Wait for test results modal to appear
        await page.waitForSelector('#test-results-modal', { timeout: 10000 })
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-results-content'), { timeout: 5000 })

        // Wait for test results to complete
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-result-row'), { timeout: 10000 })

        // Check if verification code is displayed
        const verificationDiv = page.locator('#verification-code-display')
        await expect(verificationDiv).toBeVisible()

        // Check that verification code text is present
        const verificationCode = page.locator('#verification-code-text')
        await expect(verificationCode).toBeVisible()
        const codeText = await verificationCode.textContent()
        expect(codeText).toMatch(/^[A-Z0-9-]+$/); // Should be uppercase words/numbers separated by dashes

        // Verify the verification message
        await expect(page.locator('text=🎉 All tests passed! Your verification code:')).toBeVisible()
        await expect(page.locator('text=Share this code with your teacher as proof of completion')).toBeVisible()
    })

    test('should NOT display verification code when tests fail', async ({ page }) => {
        // Navigate to the main app
        await page.goto('http://localhost:8000/')

        // Wait for the app to load
        await page.waitForSelector('h1', { timeout: 10000 })
        await page.waitForSelector('#editor-host')

        // Activate the Feedback tab first
        await page.click('#tab-btn-feedback')

        // Set student ID
        const studentIdInput = page.locator('#student-id-input')
        await studentIdInput.fill('test-student-456')

        // Wait for feedback config API to be available
        await page.waitForFunction(() => typeof window.__ssg_set_feedback_config === 'function', { timeout: 5000 })

        // Set up a test that will fail
        await page.evaluate(() => {
            window.Config = window.Config || { current: {} }
            window.Config.current = {
                id: 'test-config',
                version: '1.0',
                title: 'Test Configuration',
                tests: [
                    {
                        id: 'test1',
                        description: 'Failing test',
                        main: 'print("Wrong output")',
                        stdin: '',
                        expected_stdout: 'Expected output',
                        expected_stderr: '',
                        timeoutMs: 5000
                    }
                ],
                feedback: []
            }

            if (window.__ssg_set_feedback_config) {
                window.__ssg_set_feedback_config(window.Config.current)
            }

            if (window.__ssg_set_test_results) {
                window.__ssg_set_test_results([])
            }
        })

        // Wait for the Run tests button to be enabled
        await page.waitForSelector('#run-tests-btn')
        await page.waitForFunction(() => {
            const b = document.getElementById('run-tests-btn')
            return b && !b.disabled
        }, { timeout: 5000 })

        // Dispatch the test run event
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ssg:run-tests-click')))

        // Wait for test results modal
        await page.waitForSelector('#test-results-modal', { timeout: 10000 })
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-results-content'), { timeout: 5000 })
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-result-row'), { timeout: 10000 })

        // Verification code should NOT be displayed
        const verificationDiv = page.locator('#verification-code-display')
        await expect(verificationDiv).toBeHidden()
    })

    test('should NOT display verification code when no student ID is set', async ({ page }) => {
        // Navigate to the main app
        await page.goto('http://localhost:8000/')

        // Wait for the app to load
        await page.waitForSelector('h1', { timeout: 10000 })
        await page.waitForSelector('#editor-host')

        // Activate the Feedback tab first
        await page.click('#tab-btn-feedback')

        // Don't set student ID - leave it empty

        // Wait for feedback config API to be available
        await page.waitForFunction(() => typeof window.__ssg_set_feedback_config === 'function', { timeout: 5000 })

        await page.evaluate(() => {
            window.Config = window.Config || { current: {} }
            window.Config.current = {
                id: 'test-config',
                version: '1.0',
                title: 'Test Configuration',
                tests: [
                    {
                        id: 'test1',
                        description: 'Passing test',
                        main: 'print("Hello, World!")',
                        stdin: '',
                        expected_stdout: 'Hello, World!',
                        expected_stderr: '',
                        timeoutMs: 5000
                    }
                ],
                feedback: []
            }

            if (window.__ssg_set_feedback_config) {
                window.__ssg_set_feedback_config(window.Config.current)
            }

            if (window.__ssg_set_test_results) {
                window.__ssg_set_test_results([])
            }
        })

        // Wait for the Run tests button to be enabled
        await page.waitForSelector('#run-tests-btn')
        await page.waitForFunction(() => {
            const b = document.getElementById('run-tests-btn')
            return b && !b.disabled
        }, { timeout: 5000 })

        // Dispatch the test run event
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('ssg:run-tests-click')))

        // Wait for test results modal
        await page.waitForSelector('#test-results-modal', { timeout: 10000 })
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-results-content'), { timeout: 5000 })
        await page.waitForFunction(() => !!document.querySelector('#test-results-modal .test-result-row'), { timeout: 10000 })

        // Verification code should NOT be displayed (no student ID)
        const verificationDiv = page.locator('#verification-code-display')
        await expect(verificationDiv).toBeHidden()
    })

    test('should persist student ID across page reloads', async ({ page }) => {
        // Navigate to the main app
        await page.goto('http://localhost:8000/')

        // Wait for app to load
        await page.waitForSelector('h1', { timeout: 10000 })

        // Set student ID
        const studentIdInput = page.locator('#student-id-input')
        await studentIdInput.fill('persistent-student-789')

        // Wait a moment for the input to be saved
        await page.waitForTimeout(1000)

        // Reload the page
        await page.reload()

        // Wait for app to load again
        await page.waitForSelector('h1', { timeout: 10000 })

        // Check that student ID is still there
        const reloadedInput = page.locator('#student-id-input')
        await expect(reloadedInput).toHaveValue('persistent-student-789')
    })
})
