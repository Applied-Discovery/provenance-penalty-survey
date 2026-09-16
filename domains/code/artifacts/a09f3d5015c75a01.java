/*
PROBLEM: Given an integer array, return true if any value appears at least twice, and
false if every value is distinct.

EXAMPLES:
  [1, 2, 3, 1]  ->  true
  [1, 2, 3, 4]  ->  false
*/

import java.util.HashSet;
import java.util.Set;

public class ContainsDuplicate {

    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int num : nums) {
            if (!seen.add(num)) {
                return true;
            }
        }
        return false;
    }
}
