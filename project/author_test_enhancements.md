I would like to add some new features to configuring and running authored tests.

# Test Authoring System Enhancements - Implementation Plan

## Overview
The current test authoring system in Clipy provides a solid foundation for creating and managing individual tests. However, there are several enhancements that would significantly improve the user experience and functionality for test authors working with complex test suites.

## Current Architecture Analysis

### Existing Components
- **`author-tests.js`**: Main authoring interface with modal editing, drag-drop reordering, JSON persistence
- **`test-runner.js`**: Core test execution engine with sequential processing
- **Data Structure**: Flat array of test objects stored in textarea JSON
- **UI Pattern**: Card-based display with inline edit/move/delete controls
- **Modal System**: Shared modal for editing test properties

### Current Test Object Structure
```javascript
{
  id: 't-123-abc',
  description: 'Test description',
  stdin: 'input',
  expected_stdout: 'output',
  expected_stderr: null,
  timeoutMs: 30000,
  // ... other test properties
}
```

## Requested Enhancements

### 1. Grouped Tests with Optional Visibility
**Current State**: All tests are displayed as individual cards in a flat list
**Desired State**: Tests can be organized into logical groups with collapsible sections

**Requirements**:
- Tests should be able to be grouped together under a common heading/label
- Groups should be collapsible/expandable to reduce visual clutter
- Individual tests within a group should maintain their current edit/delete/move functionality
- Groups should have their own management options (rename, delete entire group, etc.)
- The JSON structure should cleanly represent the grouped organization

**Implementation Requirements**:

#### Data Structure Changes
```javascript
// Proposed new structure - nested groups
{
  "groups": [
    {
      "id": "group-1",
      "name": "Basic Functionality", 
      "collapsed": false,
      "tests": [
        { id: 't1', description: 'Test 1', /* existing test props */ },
        { id: 't2', description: 'Test 2', /* existing test props */ }
      ]
    },
    {
      "id": "group-2", 
      "name": "Error Handling",
      "collapsed": true,
      "tests": [...]
    }
  ],
  "ungrouped": [
    // Tests not in any group
    { id: 't3', description: 'Standalone test', /* existing test props */ }
  ]
}
```

#### UI Component Changes
- **New Components Needed**:
  - `createGroupHeader()`: Collapsible group header with rename/delete options
  - `createGroupCard()`: Container for group with drag-drop zones
  - Group management modal for creating/editing groups
- **Modified Components**:
  - `createCard()`: Add group membership indicators, modify drag-drop behavior
  - `initAuthorTests()`: Handle nested rendering and group state management
- **New Controls**:
  - "Create Group" button alongside existing "Add test"/"Add AST test" buttons
  - Group collapse/expand toggles
  - "Move to group" option in test context menus

### 2. Test Numbering Based on Order  
**Current State**: Tests are identified by their description and manual IDs
**Desired State**: Tests should show clear numeric indicators based on their current order

**Requirements**:
- Tests should display numbers (1, 2, 3, etc.) that reflect their current position in the sequence
- When tests are reordered via drag-and-drop, the numbers should update accordingly
- The numbering should be purely visual and not affect the underlying test execution
- Grouped tests should have sub-numbering (e.g., Group 1: 1.1, 1.2, 1.3)

**Implementation Requirements**:

#### Display Logic Changes
- **Modified Functions**:
  - `createCard()`: Add dynamic numbering display based on position
  - `render()`: Calculate and display numbers for groups and tests
- **Numbering Strategy**:
  - Groups: Sequential numbering (Group 1, Group 2, etc.)
  - Tests within groups: Group.Test format (1.1, 1.2, 2.1, 2.2)
  - Ungrouped tests: Continue global sequence after grouped tests
- **Update Triggers**:
  - Drag-drop reordering should immediately update visible numbers
  - Group collapse/expand should not affect numbering
  - Test addition/deletion should recalculate all numbers

### 3. Conditional Execution Based on Previous Test/Group Passing
**Current State**: All tests run sequentially regardless of previous test results
**Desired State**: Tests can be configured to run conditionally based on previous test or group success

**Requirements**:
- Individual tests should have an option "only run if previous test passed"
- Individual tests should have an "always run" override that ignores conditional logic
- Groups should have an option "only run if previous group passed"
- The execution engine should respect these conditions and skip tests appropriately
- Skipped tests should be clearly indicated in the results with reasons

**Implementation Requirements**:

#### Data Structure Extensions
```javascript
// Extended test object structure
{
  id: 't1',
  description: 'Test 1',
  // Existing properties...
  conditional: {
    runIf: 'previous_passed',    // 'always' | 'previous_passed' | 'previous_group_passed'
    alwaysRun: false             // Override conditional logic
  }
}

// Extended group structure  
{
  id: 'group-1',
  name: 'Basic Tests',
  conditional: {
    runIf: 'previous_group_passed', // Group-level conditional
    alwaysRun: false
  },
  tests: [...]
}
```

#### Test Runner Changes
- **Modified Functions**:
  - `runTests()` in `test-runner.js`: Add conditional execution logic
  - New function `shouldRunTest(test, previousResults, groupResults)`
  - New function `shouldRunGroup(group, previousGroupResults)`
- **Execution Flow**:
  1. Process groups in order
  2. For each group, check group-level conditions
  3. For each test in group, check test-level conditions
  4. Skip tests/groups that don't meet conditions
  5. Record skip reasons in results
- **Result Structure Extensions**:
```javascript
{
  id: 't1',
  passed: null,      // null for skipped tests
  skipped: true,     // New field
  skipReason: 'previous_test_failed', // Reason for skipping
  // Existing result fields...
}
```

#### UI Form Changes
- **Modified Components**:
  - `buildEditorForm()`: Add conditional execution controls
  - Test editing modal: Add "Run Conditions" section
  - Group editing modal: Add group-level conditional options
- **New Controls**:
  - Radio buttons: "Always run" / "Run if previous test passed" / "Run if previous group passed"  
  - Checkbox: "Always run (override conditions)"
  - Help text explaining conditional behavior

## Migration Strategy

### Backward Compatibility
- **Loading Legacy Configs**: Automatically wrap existing test arrays in default structure
```javascript
// Legacy format detection and conversion
function migrateTestConfig(config) {
  if (Array.isArray(config)) {
    // Old flat array format
    return {
      groups: [],
      ungrouped: config.map(test => ({
        ...test,
        conditional: { runIf: 'always', alwaysRun: false }
      }))
    };
  }
  return config; // Already new format
}
```

### Data Model Transition
1. **Phase 1**: Support both old and new formats in reader/writer functions
2. **Phase 2**: Auto-migrate on first edit of legacy configs  
3. **Phase 3**: Maintain backward compatibility indefinitely

## Development Task Breakdown

### Core Infrastructure
1. **Data Structure Support**
   - Extend `parseTestsFromTextarea()` to handle grouped format
   - Update `writeTestsToTextarea()` to serialize groups
   - Add migration function for legacy configs

2. **UI Rendering Engine**  
   - Create group rendering components
   - Modify test card rendering for numbering
   - Implement collapsible group headers

3. **Test Execution Engine**
   - Add conditional logic to `runTests()`
   - Implement skip tracking and reporting
   - Handle group-level execution control

### User Interface Components
1. **Group Management**
   - Group creation/editing modals
   - Drag-drop between groups
   - Group header controls (collapse, rename, delete)

2. **Test Numbering**
   - Dynamic number calculation
   - Visual number display in cards
   - Number updates on reordering

3. **Conditional Controls**
   - Conditional settings in test edit modal
   - Group conditional settings
   - Visual indicators for conditional tests

### Testing & Validation
1. **Unit Tests**
   - Test conditional execution logic
   - Verify data migration functions
   - Test group management operations

2. **Integration Tests** 
   - End-to-end authoring workflow
   - Group creation and test execution
   - Migration of existing configurations

3. **UI Tests**
   - Drag-drop functionality across groups
   - Modal interactions for group/conditional settings
   - Number display updates on reordering

## Risk Assessment

### Technical Risks
- **Complexity**: Nested data structure increases code complexity
- **Performance**: Large test suites with many groups may impact UI responsiveness  
- **Migration**: Risk of data loss during format conversion

### Mitigation Strategies
- Maintain comprehensive unit test coverage for data operations
- Implement incremental migration with rollback capability
- Add performance monitoring for large test suite rendering
- Provide export/import functionality for configuration backup

## Success Criteria
- Test authors can create and manage grouped tests efficiently
- Test numbering updates dynamically and accurately reflects order
- Conditional execution works reliably with clear skip indication
- Existing test configurations migrate seamlessly
- Performance remains acceptable for test suites up to 100+ tests