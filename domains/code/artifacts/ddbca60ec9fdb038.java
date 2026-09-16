/*
PROBLEM: Given an array of integers and a target value, return the indices of the two
elements that add up to the target. Each input has exactly one answer, and the
same element may not be used twice.

EXAMPLES:
  nums = [2, 7, 11, 15], target = 9  ->  [0, 1]
  nums = [3, 2, 4], target = 6       ->  [1, 2]
*/

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        HashMap<Integer, Integer> hashMap = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            if (hashMap.get(target - nums[i]) != null) {
                return new int[]{hashMap.get(target - nums[i]), i};
            }
            hashMap.put(nums[i], i);
        }

        return new int[]{};
    }
}
