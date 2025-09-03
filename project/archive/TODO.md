# Filesystem and UI
- Add an option for students to download the code from their workspace as a zip archive. This should be available from the main UI as well as for each snapshot in the history.

# User interface
- Add another tab to the instructions and terminal panel for feedback. This will be populated by editing time feedback, runtime feedback, and for the results of unit tests.

# Feedback
- A new file for feedback needs to be created as this will get complex
- Feedback will be defined by authors in the config file
- When code is run, all feedback is reset to the default for the config file
- Regex pattern based feedback at edit time.
  - Patterns should be able to be matched on code or filenames (presence or lack of)
  - The feedback should be clickable and highlights the relevant line of code that matched the pattern
  - Clicking feedback again or clicking another bit of feedback should switch the highlight to the new line or file
  - Feedback should be optionally always visible (with a checked/unchecked visual) or only being visible when the pattern matches
- Regex pattern based feedback at edit time
  - Patterns should be able to be matched on stdout, stdin, or stderr
  - Optionally always visible or only visible when the pattern matches
- AST based matching at edit time

# Program testing
- This should be another script file as it will be complex
- Test output should appear in a section of the Feedback area of the UI when a program is run
- Authors should be able to define a suite of tests with simplified types to be stored in the problem config and run against a program on completion. Feedback can be prepared to help explain test results to students for pass and fail.
- Program stdin, stdout, and stderr all captured when a program is run
  - Stored data can be matched against pattern based rules
  - Can verify the data type of outputs

# Author tools
- A new page will need to be created with authoring tools that assist with creating new config files
- Config files should be able to be loaded, with automatic version bumping being done when the author saves an updated file
  - Use minor versions for changes that don't add new keys to the config file, or only instructions or feedback are changed
  - Use major versions when tests are added or the filesystem or starting code is changed