Modify the current methods for loading configurations.

Currently the `config/index.json` file holds configs that are discoverable to the main app, either through loading using the `?config=filename` method, or when in author mode and shown in the config modal. When the app is not in author mode loading configs is done via a URL parameter.

This is how the app should behave now.

When **not** in author mode:
- The current config in `config-title-line` should be changed to a drop-down menu showing all of the configs available in the loaded config list.
- Choosing a different config from the list loads that config into the workspace and loads the latest snapshot for that config as it currently does when changing configurations.
- Add a new URL param (`?configList`) to be able to load a new list of configs from a remote server. These config file names should be able to be either relative file names or fully qualified URLs, e.g. `my-problem-1.json` or `https://domain.name/path/my-problem-1.json`. If they are relative paths then they should adopt the URL and path of the loaded config list. The config list should follow the same format as the current `config/index.json` which is a simple array of configs.
- The `configList` parameter should be incompatible with the `config` parameter. If both are present, load the list.
- If invalid an invalid `configList` or `config` is loaded, present the safe default config in the app as is currently done, showing a warning in a modal.

When **in** author mode:
- Change the current behaviour of making the `config-title-line` into a button so that it presents a list as when authoring is not enabled. Instead add a small `Author` button to the left of the `config-title-line` element that opens the authoring modal as it does currently.