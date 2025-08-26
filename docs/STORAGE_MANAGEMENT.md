# Storage Management System

## Overview

Clipy now includes a comprehensive storage management system that handles localStorage quota limits gracefully and provides users with tools to manage their data.

## Features

### 🚨 **Quota Handling**
- Automatic detection of `QuotaExceededError`
- User-friendly modal with cleanup options
- Graceful degradation when storage is full

### 📊 **Storage Monitoring**
- Real-time storage usage tracking
- Breakdown by category (snapshots, files, etc.)
- Warning thresholds (80% and 90% capacity)

### 🧹 **Cleanup Options**
- **Cleanup Old Snapshots**: Keep only 3 most recent snapshots for current config
- **Cleanup Other Configs**: Remove snapshots from other configurations
- **Emergency Cleanup**: Remove all snapshot and file data
- **Selective Deletion**: Manual snapshot selection in modal

## Usage

### Browser Console Commands
```javascript
// Show detailed storage usage
window.showStorageInfo()

// Check storage health
// (automatically runs on app startup)
```

### UI Features
- **Storage Info button** in snapshot modal
- **Automatic warnings** when storage gets full
- **Interactive cleanup modal** when quota exceeded

## Storage Limits

| Storage Type | Limit | Shared |
|--------------|-------|---------|
| localStorage | ~5-10MB | Site-wide |
| IndexedDB | ~1GB+ | Site-wide |
| SessionStorage | ~5-10MB | Tab-specific |

## Storage Breakdown

### Current Storage Usage:
- **Snapshots**: `snapshots_config-id@version` keys
- **Files**: `ssg_files_v1` mirror
- **Autosave**: `autosave` key  
- **Other**: Any additional localStorage data

### Config-Specific Isolation:
Each configuration gets its own snapshot storage:
- `snapshots_default-playground@1.0.0`
- `snapshots_my-custom-config@2.1.0`
- etc.

## Error Handling

### Quota Exceeded Flow:
1. User performs action (save snapshot, write file)
2. `QuotaExceededError` thrown
3. Storage usage calculated
4. User presented with cleanup options
5. Selected cleanup performed
6. Operation retried automatically

### Cleanup Strategies:
- **Conservative**: Remove old snapshots only
- **Moderate**: Remove other configs' snapshots  
- **Aggressive**: Remove all storage data (with confirmation)

## Technical Implementation

### Safe Storage Operations:
```javascript
import { safeSetItem } from './storage-manager.js'

// Instead of:
localStorage.setItem(key, value)

// Use:
const result = safeSetItem(key, value)
if (!result.success) {
    console.error(result.error)
}
```

### Storage Health Monitoring:
```javascript
import { checkStorageHealth } from './storage-manager.js'

// Check on app startup
checkStorageHealth()
```

## Browser Compatibility

### Private/Incognito Mode:
- ✅ localStorage fallback works reliably
- ❌ IndexedDB may have limited persistence
- ✅ All cleanup options available

### Normal Browsing:
- ✅ Full IndexedDB persistence
- ✅ localStorage mirroring for compatibility
- ✅ All features available

## Testing

Storage management is tested via:
- Unit tests for storage operations
- Integration tests for quota handling
- UI tests for cleanup workflows
- Cross-browser compatibility tests
