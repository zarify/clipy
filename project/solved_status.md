Students should have some persistent indicators that they have completed problems from a config that they have passed all the tests for.

This should be implemented in a few different places.

Success snapshots:
- Each config/version combination should record a special "success" snapshot when all tests are passed.
- The success snapshot should be a single special purpose snapshot per config/version, and so needs to be overwritten when a test suite is fully passed for the same config/version so we don't pollute the snapshot history.
- The success snapshot should be cleared when history is cleared, just like other snapshots, and should be able to be manually cleared by the user like other snapshots.

Page heading:
- The `app-title` heading should gain a success indicator next to it (green colour accent and star icon).
- The success indicator should be shown if:
  - A single config is loaded and all tests have been passed (success snapshot exists for it)
  - A config list is loaded and all configs in the list have been passed (success snapshots exist for each one)

`config-title-line` - single config loaded:
- The config title should get a success indicator (green colour accent and star icon) next to it if all of the tests have been passed (success snapshot exists for it).

`config-select-header` - config list loaded
- Each config file in the list should have a success indicator (green colour accent and star icon) if a success snapshot exists for it.