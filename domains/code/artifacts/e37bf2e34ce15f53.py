"""
PROBLEM: Write a function that, given a directory path, adds up the sizes of every file
in that directory and all of its subdirectories and prints the total in bytes,
kilobytes, megabytes and gigabytes.

EXAMPLES:
  folder_size("~/photos")
    ->  prints "Folder Size: 1258291.2 Kilobytes" and the same total in the other units
"""

import os


def folder_size(directory):
    dir_size = 0  # Set the size to 0
    fsizedicr = {'Bytes': 1,
                'Kilobytes': float(1) / 1024,
                'Megabytes': float(1) / (1024 * 1024),
                'Gigabytes': float(1) / (1024 * 1024 * 1024)}
    for (path, dirs, files) in os.walk(
            directory):  # Walk through all the directories. 
            # For each iteration, os.walk returns the folders, subfolders and files in the dir.
        for file in files:  # Get all the files
            filename = os.path.join(path, file)
            # Add the size of each file in the root dir to get the total size.
            dir_size += os.path.getsize(filename)  

    fsizeList = [str(round(fsizedicr[key] * dir_size, 2)) + " " + key for key in fsizedicr]  # List of units

    if dir_size == 0:
        print("File Empty")  # Sanity check to eliminate corner-case of empty file.
    else:
        for units in sorted(fsizeList)[::-1]:  # Reverse sort list of units so smallest magnitude units print first.
            print("Folder Size: " + units)
