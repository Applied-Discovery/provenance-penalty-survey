/*
PROBLEM: Given an integer array, move all zeros to the end in place while keeping the
relative order of the non-zero elements.

EXAMPLES:
  [0, 1, 0, 3, 12]  ->  [1, 3, 12, 0, 0]
*/

public class Solution {
    public void moveZeroes(int[] nums) {
        for (int start = 0, i = 0; i < nums.length; i++) {
            if (nums[i] != 0) {
                int tmp = nums[start];
                nums[start++] = nums[i];
                nums[i] = tmp;
            }
        }
    }
}
