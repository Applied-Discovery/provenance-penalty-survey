"""
PROBLEM: Given a string, return true if it reads the same forwards and backwards when
only letters and digits are considered and case is ignored.

EXAMPLES:
  "A man, a plan, a canal: Panama"  ->  true
  "race a car"                      ->  false
"""


def is_palindrome(s: str) -> bool:
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True
