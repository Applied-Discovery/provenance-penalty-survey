/*
PROBLEM: Given a positive integer n, return a list of strings for the numbers 1 to n,
where multiples of 3 become "Fizz", multiples of 5 become "Buzz", multiples of
both become "FizzBuzz", and every other number is written as itself.

EXAMPLES:
  n = 5   ->  ["1", "2", "Fizz", "4", "Buzz"]
  n = 15  ->  ends [..., "13", "14", "FizzBuzz"]
*/

import java.util.ArrayList;
import java.util.List;

public class FizzBuzz {

    public static List<String> fizzBuzz(int n) {
        List<String> result = new ArrayList<>(n);
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) {
                result.add("FizzBuzz");
            } else if (i % 3 == 0) {
                result.add("Fizz");
            } else if (i % 5 == 0) {
                result.add("Buzz");
            } else {
                result.add(Integer.toString(i));
            }
        }
        return result;
    }
}
