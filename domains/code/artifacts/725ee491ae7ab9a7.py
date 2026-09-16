"""
PROBLEM: Write a function that, given a directory, an old file extension and a new one,
renames every file in the directory that has the old extension so that it has
the new extension instead.

EXAMPLES:
  batch_rename("docs", ".txt", ".md")
    ->  docs/notes.txt becomes docs/notes.md, docs/todo.txt becomes docs/todo.md
"""

import os


def _normalise_extension(ext):
    if ext and not ext.startswith("."):
        ext = "." + ext
    return ext


def batch_rename(directory, old_ext, new_ext):
    """Rename every regular file in `directory` whose name ends with `old_ext`
    so that it ends with `new_ext` instead. Returns a list of (old_path, new_path)
    tuples for the files that were renamed."""
    old_ext = _normalise_extension(old_ext)
    new_ext = _normalise_extension(new_ext)
    if old_ext == new_ext:
        return []

    renamed = []
    for name in sorted(os.listdir(directory)):
        old_path = os.path.join(directory, name)
        if not os.path.isfile(old_path):
            continue
        if old_ext:
            if not name.endswith(old_ext) or name == old_ext:
                continue
            stem = name[: -len(old_ext)]
        else:
            if "." in name:
                continue
            stem = name
        new_name = stem + new_ext
        new_path = os.path.join(directory, new_name)
        if os.path.exists(new_path):
            raise FileExistsError(
                "cannot rename %r to %r: target already exists" % (old_path, new_path)
            )
        os.rename(old_path, new_path)
        renamed.append((old_path, new_path))
    return renamed
