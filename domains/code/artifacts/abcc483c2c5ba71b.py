"""
PROBLEM: Given an array containing only 0s and 1s, return the length of the longest run
of consecutive 1s.

EXAMPLES:
  [1, 1, 0, 1, 1, 1]  ->  3
  [1, 0, 1, 1, 0, 1]  ->  2
"""

def findMaxConsecutiveOnes(self, nums):
        """
        :type nums: List[int]
        :rtype: int
        """
        if not nums:
            return 0
        local_max, global_max = 0, 0
        for num in nums:
            if num == 0:
                global_max = max(global_max, local_max)
                local_max = 0
            else:
                local_max += 1
        return max(global_max, local_max)
