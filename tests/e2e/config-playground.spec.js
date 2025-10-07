import { test, expect } from '@playwright/test';

test.describe('Config Playground integration', () => {
    test('server config list includes playground at end', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // give app time to fetch index.json
        await page.waitForTimeout(1500);

        const list = await page.evaluate(() => {
            try { return (window.__ssg_remote_config_list && window.__ssg_remote_config_list.items) ? window.__ssg_remote_config_list.items : null } catch (e) { return null }
        });

        console.log('Remote config list items:', list);
        expect(list).not.toBeNull();
        expect(list.length).toBeGreaterThan(0);
        // Items are now enriched objects with {id, url, title, version, source}
        const lastItem = list[list.length - 1];
        expect(lastItem.id).toBe('playground@1.0.json');
        expect(lastItem.title).toBe('Playground');
    });

    test('explicit single config is treated as list with playground appended', async ({ page }) => {
        await page.goto('/?config=printing-press@1.0.json');
        await page.waitForLoadState('networkidle');
        // allow startup processing
        await page.waitForTimeout(1500);

        const list = await page.evaluate(() => {
            try { return (window.__ssg_remote_config_list && window.__ssg_remote_config_list.items) ? window.__ssg_remote_config_list.items : null } catch (e) { return null }
        });

        console.log('Remote config list for single config:', list);
        expect(list).not.toBeNull();
        // Items are now enriched objects - check first and last
        expect(list[0].id).toContain('printing-press');
        expect(list[list.length - 1].id).toContain('playground');
    });

    test('header select shows friendly title for single config and author upload updates header', async ({ page }) => {
        // Single config title in header
        await page.goto('/?config=printing-press@1.0.json');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        const headerText = await page.evaluate(() => {
            try {
                const sel = document.getElementById('config-select-header')
                if (!sel) return document.querySelector('.config-title-line')?.textContent || null
                // return selected option text or first real option text
                const opt = sel.options && sel.options[1] ? sel.options[1] : sel.options[0]
                return opt ? opt.textContent : null
            } catch (e) { return null }
        })
        console.log('Header select/label for single config:', headerText)
        expect(headerText).toContain('Printing press')

        // Now test uploading a local author config via fixture and ensure header shows author and playground
        // Open config modal reliably then set the hidden file input to our fixture
        // Trigger the click handler in-page (bypass Playwright visibility rules)
        await page.evaluate(() => { const el = document.querySelector('.config-title-line'); if (el) el.click(); })
        // The file input is hidden; don't wait for visibility. Query it directly.
        const inputHandle = await page.$('#config-file-input')
        if (inputHandle) {
            // setInputFiles works even when input is display:none
            await inputHandle.setInputFiles('tests/fixtures/author-config.json')
        } else {
            // best-effort fallback: programmatically attach a file to window for the app to pick up
            await page.evaluate(async () => {
                const text = await (await fetch('/tests/fixtures/author-config.json')).text()
                const blob = new Blob([text], { type: 'application/json' })
                const file = new File([blob], 'author-config.json', { type: 'application/json' })
                try { window.__ssg_last_test_file = file } catch (_err) { }
            })
        }

        // Give UI time to react
        await page.waitForTimeout(1000)

        const headerAfterAuthor = await page.evaluate(() => {
            try {
                const sel = document.getElementById('config-select-header')
                if (!sel) return document.querySelector('.config-title-line')?.textContent || null
                // return option texts
                return Array.from(sel.options || []).map(o => o.textContent)
            } catch (e) { return null }
        })
        console.log('Header options after author upload:', headerAfterAuthor)
        expect(headerAfterAuthor).not.toBeNull()
        // Should include Author Demo and playground
        const hasAuthor = Array.isArray(headerAfterAuthor) && headerAfterAuthor.some(t => t && t.includes('Author Demo'))
        const hasPlayground = Array.isArray(headerAfterAuthor) && headerAfterAuthor.some(t => t && t.toLowerCase().includes('playground'))
        expect(hasAuthor).toBeTruthy()
        expect(hasPlayground).toBeTruthy()
    })

    test('selecting playground from dropdown loads it successfully', async ({ page }) => {
        await page.goto('/?config=printing-press@1.0.json');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // Get the header select dropdown
        const select = await page.$('#config-select-header');
        expect(select).not.toBeNull();

        // Debug: log options before selection
        const optionsBefore = await page.evaluate(() => {
            const sel = document.getElementById('config-select-header');
            if (!sel || !sel.options) return null;
            return Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent }));
        });
        console.log('Select options:', optionsBefore);

        // Change to playground (last option)
        const selectionResult = await page.evaluate(() => {
            const sel = document.getElementById('config-select-header');
            if (sel && sel.options) {
                // Select the last option (playground)
                const lastOption = sel.options[sel.options.length - 1];
                sel.value = lastOption.value;
                // Trigger change event
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return { selectedValue: sel.value, optionText: lastOption.textContent };
            }
            return null;
        });

        console.log('Selected:', selectionResult);

        // Wait for config to load
        await page.waitForTimeout(1500);

        // Verify playground config is loaded
        const currentConfig = await page.evaluate(() => {
            try {
                return window.Config && window.Config.current ? {
                    id: window.Config.current.id,
                    title: window.Config.current.title
                } : null;
            } catch (e) { return null; }
        });

        console.log('Current config after selecting playground:', currentConfig);
        expect(currentConfig).not.toBeNull();
        expect(currentConfig.id).toBe('playground');
        expect(currentConfig.title).toBe('Playground');
    });

    test('selecting configs from server list does not create duplicates', async ({ page }) => {
        // Load default page with index.json list
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // Get initial list
        const initialList = await page.evaluate(() => {
            return window.__ssg_remote_config_list?.items || [];
        });
        console.log('Initial list:', initialList);
        expect(initialList.length).toBeGreaterThan(0);

        // Select the first config from the dropdown
        await page.selectOption('#config-select-header', '__list::0');
        await page.waitForTimeout(1000);

        // Check list after first selection
        const listAfterFirst = await page.evaluate(() => {
            return window.__ssg_remote_config_list?.items || [];
        });
        console.log('List after selecting first config:', listAfterFirst);

        // The list should NOT have grown - selecting from server list shouldn't add duplicates
        expect(listAfterFirst.length).toBe(initialList.length);

        // Select a different config
        if (initialList.length > 2) {
            await page.selectOption('#config-select-header', '__list::1');
            await page.waitForTimeout(1000);

            const listAfterSecond = await page.evaluate(() => {
                return window.__ssg_remote_config_list?.items || [];
            });
            console.log('List after selecting second config:', listAfterSecond);

            // Still should not have grown
            expect(listAfterSecond.length).toBe(initialList.length);
        }
    });

    test('Bug 1: remote config list loaded via URL should include playground', async ({ page }) => {
        // Test with actual remote GitHub config list
        await page.goto('/?config=https://raw.githubusercontent.com/zarify/clipy-configs/refs/heads/main/index.json');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const list = await page.evaluate(() => {
            return window.__ssg_remote_config_list?.items || [];
        });

        console.log('Remote GitHub list items:', list);
        expect(list.length).toBeGreaterThan(0);

        // Playground should be in the list (enriched objects have id property)
        const hasPlayground = list.some(item =>
            item && item.id && item.id.includes('playground')
        );
        expect(hasPlayground).toBe(true);

        // Verify playground appears in dropdown options with friendly title
        const options = await page.evaluate(() => {
            const select = document.getElementById('config-select-header');
            return Array.from(select?.options || []).map(opt => opt.textContent);
        });

        console.log('Dropdown options:', options);
        const hasPlaygroundOption = options.some(text =>
            text && text.includes('Playground')
        );
        expect(hasPlaygroundOption).toBe(true);

        // CRITICAL: Try to actually SELECT playground from the dropdown and verify it loads from local server, not GitHub
        const playgroundOption = await page.evaluate(() => {
            const select = document.getElementById('config-select-header');
            const options = Array.from(select?.options || []);
            const pgOption = options.find(opt => opt.textContent.includes('Playground'));
            return pgOption ? { index: pgOption.index, value: pgOption.value, text: pgOption.textContent } : null;
        });
        console.log('Playground option:', playgroundOption);
        expect(playgroundOption).toBeTruthy();

        // Select playground - this should load from local ./config/playground@1.0.json, NOT from GitHub
        await page.selectOption('#config-select-header', playgroundOption.value);
        await page.waitForTimeout(1000);

        // Verify it loaded successfully
        const configAfterSelect = await page.evaluate(() => window.Config?.current);
        console.log('Config after selecting playground:', configAfterSelect);
        expect(configAfterSelect?.id).toBe('playground');
        expect(configAfterSelect?.title).toBe('Playground');
    });

    test('Bug 2: single config load should allow switching to playground', async ({ page }) => {
        await page.goto('/?config=printing-press@1.0.json');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // Verify initial config loaded
        let currentConfig = await page.evaluate(() => window.currentConfig);
        console.log('Initial config:', currentConfig);
        expect(currentConfig?.id).toBe('printing-press');

        // Wait longer for async metadata fetches to complete
        await page.waitForTimeout(2000);

        // Check dropdown for playground option
        const options = await page.evaluate(() => {
            const select = document.getElementById('config-select-header');
            if (!select) return [];
            return Array.from(select.options).map((opt, i) => ({
                index: i,
                value: opt.value,
                text: opt.textContent
            }));
        });
        console.log('Dropdown options:', options);

        // Find playground option (might show as path or as friendly title)
        const playgroundOption = options.find(opt =>
            opt.text && (
                opt.text.toLowerCase().includes('playground') ||
                opt.text.includes('playground@1.0') ||
                opt.text.includes('./config/playground')
            )
        );

        expect(playgroundOption).toBeDefined();
        console.log('Playground option found:', playgroundOption);

        // Select playground
        await page.selectOption('#config-select-header', playgroundOption.value);
        await page.waitForTimeout(1500);

        // Verify playground loaded
        currentConfig = await page.evaluate(() => window.currentConfig);
        console.log('Config after selecting playground:', currentConfig);
        expect(currentConfig?.id).toBe('playground');
        expect(currentConfig?.title).toBe('Playground');
    });

    test('Bug 3: author config upload should update dropdown with author + playground', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // Get initial dropdown options
        const optionsBefore = await page.evaluate(() => {
            const select = document.getElementById('config-select-header');
            return Array.from(select?.options || []).map(opt => opt.textContent);
        });
        console.log('Dropdown before upload:', optionsBefore);

        // Simulate uploading an author config by directly modifying the remote config list
        // This mimics what loadConfigFromFile does
        await page.evaluate(() => {
            const testConfig = {
                id: 'author-test',
                title: 'Author Test Config',
                version: '1.0',
                files: { '/main.py': 'print("test")' }
            };

            // Use enriched object format for author config
            const items = [];

            // Add author config as enriched object
            items.push({
                id: 'author-config',
                url: null,
                title: testConfig.title,
                version: testConfig.version,
                source: 'author',
                configObject: testConfig
            });

            // Add playground as enriched object
            items.push({
                id: 'playground@1.0.json',
                url: './config/playground@1.0.json',
                title: 'Playground',
                version: '1.0',
                source: 'local'
            });

            // Set up the list with enriched objects
            window.__ssg_remote_config_list = { url: null, items };

            // Dispatch the event to trigger dropdown rebuild
            window.dispatchEvent(new CustomEvent('ssg:remote-config-list-changed'));
        });

        await page.waitForTimeout(1000);

        // Check dropdown was updated
        const optionsAfter = await page.evaluate(() => {
            const select = document.getElementById('config-select-header');
            return Array.from(select?.options || []).map(opt => opt.textContent);
        });
        console.log('Dropdown after upload:', optionsAfter);

        // Should have author config
        const hasAuthorConfig = optionsAfter.some(text =>
            text && text.includes('Author Test Config')
        );
        expect(hasAuthorConfig).toBe(true);

        // Should have playground (with friendly title or path)
        const hasPlayground = optionsAfter.some(text =>
            text && (text.toLowerCase().includes('playground') || text.includes('playground@1.0'))
        );
        expect(hasPlayground).toBe(true);

        // Should have at least 3 options (placeholder, author, playground)
        expect(optionsAfter.length).toBeGreaterThanOrEqual(3);
    });
});
