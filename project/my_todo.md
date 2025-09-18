# This is my personal todo
- [ ] Write user documentation
- [ ] Write author documentation
- [ ] Make a logo
- [ ] Make a favicon
- [ ] Dark mode (pretty damned involved - get the agent to build a list of every hard coded colour style first)
- [ ] Add exemplars for different types of feedback and tests, include with docs
- [ ] New playwright and other tests
- [ ] Make back end catch up with front end. Need to be able to load a config list there too, maybe make it local to the verification panel?
- [ ] Investigate using Pyodide as well.
  - See https://pyodide.org/en/stable/usage/faq.html for some of the issues we've seen here
  - https://pyodide.org/en/stable/usage/keyboard-interrupts.html
  - Can we get around some of the issues with interrupts and async input by running the VM in an iframe like we did the test runner?

# Bug list
- `stderr` feedback isn't working

# Feedback and testing improvements
- [ ] Add a 'call' check for calling inbuilt or predefined functions
- [ ] Check for any XSS issues from program output rendering in the `actual` output part of tests.

# Done
- [x] If no message is given for a feedback rule, just tick off the item, don't print a message underneath
- [x] When loading up the page and trying to load a previous list of configs, it's looking in the local config repository and erroring because they're not there
- [x] The reload config button needs to do something more obvious instead of reloading the server config
- [x] Reloading the workspace or loading a config should clear files before adding new ones
    - Check whether feedback and tests are being loaded/cleared correct as well, especially if the incoming config has empty arrays for these
- [x] We should be able to mark files in the config workspace as readonly to the user
- [x] Maybe switch to IndexedDB support only - check browser support - localStorage and IndexedDB seem to fight when loading the page and when the reload config button is used
- [x] Continue with the jest tests
- [x] Add the ability to attach files to tests
- [x] Marking code needs to send the user workspace, not just the `main.py` code. Currently trying to read a file in userspace fails because it doesn't get sent for marking
- [x] Tests that always run vs tests that only run if previous passes
- [x] AST support for feedback and tests
- [x] Implement save and restore drafts
- [x] Is there a way of verifying a student has solved a problem in a zero-knowledge way?
- [x] Users can download their workspace as a zip file
- [x] Different options for problem loading, rather than individual config, let teachers author something equivalent to the server `index.json` file that contains an array of configs that they want to provide to students. The app then has a list of potential configurations to be able to fetch, which can be shown in a drop-down config picker, or also swapped via a URL or fragment param. So then we have a 'course lite' option, don't have a ton of URLs to add to the params, etc