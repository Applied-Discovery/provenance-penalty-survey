"""
PROBLEM: Given a positive integer, return its complement: the number whose binary
representation has every bit of the input flipped, with no leading zeros
considered.

EXAMPLES:
  5  (binary 101)  ->  2  (binary 010)
  1  (binary 1)    ->  0
"""


def find_complement(num):
    mask = (1 << num.bit_length()) - 1
    return num ^ mask
