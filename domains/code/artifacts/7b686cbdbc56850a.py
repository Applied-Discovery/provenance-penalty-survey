"""
PROBLEM: Write a function that replaces every occurrence of a given string in a text
file with a new string, writing the result back to the same file, and returns
how many occurrences were replaced.

EXAMPLES:
  notes.txt contains "foo bar foo"; text_file_replace("notes.txt", "foo", "baz")
    ->  notes.txt becomes "baz bar baz", returns 2
"""

def text_file_replace(file, old, new):
    lines = []
    count = 0
    with open(file=file, mode='r', encoding='utf-8') as fd:
        for line in fd:
            count += line.count(old)
            lines.append(line.replace(old, new))
    with open(file=file, mode='w', encoding='utf-8') as fd:
        fd.writelines(lines)
    print("{} occurrence(s) of \"{}\" have been replaced with \"{}\"".format(count, old, new))
    return count
