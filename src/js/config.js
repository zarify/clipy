// Configuration loading and management
import { $ } from './utils.js'

export const configUrl = './config/sample.json'

let config = null

export async function loadConfig() {
    if (config) return config

    try {
        const res = await fetch(configUrl)
        const rawConfig = await res.json()

        // Validate and normalize configuration
        config = validateAndNormalizeConfigInternal(rawConfig)

        return config
    } catch (e) {
        console.error('Failed to load configuration:', e)
        config = getDefaultConfig()
        return config
    }
}

export function getConfig() {
    return config || getDefaultConfig()
}

export function getConfigIdentity() {
    const cfg = getConfig()
    return `${cfg.id || 'unknown'}@${cfg.version || '1.0'}`
}

export function getConfigKey() {
    const identity = getConfigIdentity()
    return `snapshots_${identity}`
}

export function validateAndNormalizeConfig(rawConfig) {
    return validateAndNormalizeConfigInternal(rawConfig)
}

function validateAndNormalizeConfigInternal(rawConfig) {
    // Ensure required fields exist
    const normalized = {
        id: rawConfig.id || 'default',
        version: rawConfig.version || '1.0',
        title: rawConfig.title || 'Python Playground',
        description: rawConfig.description || 'A Python programming environment',
        starter: rawConfig.starter || '# Write your Python code here\nprint("Hello, World!")',
        instructions: rawConfig.instructions || 'Write Python code and click Run to execute it.',
        links: Array.isArray(rawConfig.links) ? rawConfig.links : [],
        runtime: {
            type: rawConfig.runtime?.type || 'micropython',
            url: rawConfig.runtime?.url || './vendor/micropython.wasm'
        },
        execution: {
            timeoutSeconds: Math.max(5, Math.min(300, rawConfig.execution?.timeoutSeconds || 30)),
            maxOutputLines: Math.max(100, Math.min(10000, rawConfig.execution?.maxOutputLines || 1000))
        },
        feedback: {
            ast: Array.isArray(rawConfig.feedback?.ast) ? rawConfig.feedback.ast : [],
            regex: Array.isArray(rawConfig.feedback?.regex) ? rawConfig.feedback.regex : []
        }
    }

    // Validate runtime URL is not empty
    if (!normalized.runtime.url || typeof normalized.runtime.url !== 'string') {
        throw new Error('Configuration must specify a valid runtime URL')
    }

    // Validate ID format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(normalized.id)) {
        throw new Error('Configuration ID must contain only alphanumeric characters, hyphens, and underscores')
    }

    return normalized
}

function getDefaultConfig() {
    return {
        id: 'fallback',
        version: '1.0',
        title: 'Fallback Configuration',
        description: 'Default configuration used when primary config fails to load',
        starter: '# Write your Python code here\nprint("Hello, World!")',
        instructions: 'Configuration failed to load. Using fallback settings.',
        links: [],
        runtime: {
            type: 'micropython',
            url: './vendor/micropython.wasm'
        },
        execution: {
            timeoutSeconds: 30,
            maxOutputLines: 1000
        },
        feedback: {
            ast: [],
            regex: []
        }
    }
}

export function initializeInstructions(cfg) {
    const instructionsContent = $('instructions-content')
    if (instructionsContent) {
        instructionsContent.textContent = cfg?.instructions || 'No instructions provided.'
    }

    // Update configuration display in header
    const configInfo = document.querySelector('.config-info')
    const configTitleLine = document.querySelector('.config-title-line')
    const configTitle = $('#config-title')
    const configVersion = $('#config-version')

    // Set the main display line for tests
    if (configTitleLine) {
        const identity = getConfigIdentity()
        const title = cfg?.title || 'Python Playground'
        configTitleLine.textContent = `${title} (${identity})`
    }

    // Also set individual components for backwards compatibility
    if (configTitle) {
        configTitle.textContent = cfg?.title || 'Python Playground'
    }

    if (configVersion) {
        configVersion.textContent = cfg?.description ? `v${cfg.version} - ${cfg.description}` : `v${cfg.version}`
    }

    // Also update the page title if available
    try {
        if (cfg?.title) {
            document.title = cfg.title
        }
    } catch (_e) { }
}
