/*
 * PLACEHOLDER (human placeholder, id h1). Not a curated artifact.
 *
 * PROBLEM: Given a string of words separated by spaces, return the length
 * of the last word. A word is a run of non-space characters.
 *
 * EXAMPLES:
 *   "Hello World"      ->  5
 *   "   fly me   to   the moon  "  ->  4
 */

#include <string.h>

int lengthOfLastWord(char *s) {
    int len = strlen(s);
    int i = len - 1;
    int count = 0;
    while (i >= 0 && s[i] == ' ') i--;       /* skip trailing blanks */
    while (i >= 0 && s[i] != ' ') { count++; i--; }
    return count;
}
