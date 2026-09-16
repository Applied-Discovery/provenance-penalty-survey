/*
PROBLEM: Given an integer array, return true if any value appears at least twice, and
false if every value is distinct.

EXAMPLES:
  [1, 2, 3, 1]  ->  true
  [1, 2, 3, 4]  ->  false
*/

public class Solution {
    public boolean containsDuplicate(int[] nums) {
        Arrays.sort(nums);
        for (int i = 0; i < nums.length - 1; i++) {
            if (nums[i + 1] - nums[i] == 0) return true;
        }
        return false;
    }
}
