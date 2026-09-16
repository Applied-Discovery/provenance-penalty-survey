/*
PROBLEM: Given a string of words separated by spaces, return the length of the last
word. A word is a maximal run of non-space characters.

EXAMPLES:
  "Hello World"                  ->  5
  "   fly me   to   the moon  "  ->  4
*/

#include <stddef.h>

int length_of_last_word(const char *s)
{
    size_t len = 0;
    while (s[len] != '\0') {
        len++;
    }

    /* skip trailing spaces */
    while (len > 0 && s[len - 1] == ' ') {
        len--;
    }

    /* count back over the last word */
    int count = 0;
    while (len > 0 && s[len - 1] != ' ') {
        len--;
        count++;
    }

    return count;
}
