"""
PROBLEM: Given a positive integer, return its complement: the number whose binary
representation has every bit of the input flipped, with no leading zeros
considered.

EXAMPLES:
  5  (binary 101)  ->  2  (binary 010)
  1  (binary 1)    ->  0
"""

def findComplement(num):
        """
        :type num: int
        :rtype: int
        """
        bin_num = bin(num)[2:]
        to_return = ""
        for c in bin_num:
            to_return += str(abs(int(c)-1))
        return int(to_return,2)
