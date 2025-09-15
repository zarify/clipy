# The Authoring interface

## Working with config files

There are two parts of the authoring interface: problem authoring, and
configuration management. Because this is a client-side application there
is no server storage, syncing, etc of problem files. Instead, we can
work on drafts out of browser storage, or import and export JSON files.

![Author configuration buttons](img/authoring_configs_buttons.png)

### Drafts

Draft configurations can be saved and loaded from browser storage. This
allows you to work on multiple different problems, save different versions,
and test them until you are ready to export a file. Because this relies on
browser storage, changing web browser, computer, or using the app in private
browsing mode will affect whether you can see your prior versions.

> [!WARNING]
> Storage is managed through IndexedDB, so will be limited by anything
> that modifies the behaviour of that in the browser. Private browsing may
> prevent the use of IndexedDB, and editing files will be lost when a
> private window is closed.

Saving drafts will update any previously saved draft of the same config ID
and version. If the version is bumped then it will be saved in a new slot.

### Importing and exporting

Config files can be imported and exported from disk.

Exporting a config will use the config ID and version as the file name with
the `.json` file extension: `example-config@1.0.json`

Importing a config file will overwrite the current author config, so save
a draft if necessary.

### The current author config

When working on a problem in the authoring interface, in addition to drafts,
a special slot is used

## Building a problem configuration

![Configuration categories](img/authoring_data_buttons.png)

### Metadata

Each problem configuration has the following metadata stored for it:
- Name (human friendly, used when displaying the problem)
- ID (machine-friendly, used when saving and loading drafts and snapshots)
- Version (major.minor semantic versioning, used by saving/loading)
- Description (only for authors)

### Instructions
Instructions, markdown, and the preview.

### Code & Files
[More about code and files here](code_and_files.md)

### Feedback

- [Building string-based feedback](feedback_string.md)
- [Building regular expression-based feedback](feedback_regex.md)
- [Building AST-based feedback](feedback_ast.md)

### Tests

- [Building basic tests](tests_basics.md)
- [Conditional test runs](tests_conditional_runs.md)
- [Building test groups](tests_groups.md)

### Verification
