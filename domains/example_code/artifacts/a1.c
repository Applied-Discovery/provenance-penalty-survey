/*
 * PLACEHOLDER (ai placeholder, id a1). Not a curated artifact.
 *
 * PROBLEM: Given a string of words separated by spaces, return the length
 * of the last word. A word is a run of non-space characters.
 *
 * EXAMPLES:
 *   "Hello World"      ->  5
 *   "   fly me   to   the moon  "  ->  4
 */

#include <stddef.h>

size_t length_of_last_word(const char *s) {
    size_t end = 0, i;
    for (i = 0; s[i] != '\0'; i++) {
        if (s[i] != ' ') end = i + 1;   // one past the last non-space seen so far
    }
    size_t start = end;
    while (start > 0 && s[start - 1] != ' ') start--;
    return end - start;
}
