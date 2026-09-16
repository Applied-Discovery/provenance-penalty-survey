"""
PROBLEM: Write a function that moves every file in a source directory whose
last-modified time is older than a given number of days into a destination
directory, creating the destination if it does not exist.

EXAMPLES:
  move_files_over_x_days(30, "logs", "archive")
    ->  files in logs/ untouched for more than 30 days are moved to archive/
"""

import os
import shutil
import time


def move_files_over_x_days(days, src_dir, dst_dir):
    """Move files in src_dir last modified more than `days` days ago to dst_dir.

    Returns a list of the destination paths of the moved files.
    """
    if days < 0:
        raise ValueError("days must be non-negative")
    if not os.path.isdir(src_dir):
        raise FileNotFoundError(f"source directory not found: {src_dir}")

    os.makedirs(dst_dir, exist_ok=True)

    cutoff = time.time() - days * 86400
    src_abs = os.path.abspath(src_dir)
    dst_abs = os.path.abspath(dst_dir)
    moved = []

    for name in os.listdir(src_dir):
        src_path = os.path.join(src_dir, name)
        if not os.path.isfile(src_path):
            continue
        # Skip the destination itself if it sits inside the source directory.
        if os.path.abspath(src_path) == dst_abs:
            continue
        if os.path.getmtime(src_path) < cutoff:
            dst_path = os.path.join(dst_dir, name)
            if os.path.abspath(dst_path) == os.path.abspath(src_path):
                continue
            shutil.move(src_path, dst_path)
            moved.append(dst_path)

    return moved
