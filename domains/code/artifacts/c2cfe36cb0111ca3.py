"""
PROBLEM: Given an array where the i-th element is the price of a stock on day i, choose
one day to buy and a later day to sell so that the profit is as large as
possible. Return that profit, or 0 if no profit is possible.

EXAMPLES:
  [7, 1, 5, 3, 6, 4]  ->  5   (buy at 1, sell at 6)
  [7, 6, 4, 3, 1]     ->  0
"""


def max_profit(prices):
    min_price = float("inf")
    best = 0
    for price in prices:
        if price < min_price:
            min_price = price
        elif price - min_price > best:
            best = price - min_price
    return best
