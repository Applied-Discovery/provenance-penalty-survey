"""
PROBLEM: Given an array containing only 0s and 1s, return the length of the longest run
of consecutive 1s.

EXAMPLES:
  [1, 1, 0, 1, 1, 1]  ->  3
  [1, 0, 1, 1, 0, 1]  ->  2
"""


def max_consecutive_ones(nums):
    best = 0
    current = 0
    for n in nums:
        if n == 1:
            current += 1
            if current > best:
                best = current
        else:
            current = 0
    return best
