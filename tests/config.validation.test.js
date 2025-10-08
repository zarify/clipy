import { createConfigManager } from '../src/js/config.js'

// Small jest tests that mock fetch and window where needed

describe('config validation', () => {
    test('fetchAvailableServerConfigs rejects unsafe remote schemes', async () => {
        const remoteIndex = {
            files: [
                'http://example.com/good.json',
                'javascript:alert(1)',
                'data:text/plain,evil',
                '/absolute/path/bad.json'
            ]
        }

        const fetchMock = jest.fn(async (url) => {
            if (url === './config/index.json') {
                return { ok: true, json: async () => remoteIndex }
            }
            // pretend any other fetch succeeds for checks
            return { ok: true }
        })

        const mgr = createConfigManager({ fetch: fetchMock })
        const items = await mgr.fetchAvailableServerConfigs()
        const urls = items.map(i => i.url)
        expect(urls).toContain('http://example.com/good.json')
        expect(urls.some(u => u && u.startsWith('javascript:'))).toBe(false)
        expect(urls.some(u => u && u.startsWith('data:'))).toBe(false)
    })

    test('loadConfigFromStringOrUrl rejects unsafe filenames', async () => {
        const fetchMock = jest.fn()
        const mgr = createConfigManager({ fetch: fetchMock })

        await expect(mgr.loadConfigFromStringOrUrl('evil<script>.json')).rejects.toThrow(/Invalid config name/)
        await expect(mgr.loadConfigFromStringOrUrl('../etc/passwd')).rejects.toThrow(/Invalid config name/)
        await expect(mgr.loadConfigFromStringOrUrl('good-config.json')).rejects.toThrow(/Failed to fetch/)
    })
})
