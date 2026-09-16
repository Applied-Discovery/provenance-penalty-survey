/*
PROBLEM: Given two strings, return true if the second is an anagram of the first, i.e.
it uses exactly the same letters the same number of times.

EXAMPLES:
  "anagram", "nagaram"  ->  true
  "rat", "car"          ->  false
*/

public class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        char[] ss = s.toCharArray(), ts = t.toCharArray();
        Arrays.sort(ss);
        Arrays.sort(ts);
        return Arrays.equals(ss, ts);
    }
}
