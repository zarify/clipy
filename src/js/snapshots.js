// Exported for use in autosave.js
export { getSnapshotsForCurrentConfig, saveSnapshotsForCurrentConfig }

// Restore from the special 'current' snapshot if it exists
export async function restoreCurrentSnapshotIfExists() {
    const snaps = getSnapshotsForCurrentConfig()
    const idx = snaps.findIndex(s => s.id === '__current__')
    if (idx !== -1) {
        await restoreSnapshot(idx, snaps)
        return true
    }
    return false
}
// Snapshot management system
import { $ } from './utils.js'
import { getFileManager, MAIN_FILE, getBackendRef, getMem } from './vfs.js'
import { openModal, closeModal, showConfirmModal } from './modals.js'
import { appendTerminal } from './terminal.js'
import { getConfigKey, getConfigIdentity } from './config.js'
import { safeSetItem, checkStorageHealth, showStorageInfo } from './storage-manager.js'

export function setupSnapshotSystem() {
    const saveSnapshotBtn = $('save-snapshot')
    const historyBtn = $('history')
    const clearStorageBtn = $('clear-storage')

    if (saveSnapshotBtn) {
        saveSnapshotBtn.addEventListener('click', saveSnapshot)
    }

    if (historyBtn) {
        historyBtn.addEventListener('click', openSnapshotModal)
    }

    if (clearStorageBtn) {
        clearStorageBtn.addEventListener('click', clearStorage)
    }

    // Check storage health on startup
    setTimeout(() => checkStorageHealth(), 1000)
}

function getSnapshotStorageKey() {
    const identity = getConfigIdentity()
    return `snapshots_${identity}`
}

function getSnapshotsForCurrentConfig() {
    const storageKey = getSnapshotStorageKey()
    const configIdentity = getConfigIdentity()

    try {
        const snaps = JSON.parse(localStorage.getItem(storageKey) || '[]')

        // Filter to only include snapshots that match current config identity
        return snaps.filter(snap => {
            if (!snap.config) return false // Skip legacy snapshots without config info
            if (typeof snap.config === 'string') {
                return snap.config === configIdentity
            }
            // For object-style config, convert to string for comparison
            if (snap.config.id && snap.config.version) {
                return `${snap.config.id}@${snap.config.version}` === configIdentity
            }
            return false
        })
    } catch (e) {
        console.error('Failed to load snapshots:', e)
        return []
    }
}

function saveSnapshotsForCurrentConfig(snapshots) {
    const storageKey = getSnapshotStorageKey()
    try {
        const result = safeSetItem(storageKey, JSON.stringify(snapshots))
        if (!result.success) {
            throw new Error(result.error || 'Failed to save snapshots')
        }
        if (result.recovered) {
            appendTerminal('Snapshots saved after storage cleanup')
        }
    } catch (e) {
        console.error('Failed to save snapshots:', e)
        throw e
    }
}

async function saveSnapshot() {
    try {
        const snaps = getSnapshotsForCurrentConfig()
        const configIdentity = getConfigIdentity()

        const snap = {
            ts: Date.now(),
            config: configIdentity,
            files: {}
        }

        const FileManager = getFileManager()
        const mem = getMem()
        const backendRef = getBackendRef()

        // Use the global FileManager as the authoritative source for snapshot contents
        try {
            if (FileManager && typeof FileManager.list === 'function') {
                const names = FileManager.list()
                for (const n of names) {
                    try {
                        const v = await Promise.resolve(FileManager.read(n))
                        if (v != null) snap.files[n] = v
                    } catch (_e) { }
                }
            } else if (mem && Object.keys(mem).length) {
                for (const k of Object.keys(mem)) snap.files[k] = mem[k]
            } else if (backendRef && typeof backendRef.list === 'function') {
                const names = await backendRef.list()
                for (const n of names) {
                    try {
                        snap.files[n] = await backendRef.read(n)
                    } catch (_e) { }
                }
            } else {
                // fallback to localStorage mirror
                try {
                    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                    for (const k of Object.keys(map)) snap.files[k] = map[k]
                } catch (_e) { }
            }
        } catch (e) {
            try {
                const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                for (const k of Object.keys(map)) snap.files[k] = map[k]
            } catch (_e) { }
        }

        snaps.push(snap)
        saveSnapshotsForCurrentConfig(snaps)

        const identity = getConfigIdentity()
        appendTerminal(`Snapshot saved for ${identity} (${new Date(snap.ts).toLocaleString()})`, 'runtime')
        // Signal to tests and other code that a snapshot save has completed.
        // Only expose this signal in dev mode so production doesn't leak test hooks.
        try {
            if (typeof window !== 'undefined' && window.__ssg_dev_mode) {
                // timestamp is more informative than boolean
                window.__ssg_snapshot_saved = Date.now()
            }
        } catch (_e) { }
    } catch (e) {
        appendTerminal('Snapshot save failed: ' + e, 'runtime')
    }
}

function renderSnapshots() {
    const snapshotList = $('snapshot-list')
    if (!snapshotList) return

    const snaps = getSnapshotsForCurrentConfig()
    const configIdentity = getConfigIdentity()

    if (!snaps.length) {
        snapshotList.innerHTML = `<div class="no-snapshots">No snapshots for ${configIdentity}</div>`
        return
    }

    snapshotList.innerHTML = ''
    snaps.forEach((s, i) => {
        const div = document.createElement('div')
        div.className = 'snapshot-item'

        const left = document.createElement('div')
        left.innerHTML = `<label><input type="checkbox" data-idx="${i}"> ${new Date(s.ts).toLocaleString()}</label>`

        const right = document.createElement('div')
        const restore = document.createElement('button')
        restore.textContent = 'Restore'
        restore.addEventListener('click', () => restoreSnapshot(i, snaps))

        // Show file count as additional info
        const fileCount = Object.keys(s.files || {}).length
        const info = document.createElement('small')
        info.textContent = ` (${fileCount} files)`
        info.style.marginLeft = '8px'
        info.style.color = '#666'

        right.appendChild(restore)
        left.appendChild(info)
        div.appendChild(left)
        div.appendChild(right)
        snapshotList.appendChild(div)
    })
}

async function restoreSnapshot(index, snapshots) {
    try {
        const s = snapshots[index]
        if (!s) return

        const snap = s

        const backend = window.__ssg_vfs_backend
        const { mem } = await window.__ssg_vfs_ready.catch(() => ({ mem: window.__ssg_mem }))
        const FileManager = window.FileManager

        if (backend && typeof backend.write === 'function') {
            // Clear existing files from backend
            try {
                if (typeof backend.clear === 'function') {
                    await backend.clear()
                } else if (typeof backend.list === 'function' && typeof backend.delete === 'function') {
                    // If no clear method, delete files individually
                    const existingFiles = await backend.list()
                    for (const filePath of existingFiles) {
                        try {
                            await backend.delete(filePath)
                        } catch (e) {
                            console.error('Failed to delete existing file from backend:', filePath, e)
                        }
                    }
                }
            } catch (e) {
                console.error('Backend clear/delete failed:', e)
            }

            // Write snapshot files to backend
            for (const [path, content] of Object.entries(snap.files || {})) {
                try {
                    await backend.write(path, content)
                } catch (e) {
                    console.error('Failed to write to backend:', path, e)
                }
            }

            // Replace in-memory mirror with snapshot contents for synchronous reads
            try {
                if (mem) {
                    Object.keys(mem).forEach(k => delete mem[k])
                    for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
                }
            } catch (e) {
                console.error('Failed to update mem:', e)
            }
        } else if (mem) {
            // Replace mem entirely so files from other snapshots are removed
            try {
                Object.keys(mem).forEach(k => delete mem[k])
                for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
            } catch (e) {
                console.error('Failed to update mem directly:', e)
            }

            try {
                const newMap = Object.create(null)
                for (const k of Object.keys(mem)) newMap[k] = mem[k]
                localStorage.setItem('ssg_files_v1', JSON.stringify(newMap))
            } catch (e) {
                console.error('Failed to update localStorage:', e)
            }
        }

        // Reconcile via FileManager to ensure mem/localStorage/backend are consistent
        try {
            if (FileManager && typeof FileManager.list === 'function') {
                const existing = FileManager.list() || []
                for (const p of existing) {
                    try {
                        if (p === MAIN_FILE) continue
                        if (!Object.prototype.hasOwnProperty.call(snap.files || {}, p)) {
                            await Promise.resolve(FileManager.delete(p))
                        }
                    } catch (e) {
                        console.error('Failed to delete file:', p, e)
                    }
                }
                for (const p of Object.keys(snap.files || {})) {
                    try {
                        await Promise.resolve(FileManager.write(p, snap.files[p]))
                    } catch (e) {
                        console.error('Failed to write via FileManager:', p, e)
                    }
                }
            }
        } catch (e) {
            console.error('FileManager reconciliation failed:', e)
        }

        // Definitively replace in-memory map with snapshot contents to avoid any stale entries
        try {
            if (mem) {
                Object.keys(mem).forEach(k => delete mem[k])
                for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
                try {
                    localStorage.setItem('ssg_files_v1', JSON.stringify(mem))
                } catch (e) {
                    console.error('Final localStorage update failed:', e)
                }
            }
        } catch (e) {
            console.error('Final mem update failed:', e)
        }

        const modal = $('snapshot-modal')
        closeModal(modal)
        appendTerminal('Snapshot restored (' + new Date(s.ts).toLocaleString() + ')', 'runtime')

        try {
            // Allow a tiny delay to ensure backend writes are flushed before signalling restore completion.
            setTimeout(() => {
                try {
                    if (typeof window !== 'undefined' && window.__ssg_dev_mode) {
                        window.__ssg_last_snapshot_restore = Date.now()
                    }
                } catch (e) { console.error('Failed to set restore flag (delayed):', e) }
            }, 100)
        } catch (e) {
            console.error('Failed to schedule restore flag:', e)
        }

        // Open only MAIN_FILE as focused tab
        try {
            if (window.TabManager && typeof window.TabManager.openTab === 'function') {
                window.TabManager.openTab(MAIN_FILE)
            }
            if (window.TabManager && typeof window.TabManager.selectTab === 'function') {
                window.TabManager.selectTab(MAIN_FILE)
            }
        } catch (e) {
            console.error('Tab management failed:', e)
        }
    } catch (e) {
        console.error('restoreSnapshot failed:', e)
        appendTerminal('Snapshot restore failed: ' + e, 'runtime')
    }
}

function openSnapshotModal() {
    const modal = $('snapshot-modal')
    if (!modal) return

    renderSnapshots()
    openModal(modal)

    // Setup modal controls
    const closeBtn = $('close-snapshots')
    const deleteBtn = $('delete-selected')
    const storageInfoBtn = $('storage-info')

    if (closeBtn) {
        closeBtn.removeEventListener('click', closeSnapshotModal) // Remove any existing listeners
        closeBtn.addEventListener('click', closeSnapshotModal)
    }

    if (deleteBtn) {
        deleteBtn.removeEventListener('click', deleteSelectedSnapshots) // Remove any existing listeners
        deleteBtn.addEventListener('click', deleteSelectedSnapshots)
    }

    if (storageInfoBtn) {
        storageInfoBtn.removeEventListener('click', showStorageInfoInTerminal)
        storageInfoBtn.addEventListener('click', showStorageInfoInTerminal)
    }
}

function showStorageInfoInTerminal() {
    showStorageInfo()
}

function closeSnapshotModal() {
    const modal = $('snapshot-modal')
    closeModal(modal)
}

function deleteSelectedSnapshots() {
    const snapshotList = $('snapshot-list')
    if (!snapshotList) return

    const checks = Array.from(snapshotList.querySelectorAll('input[type=checkbox]:checked'))
    if (!checks.length) {
        appendTerminal('No snapshots selected for deletion', 'runtime')
        return
    }

    const idxs = checks.map(c => Number(c.getAttribute('data-idx'))).sort((a, b) => b - a)
    const snaps = getSnapshotsForCurrentConfig()

    for (const i of idxs) snaps.splice(i, 1)
    saveSnapshotsForCurrentConfig(snaps)
    renderSnapshots()

    appendTerminal(`Deleted ${idxs.length} snapshot(s)`, 'runtime')
}

async function clearStorage() {
    const configIdentity = getConfigIdentity()

    const ok = await showConfirmModal(
        'Clear snapshots',
        `Clear all saved snapshots for ${configIdentity}? This cannot be undone.`
    )
    if (!ok) {
        appendTerminal('Clear snapshots cancelled', 'runtime')
        return
    }

    try {
        const storageKey = getSnapshotStorageKey()
        localStorage.removeItem(storageKey)
        appendTerminal(`Cleared all snapshots for ${configIdentity}`, 'runtime')

        // Update the modal if it's open
        try {
            renderSnapshots()
        } catch (_e) { }
    } catch (e) {
        appendTerminal('Clear snapshots failed: ' + e, 'runtime')
    }
}
