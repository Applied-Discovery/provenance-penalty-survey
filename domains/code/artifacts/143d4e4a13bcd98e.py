"""
PROBLEM: Given a string, return true if it reads the same forwards and backwards when
only letters and digits are considered and case is ignored.

EXAMPLES:
  "A man, a plan, a canal: Panama"  ->  true
  "race a car"                      ->  false
"""

class Solution(object):
    def isPalindrome(self, s):
        """
        :type s: str
        :rtype: bool
        """
        alnum_s = [t.lower() for t in s if t.isalnum()]
        ls = len(alnum_s)
        if ls <= 1:
            return True
        mid = ls / 2
        for i in range(mid):
            if alnum_s[i] != alnum_s[ls - 1 - i]:
                return False
        return True