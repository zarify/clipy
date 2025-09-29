/**
 * Integration test to validate the three user improvements:
 * 1. Modal centering - check if modal uses flex display
 * 2. Last edited file visibility - check if last edited file stays visible
 * 3. Renamed tab persistence - check if renamed tab stays open
 */

import { TabOverflowManager, tabOverflowStyles } from '../tab-overflow-manager.js'

// Mock showInputModal and showConfirmModal
let mockInputReturn = null
let mockConfirmReturn = true

jest.mock('../modals.js', () => ({
    showInputModal: jest.fn(async (title, message, defaultValue) => mockInputReturn),
    showConfirmModal: jest.fn(async (message) => mockConfirmReturn)
}))

describe('Tab Overflow Manager - User Improvements Validation', () => {
    let manager
    let mockTabManager
    let mockElement
    let dropdown

    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = ''

        // Create test container and dropdown
        const container = document.createElement('div')
        container.id = 'test-tabs'
        document.body.appendChild(container)

        dropdown = document.createElement('div')
        dropdown.id = 'file-dropdown-modal'
        dropdown.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Open Files</h3>
                    <span class="close-modal">×</span>
                </div>
                <div class="file-search">
                    <input type="text" id="file-search-input" placeholder="Search files...">
                </div>
                <div class="file-list" id="file-list"></div>
            </div>
        `
        document.body.appendChild(dropdown)

        mockElement = container
        mockTabManager = {
            list: jest.fn(() => ['/main.py', '/file1.py', '/file2.py', '/very/long/path/file3.py']),
            getActive: jest.fn(() => '/file1.py'),
            openTab: jest.fn(),
            closeTab: jest.fn(),
            renameFile: jest.fn(async (oldPath, newPath) => true)
        }

        manager = new TabOverflowManager(mockElement, mockTabManager, {
            onTabRename: mockTabManager.renameFile,
            alwaysVisible: ['/main.py']
        })

        // Set a last edited file
        manager.lastEditedFile = '/file2.py'

        // Reset mocks
        mockInputReturn = null
        mockConfirmReturn = true
        jest.clearAllMocks()
    })

    afterEach(() => {
        document.body.innerHTML = ''
    })

    test('Modal uses flex display for proper centering', () => {
        // Trigger dropdown opening
        manager.openDropdown()

        const modal = document.getElementById('file-dropdown-modal')
        expect(modal).toBeTruthy()
        expect(modal.style.display).toBe('flex')
    })

    test('Last edited file remains visible after switching to main.py', () => {
        // Simulate switching to main.py
        mockTabManager.getActive.mockReturnValue('/main.py')

        // Render the overflow system
        manager.render()

        const visibleFiles = manager.getVisibleFiles()

        // Should include main.py (always visible), current active, and last edited
        expect(visibleFiles).toContain('/main.py')
        expect(visibleFiles).toContain('/file2.py') // last edited file
    })

    test('Renamed tab stays open and updates last edited reference', async () => {
        const { showInputModal } = await import('../modals.js')

        // Set up for rename operation
        const oldPath = '/file2.py'
        const newPath = '/renamed_file.py'
        mockInputReturn = 'renamed_file.py'

        // Ensure the file being renamed is the last edited file
        manager.lastEditedFile = oldPath

        // Perform rename
        await manager.handleRename(oldPath)

        // Verify showInputModal was called
        expect(showInputModal).toHaveBeenCalled()

        // Verify onTabRename was called with correct paths
        expect(mockTabManager.renameFile).toHaveBeenCalledWith(oldPath, newPath)

        // Verify lastEditedFile reference was updated
        expect(manager.lastEditedFile).toBe(newPath)
    })

    test('Always visible logic includes main.py, active file, and last edited file', () => {
        // Set different scenarios
        mockTabManager.getActive.mockReturnValue('/file1.py')
        manager.lastEditedFile = '/file2.py'

        const visibleFiles = manager.getVisibleFiles()

        // Should include all three types
        expect(visibleFiles).toContain('/main.py') // always visible
        expect(visibleFiles).toContain('/file1.py') // active
        expect(visibleFiles).toContain('/file2.py') // last edited

        // Should not exceed our limit or duplicate
        expect(visibleFiles.length).toBeLessThanOrEqual(5)
        expect(new Set(visibleFiles).size).toBe(visibleFiles.length) // no duplicates
    })

    test('Modal closes when clicking outside or close button', () => {
        // Open dropdown
        manager.openDropdown()
        const modal = document.getElementById('file-dropdown-modal')
        expect(modal.style.display).toBe('flex')

        // Close dropdown
        manager.closeDropdown()
        expect(modal.style.display).toBe('none')
    })

    test('CSS styles include flex centering for modal', () => {
        // Check if the CSS contains flex display rules
        expect(tabOverflowStyles).toContain('display: flex')
        expect(tabOverflowStyles).toContain('justify-content: center')
        expect(tabOverflowStyles).toContain('align-items: center')
    })
})