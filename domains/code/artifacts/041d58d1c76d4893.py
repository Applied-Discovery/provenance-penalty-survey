"""
PROBLEM: Given an integer, return true if it is a power of two.

EXAMPLES:
  1   ->  true
  16  ->  true
  3   ->  false
"""


def is_power_of_two(n):
    return n > 0 and (n & (n - 1)) == 0
