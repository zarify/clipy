// Unified IndexedDB-only storage system to replace localStorage/IndexedDB conflicts
// This eliminates the dual storage problems causing page load and config reload issues

import { debug as logDebug, warn as logWarn, error as logError } from './logger.js'

const DB_NAME = 'clipy_unified_storage'
const STORES = {
    CONFIG: 'config',
    SNAPSHOTS: 'snapshots',
    FILES: 'files',
    DRAFTS: 'drafts',
    SETTINGS: 'settings'
}

let dbInstance = null

// Initialize the unified storage database
export async function initUnifiedStorage() {
    if (dbInstance) return dbInstance

    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not available - modern browser required'))
            return
        }

        const request = indexedDB.open(DB_NAME, 1)

        request.onupgradeneeded = (event) => {
            const db = event.target.result

            // Create all stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.CONFIG)) {
                db.createObjectStore(STORES.CONFIG, { keyPath: 'key' })
            }
            if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
                db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(STORES.FILES)) {
                db.createObjectStore(STORES.FILES, { keyPath: 'path' })
            }
            if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
                db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
            }
        }

        request.onsuccess = () => {
            dbInstance = request.result
            logDebug('Unified storage initialized')
            resolve(dbInstance)
        }

        request.onerror = () => {
            reject(request.error || new Error('Failed to open unified storage'))
        }

        request.onblocked = () => {
            reject(new Error('Unified storage blocked - close other tabs'))
        }
    })
}

// Generic storage operations
async function getFromStore(storeName, key) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.get(key)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function putToStore(storeName, data) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.put(data)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function deleteFromStore(storeName, key) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.delete(key)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
    })
}

async function getAllFromStore(storeName) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.getAll()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

// Config storage (replaces localStorage current_config)
export async function saveConfig(config) {
    try {
        await putToStore(STORES.CONFIG, { key: 'current_config', value: config, timestamp: Date.now() })
        logDebug('Config saved to unified storage:', config.id, config.version)
    } catch (error) {
        logError('Failed to save config:', error)
        throw error
    }
}

export async function loadConfig() {
    try {
        const result = await getFromStore(STORES.CONFIG, 'current_config')
        if (result) {
            logDebug('Config loaded from unified storage:', result.value.id, result.value.version)
            return result.value
        }
        return null
    } catch (error) {
        logError('Failed to load config:', error)
        return null
    }
}

export async function clearConfig() {
    try {
        await deleteFromStore(STORES.CONFIG, 'current_config')
        logDebug('Config cleared from unified storage')
    } catch (error) {
        logError('Failed to clear config:', error)
    }
}

// Snapshot storage (replaces localStorage snapshots_*)
export async function saveSnapshots(configIdentity, snapshots) {
    try {
        await putToStore(STORES.SNAPSHOTS, {
            id: configIdentity,
            snapshots,
            timestamp: Date.now()
        })
        logDebug('Snapshots saved for config:', configIdentity)
    } catch (error) {
        logError('Failed to save snapshots:', error)
        throw error
    }
}

export async function loadSnapshots(configIdentity) {
    try {
        const result = await getFromStore(STORES.SNAPSHOTS, configIdentity)
        if (result) {
            return result.snapshots
        }
        return []
    } catch (error) {
        logError('Failed to load snapshots:', error)
        return []
    }
}

export async function clearSnapshots(configIdentity) {
    try {
        await deleteFromStore(STORES.SNAPSHOTS, configIdentity)
        logDebug('Snapshots cleared for config:', configIdentity)
    } catch (error) {
        logError('Failed to clear snapshots:', error)
    }
}

export async function getAllSnapshotConfigs() {
    try {
        const results = await getAllFromStore(STORES.SNAPSHOTS)
        return results.map(r => r.id)
    } catch (error) {
        logError('Failed to get snapshot configs:', error)
        return []
    }
}

// Get all snapshots with metadata (for size calculations, etc.)
export async function getAllSnapshots() {
    try {
        const results = await getAllFromStore(STORES.SNAPSHOTS)
        return results
    } catch (error) {
        logError('Failed to get all snapshots:', error)
        return []
    }
}

// Clear all snapshots regardless of config
export async function clearAllSnapshots() {
    try {
        const db = await initUnifiedStorage()
        const transaction = db.transaction([STORES.SNAPSHOTS], 'readwrite')
        const store = transaction.objectStore(STORES.SNAPSHOTS)

        return new Promise((resolve, reject) => {
            const request = store.clear()
            request.onsuccess = () => {
                logDebug('All snapshots cleared from unified storage')
                resolve()
            }
            request.onerror = () => reject(request.error)
        })
    } catch (error) {
        logError('Failed to clear all snapshots:', error)
        throw error
    }
}

// File storage (replaces localStorage ssg_files_v1)
export async function saveFile(path, content) {
    try {
        await putToStore(STORES.FILES, { path, content, timestamp: Date.now() })
    } catch (error) {
        logError('Failed to save file:', path, error)
        throw error
    }
}

export async function loadFile(path) {
    try {
        const result = await getFromStore(STORES.FILES, path)
        return result ? result.content : null
    } catch (error) {
        logError('Failed to load file:', path, error)
        return null
    }
}

export async function deleteFile(path) {
    try {
        await deleteFromStore(STORES.FILES, path)
    } catch (error) {
        logError('Failed to delete file:', path, error)
    }
}

export async function listFiles() {
    try {
        const results = await getAllFromStore(STORES.FILES)
        return results.map(r => r.path).sort()
    } catch (error) {
        logError('Failed to list files:', error)
        return []
    }
}

// Settings storage (replaces other localStorage items like author_config, etc.)
export async function saveSetting(key, value) {
    try {
        await putToStore(STORES.SETTINGS, { key, value, timestamp: Date.now() })
    } catch (error) {
        logError('Failed to save setting:', key, error)
        throw error
    }
}

export async function loadSetting(key) {
    try {
        const result = await getFromStore(STORES.SETTINGS, key)
        return result ? result.value : null
    } catch (error) {
        logError('Failed to load setting:', key, error)
        return null
    }
}

export async function clearSetting(key) {
    try {
        await deleteFromStore(STORES.SETTINGS, key)
    } catch (error) {
        logError('Failed to clear setting:', key, error)
    }
}

// Migration utility to move existing localStorage data
export async function migrateFromLocalStorage() {
    if (!window.localStorage) return

    logDebug('Starting localStorage migration to unified storage')

    try {
        // Migrate current config
        const currentConfig = localStorage.getItem('current_config')
        if (currentConfig) {
            try {
                const config = JSON.parse(currentConfig)
                await saveConfig(config)
                localStorage.removeItem('current_config')
                logDebug('Migrated current_config')
            } catch (e) {
                logWarn('Failed to migrate current_config:', e)
            }
        }

        // Migrate snapshots
        const snapshotKeys = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('snapshots_')) {
                snapshotKeys.push(key)
            }
        }

        for (const key of snapshotKeys) {
            try {
                const snapshots = JSON.parse(localStorage.getItem(key))
                const configIdentity = key.replace('snapshots_', '')
                await saveSnapshots(configIdentity, snapshots)
                localStorage.removeItem(key)
                logDebug('Migrated snapshots for:', configIdentity)
            } catch (e) {
                logWarn('Failed to migrate snapshots:', key, e)
            }
        }

        // Migrate VFS files
        const vfsFiles = localStorage.getItem('ssg_files_v1')
        if (vfsFiles) {
            try {
                const files = JSON.parse(vfsFiles)
                for (const [path, content] of Object.entries(files)) {
                    await saveFile(path, content)
                }
                localStorage.removeItem('ssg_files_v1')
                logDebug('Migrated VFS files')
            } catch (e) {
                logWarn('Failed to migrate VFS files:', e)
            }
        }

        // Migrate author config
        const authorConfig = localStorage.getItem('author_config')
        if (authorConfig) {
            try {
                const config = JSON.parse(authorConfig)
                await saveSetting('author_config', config)
                localStorage.removeItem('author_config')
                logDebug('Migrated author_config')
            } catch (e) {
                logWarn('Failed to migrate author_config:', e)
            }
        }

        // Migrate other common settings
        const settingsToMigrate = ['autosave', 'student_id', 'students_list']
        for (const key of settingsToMigrate) {
            const value = localStorage.getItem(key)
            if (value) {
                try {
                    await saveSetting(key, JSON.parse(value))
                    localStorage.removeItem(key)
                    logDebug('Migrated setting:', key)
                } catch (e) {
                    // Try as string if JSON parse fails
                    try {
                        await saveSetting(key, value)
                        localStorage.removeItem(key)
                        logDebug('Migrated setting (as string):', key)
                    } catch (e2) {
                        logWarn('Failed to migrate setting:', key, e2)
                    }
                }
            }
        }

        logDebug('localStorage migration completed')
    } catch (error) {
        logError('Migration failed:', error)
    }
}

// Cleanup old localStorage data (run after successful migration)
export function cleanupLocalStorage() {
    if (!window.localStorage) return

    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
            key.startsWith('snapshots_') ||
            key === 'current_config' ||
            key === 'ssg_files_v1' ||
            key === 'author_config' ||
            key === 'autosave' ||
            key === 'student_id' ||
            key === 'students_list'
        )) {
            keysToRemove.push(key)
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    logDebug('Cleaned up localStorage keys:', keysToRemove)
}
