/*
 * PLACEHOLDER (ai placeholder, id a3). Not a curated artifact.
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

public final class TwoSum {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> indexOf = new HashMap<>();   // value -> index
        for (int i = 0; i < nums.length; i++) {
            Integer j = indexOf.get(target - nums[i]);
            if (j != null) return new int[] { j, i };
            indexOf.put(nums[i], i);
        }
        return new int[0];
    }
}
