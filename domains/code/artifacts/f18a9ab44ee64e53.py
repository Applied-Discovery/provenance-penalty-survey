"""
PROBLEM: Write a function that replaces every occurrence of a given string in a text
file with a new string, writing the result back to the same file, and returns
how many occurrences were replaced.

EXAMPLES:
  notes.txt contains "foo bar foo"; text_file_replace("notes.txt", "foo", "baz")
    ->  notes.txt becomes "baz bar baz", returns 2
"""


def text_file_replace(path, old, new, encoding="utf-8"):
    if old == "":
        raise ValueError("old must be a non-empty string")
    with open(path, "r", encoding=encoding, newline="") as f:
        content = f.read()
    count = content.count(old)
    if count:
        with open(path, "w", encoding=encoding, newline="") as f:
            f.write(content.replace(old, new))
    return count
