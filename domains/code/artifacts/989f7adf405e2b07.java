/*
PROBLEM: Given two strings, return true if the second is an anagram of the first, i.e.
it uses exactly the same letters the same number of times.

EXAMPLES:
  "anagram", "nagaram"  ->  true
  "rat", "car"          ->  false
*/

import java.util.HashMap;
import java.util.Map;

public class ValidAnagram {

    public static boolean isAnagram(String s, String t) {
        if (s == null || t == null || s.length() != t.length()) {
            return false;
        }

        Map<Character, Integer> counts = new HashMap<>();

        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            counts.merge(c, 1, Integer::sum);
        }

        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            Integer remaining = counts.get(c);
            if (remaining == null || remaining == 0) {
                return false;
            }
            counts.put(c, remaining - 1);
        }

        return true;
    }
}
