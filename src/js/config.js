// Configuration loading and management
import { $ } from './utils.js'

export const configUrl = './config/sample.json'

let config = null

export async function loadConfig() {
    if (config) return config

    try {
        const res = await fetch(configUrl)
        config = await res.json()
        return config
    } catch (e) {
        config = {}
        return config
    }
}

export function getConfig() {
    return config || {}
}

export function initializeInstructions(cfg) {
    const instructionsContent = $('instructions-content')
    if (instructionsContent) {
        instructionsContent.textContent = cfg?.instructions || 'No instructions provided.'
    }
}
