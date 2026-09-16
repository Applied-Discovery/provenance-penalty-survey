/**
 * PLACEHOLDER (human placeholder, id h2). Not a curated artifact.
 *
 * PROBLEM: Given an array of numbers, return the running sum: element i of
 * the result is the sum of the first i + 1 inputs.
 *
 * EXAMPLES:
 *   [1, 2, 3, 4]  ->  [1, 3, 6, 10]
 *   [3, 1, 2]     ->  [3, 4, 6]
 */

function runningSum(nums: number[]): number[] {
    let result: number[] = [];
    let total = 0;
    for (let i = 0; i < nums.length; i++) {
        total += nums[i];
        result.push(total);
    }
    return result;
};
