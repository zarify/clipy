# Config lists

Config lists are a way of providing a list of problems to
students using one file, instead of needing to provide a
different link for every problem.

Config lists use the format below, with the `listName`
value being used as the main page heading when the configuration
file is loaded.

Each of the problem files in the `files` array
are used to populate a list of files the student can navigate
between via a drop-down menu in the top-right of the page.

```json
{
    "listName": "My Problem List",
    "files": [
        "first_problem.json",
        "second_problem.json"
    ]
}
```

Config files from the `files` array are assumed to be present
in the same directory as the config list they are loaded from.