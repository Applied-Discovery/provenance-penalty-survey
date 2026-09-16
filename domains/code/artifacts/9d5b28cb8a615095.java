/*
PROBLEM: Given an integer array sorted in ascending order, remove the duplicates in
place so that each value appears once, and return the number of distinct values.
The first k positions of the array must then hold the distinct values in order.

EXAMPLES:
  [1, 1, 2]                      ->  2, array begins [1, 2]
  [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]  ->  5, array begins [0, 1, 2, 3, 4]
*/

public class RemoveDuplicates {

    public static int removeDuplicates(int[] nums) {
        if (nums == null || nums.length == 0) {
            return 0;
        }
        int k = 1;
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] != nums[k - 1]) {
                nums[k] = nums[i];
                k++;
            }
        }
        return k;
    }
}
