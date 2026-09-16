"""
PROBLEM: Write a function that, given a directory path, adds up the sizes of every file
in that directory and all of its subdirectories and prints the total in bytes,
kilobytes, megabytes and gigabytes.

EXAMPLES:
  folder_size("~/photos")
    ->  prints "Folder Size: 1258291.2 Kilobytes" and the same total in the other units
"""

import os


def folder_size(path):
    """Print the total size of all files under `path` (recursively) in several units."""
    root = os.path.expanduser(path)
    total = 0
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            full = os.path.join(dirpath, name)
            try:
                if not os.path.islink(full):
                    total += os.path.getsize(full)
            except OSError:
                # Skip files that vanish or cannot be read mid-walk.
                continue

    units = [
        ("Bytes", 1),
        ("Kilobytes", 1024),
        ("Megabytes", 1024 ** 2),
        ("Gigabytes", 1024 ** 3),
    ]
    for label, divisor in units:
        value = total / divisor
        print(f"Folder Size: {round(value, 2)} {label}")

    return total
