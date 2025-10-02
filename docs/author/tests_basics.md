# Test Basics

Tests provide a way to verify that a user's code satisfies the problem. These
tests come in a couple of varities:
- Behavioural tests, manipulating `stdin` and workspace files, and checking outputs
- Code tests using [AST rules](ast_rules.md) that check the structure of the code
- Advanced tests using [pre/post execution](test_pre_post_execution.md) for setup and verification

Tests can be grouped or ungrouped, and have dependencies on previous individual tests
or groups of tests, allowing for feedback to be shown with progressively advanced
scenarios.

For example for a simple "Hello, World!" style program:
1. Test whether any output is produced by the program
2. Test whether the program contains key words
3. Test whether the program output is entirely correct

A more complex example that involves different test types could be:
1. Check for the correct output for an example scenario
2. Modify the input received to check whether the output changes accordingly
3. Check whether a function that was provided as a stub has been called

## Creating basic tests

| Setting | Description |
| ------- | ----------- |
| Description | The description of what is being tested, shown to the user. |
| Stdin | `stdin` provided during the test to the user's program. Multiple lines are treated as separate instances of input. |
| Expected stdout | Different types of matches for `stdout`. Defaults to a partial string match, but can also be an exact string match or a regular expression pattern. |
| Expected stderr | As for `stdout` but checking `stderr`. |
| Timeout | Optional timeout for the test case. Wall clock time. |
| Test files | Optional workspace files that will override the user workspace files. |
| [Pre/Post Execution](test_pre_post_execution.md) | Include `__pre.py` and/or `__post.py` files in setup/files for advanced test setup and verification. |
| Failure Message | Optional message to the user on test failure. |
| Hide Actual vs Expected | Non-regex tests will default to showing what the program output vs what the test expected. This hides this behaviour, making it suitable for test cases where the output comparison is not helpful or designed to be more difficult. |
| [Run Conditions](tests_conditional_runs.md) | Whether this test should only run if the previous test runs, or whether it should always run. |
| [Assign to Group](tests_groups.md) | Put this test into a test group |

> [!WARNING]
> Currently the first test **must** be set to `Always run this test` otherwise the test suite
> will not run. This will be fixed in a later version.