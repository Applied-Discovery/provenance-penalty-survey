/*
PROBLEM: Given an array of integers and a target value, return the indices of the two
elements that add up to the target. Each input has exactly one answer, and the
same element may not be used twice.

EXAMPLES:
  nums = [2, 7, 11, 15], target = 9  ->  [0, 1]
  nums = [3, 2, 4], target = 6       ->  [1, 2]
*/

import java.util.HashMap;
import java.util.Map;

public class TwoSum {

    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] {seen.get(complement), i};
            }
            seen.put(nums[i], i);
        }
        throw new IllegalArgumentException("No two sum solution");
    }
}
