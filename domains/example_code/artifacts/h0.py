"""
PLACEHOLDER (human placeholder, id h0). Not a curated artifact.

PROBLEM: Given an integer, return true if it is a power of two.

EXAMPLES:
  1   ->  true
  16  ->  true
  3   ->  false
"""

class Solution(object):
    def isPowerOfTwo(self, n):
        """
        :type n: int
        :rtype: bool
        """
        if n < 0:
            return False
        bin_str = bin(n)
        return sum(map(lambda x: int(x), list(bin_str[2:]))) == 1
