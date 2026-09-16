/**
 * PLACEHOLDER (ai placeholder, id a2). Not a curated artifact.
 *
 * PROBLEM: Given an array of numbers, return the running sum: element i of
 * the result is the sum of the first i + 1 inputs.
 *
 * EXAMPLES:
 *   [1, 2, 3, 4]  ->  [1, 3, 6, 10]
 *   [3, 1, 2]     ->  [3, 4, 6]
 */

export const runningSum = (nums: readonly number[]): number[] => {
  let acc = 0;
  return nums.map((n) => (acc += n));   // map keeps the input untouched
};
