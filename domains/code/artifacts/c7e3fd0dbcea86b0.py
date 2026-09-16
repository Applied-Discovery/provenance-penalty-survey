"""
PROBLEM: Write a function that, given a directory, an old file extension and a new one,
renames every file in the directory that has the old extension so that it has
the new extension instead.

EXAMPLES:
  batch_rename("docs", ".txt", ".md")
    ->  docs/notes.txt becomes docs/notes.md, docs/todo.txt becomes docs/todo.md
"""

import os


def batch_rename(work_dir, old_ext, new_ext):
    for filename in os.listdir(work_dir):
        # Get the file extension
        split_file = os.path.splitext(filename)
        # Unpack tuple element
        root_name, file_ext = split_file
        # Start of the logic to check the file extensions, if old_ext = file_ext
        if old_ext == file_ext:
            # Returns changed name of the file with new extention
            newfile = root_name + new_ext

            # Write the files
            os.rename(
                os.path.join(work_dir, filename),
                os.path.join(work_dir, newfile)
            )