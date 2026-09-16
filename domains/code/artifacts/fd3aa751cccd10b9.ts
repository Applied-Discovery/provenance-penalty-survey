/*
PROBLEM: Given an array of numbers, return its running sum: an array where element i is
the sum of the input elements from index 0 to i.

EXAMPLES:
  [1, 2, 3, 4]  ->  [1, 3, 6, 10]
  [1, 1, 1]     ->  [1, 2, 3]
*/

export function runningSum(nums: number[]): number[] {
  const result: number[] = [];
  result[0] = nums[0];

  for (let i = 1; i < nums.length; i++) {
    result[i] = result[i - 1] + nums[i];
  }

  return result;
}
