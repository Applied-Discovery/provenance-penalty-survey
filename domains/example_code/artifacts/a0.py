"""
PLACEHOLDER (ai placeholder, id a0). Not a curated artifact.

PROBLEM: Given an integer, return true if it is a power of two.

EXAMPLES:
  1   ->  true
  16  ->  true
  3   ->  false
"""


def is_power_of_two(n: int) -> bool:
    # A power of two has exactly one set bit, so n & (n - 1) clears it to 0.
    return n > 0 and (n & (n - 1)) == 0
