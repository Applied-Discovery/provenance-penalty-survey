/*
PROBLEM: Given an integer array, move all zeros to the end in place while keeping the
relative order of the non-zero elements.

EXAMPLES:
  [0, 1, 0, 3, 12]  ->  [1, 3, 12, 0, 0]
*/

public class Solution {
    public void moveZeroes(int[] nums) {
        int insertPos = 0;
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] != 0) {
                nums[insertPos++] = nums[i];
            }
        }
        while (insertPos < nums.length) {
            nums[insertPos++] = 0;
        }
    }
}
