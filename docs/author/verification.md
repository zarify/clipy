# Verification Codes

Verification codes are designed to be an easy to verbalise, low friction way
of indicating that a particular student has passed the complete test suite
for a problem. e.g. `GARDEN-INFINITY-17`

Verification codes are generated **when**:
1. The student has a Student ID set in their browser (this ID is persisted through browser storage)
2. The student has passed all tests for a problem

Verification codes are generated **from**:
1. The ID entered by the student in the app page (under the config name in the top-right)
2. The problem configuration (test cases and other problem data)
3. The day the tests were passed on

> [!WARNING]
> This means if the test cases or other problem data is different between teacher and students,
> or if the student provides a code from an earlier day to their teacher, the codes **will not match**.

## Verifying Codes

In the authoring interface, the teacher can use the **Verification** tab to load up the same
config or list of configs that the students are using, enter the Student IDs that their students
are using in the app, and verification codes for those IDs will appear in a list for any config
that is loaded.

## Success Indicators

On the student side, they also receive success indicators for passing all the tests in a few places:
- The problem config name on the page
- The snapshot History view for the problem