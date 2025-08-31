(async () => {
    try {
        const mod = await import('../src/js/config.js')
        const { validateAndNormalizeConfig } = mod
        if (!validateAndNormalizeConfig) {
            console.error('validateAndNormalizeConfig not exported')
            process.exit(2)
        }

        const raw = {
            id: 'u1',
            version: '0.1',
            title: 't',
            starter: "print('hi')",
            files: {
                '/main.py': "print('starter')",
                '/lib/util.py': "def helper():\n    return 42"
            }
        }

        const norm = validateAndNormalizeConfig(raw)
        if (!norm) {
            console.error('Normalization returned falsy')
            process.exit(2)
        }

        if (!norm.files || typeof norm.files !== 'object') {
            console.error('files not preserved in normalized config')
            console.error('norm:', JSON.stringify(norm, null, 2))
            process.exit(2)
        }

        if (!norm.files['/lib/util.py'] || !norm.files['/lib/util.py'].includes('def helper')) {
            console.error('/lib/util.py content missing or altered')
            console.error('files:', JSON.stringify(norm.files, null, 2))
            process.exit(2)
        }

        console.log('OK: config normalization preserved files')
        process.exit(0)
    } catch (e) {
        console.error('Test failed', e)
        process.exit(3)
    }
})()
