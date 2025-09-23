# Authoring

> [!WARNING]
> Clipy uses MicroPython, not full Python as its runtime. Whilst
> there are not too many differences in language syntax, read on
> for some of the differences that might affect you and your students
> if you use Clipy.

[I don't care, just take me to the authoring docs](basic_interface.md)

If you do care, read on for some of the notable differences and decide
whether this tool is right for you. The choice of using MicroPython for
Clipy was a conscious tradeoff of speed and convenience against a fuller
feature set. There might be an attempt to also support a full implementation
of Python through Pyodide in the future if can still meet Clipy's aims
of working with basic hosting on pretty much any device.

## MicroPython
### Error Reporting
Errors are probably the biggest difference that will be noticable to students,
as MicroPython errors are far more terse than those found in CPython, particularly
the 3.12 and later releases that have focused on user-friendly errors.

There are a range of `OSError` exceptions that in CPython have friendlier names,
and in MicroPython are simply reported as a number. You can find
[a complete list here](https://docs.micropython.org/en/latest/genrst/builtin_types.html#oserror).

Additionally, those who are used to the newer errors in CPython that report line
and column numbers, and provide suggestions for some error types may not appreciate
a blunt `SyntaxError` or similar in their place.

### Standard Library
One of the strengths of regular Python is its "batteries included" apprach
to the standard library, letting you fetch network resources, do basic
data processing, work with complex data structures and more.

MicroPython is designed to run on microprocessors, and so space, memory, and
processing are constrained. It has a more limited range of available tools
to import, some notable ones that you might miss are:
- `csv`
- `dataclasses`

There are some implmentation differences in the `re` and `json` modules.

### Implementation differences
Stepping over iterables with steps that are not `1` can be different. For example
`"abcdef"[::-1]` is a common pattern in Python for reversing a string, but is not
implemented in MicroPython (or any other step that isn't 1). This will work with
lists, however, like this: `list("abcdef")[::-1]`

See [this page in the MicroPython docs](https://docs.micropython.org/en/latest/genrst/builtin_types.html)
for information on other implementation differences with builtin types that may
or may not affect you.

You can find out more about the technical differences between MicroPython
and CPython in [the MicroPython docs](https://docs.micropython.org/en/latest/genrst/index.html).