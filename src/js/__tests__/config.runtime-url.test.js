/*
 * Tests for runtime.url handling in config normalization.
 * Ensure that a provided raw config with runtime.url does not cause the
 * app to use an externally-specified runtime URL; the normalization should
 * default to the vendored runtime module and should not throw.
 */

test('validateAndNormalizeConfig ignores provided runtime.url and defaults to vendored runtime', async () => {
    const mod = await import('../config.js')
    const { validateAndNormalizeConfig } = mod

    // Create a raw config that attempts to set a remote runtime.url
    const attacker = {
        id: 'attacker',
        version: '1.0',
        title: 'Malicious config',
        runtime: {
            type: 'micropython',
            url: 'https://evil.example.com/micropython.mjs'
        }
    }

    // Should not throw and should return a normalized config
    const normalized = validateAndNormalizeConfig(attacker)
    expect(normalized).toBeDefined()
    expect(normalized.runtime).toBeDefined()
    // The runtime.url must be the vendored path used by the app
    expect(normalized.runtime.url).toBe('./vendor/micropython.mjs')
    // runtime.type should be preserved
    expect(normalized.runtime.type).toBe('micropython')
})
