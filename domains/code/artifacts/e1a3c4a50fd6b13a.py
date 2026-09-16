"""
PROBLEM: Given an array where the i-th element is the price of a stock on day i, choose
one day to buy and a later day to sell so that the profit is as large as
possible. Return that profit, or 0 if no profit is possible.

EXAMPLES:
  [7, 1, 5, 3, 6, 4]  ->  5   (buy at 1, sell at 6)
  [7, 6, 4, 3, 1]     ->  0
"""

class Solution(object):
    def maxProfit(self, prices):
        """
        :type prices: List[int]
        :rtype: int
        """
        length = len(prices)
        if length == 0:
            return 0
        max_profit, low = 0, prices[0]
        for i in range(1, length):
            if low > prices[i]:
                low = prices[i]
            else:
                temp = prices[i] - low
                if temp > max_profit:
                    max_profit = temp
        return max_profit