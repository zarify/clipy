# Client-side Python Playground

This project is an entirely client-side web page that can be used to deliver
customisable programming scenarios to students who are learning programming
or programming related topics.

The project must NOT use any server-backed infrastructure (beyond sourcing of libraries) and MUST
work when served via a statically generated website or if opened from a local folder.

## Project GUI

- A CodeMirror editor for students to write and edit their own code, backed by local browser storage for saving and version history
- A Python runtime (alternately Micropython for load speed) backed by WASM so students can develop their code without servers or installed software
- A terminal area for IO
- An area for instructions, including any reference or attachment links provided. Instructions should be able to include images or videos inline.
- A feedback mechanism for information for the student based on static analysis of their code or pattern matching based on predefined rules

## Configuration

The page needs to be configurable via a JSON file, stored

- Version of the configuration file, to be matched against any stored version of a scenario in the local browser
- Starter code to be loaded into the editor
- Instructions for the scenario
- Links to references and/or attachments for the scenario
- Feedback rules for static analysis of the code
- Feedback rules for pattern matching of the code (regex)

## Project structure

- All web page and configuration files must be stored in the `src` folder
- Configuration files should be stored in a `config` subfolder
- The `project/completed.md` file must be maintained with a succinct list of implemented features
- The `test` folder should contain any automated tests that can be run against project
- The `test/tests.md` file should contain a summary of each test, what it tests for, and confidence level in coverage and results
- The `test/untested.md` file should contain a succinct list of what is not covered by tests, why it is not covered, and how it might be tested manually

The rest of the project folder structure is not to be polluted with extra files. Use the `project` folder for project related
notes, and only write strictly necessary files to the `src` folder.