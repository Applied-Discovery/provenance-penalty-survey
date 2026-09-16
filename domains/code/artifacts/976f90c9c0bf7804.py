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


def move_files_over_x_days(days, src, dst):
    now = time.time()  # Get the current time

    if not os.path.exists(dst):
        os.mkdir(dst)

    for f in os.listdir(src):  # Loop through all the files in the source directory
        # Work out how old they are, if they are older than X days old
        if os.stat(f).st_mtime < now - days * 86400:  
            if os.path.isfile(f):  # Check it's a file
                shutil.move(f, dst)  # Move the files
