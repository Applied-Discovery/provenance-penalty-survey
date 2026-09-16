/*
 * PLACEHOLDER (human placeholder, id h3). Not a curated artifact.
 *
 * PROBLEM: Given an array of integers and a target, return the indices of
 * the two numbers that add up to the target. Exactly one answer exists.
 *
 * EXAMPLES:
 *   [2, 7, 11, 15], 9  ->  [0, 1]
 *   [3, 2, 4], 6       ->  [1, 2]
 */

import java.util.HashMap;
import java.util.Map;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<Integer, Integer>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[] { seen.get(need), i };
            }
            seen.put(nums[i], i);
        }
        throw new IllegalArgumentException("No two sum solution");
    }
}
