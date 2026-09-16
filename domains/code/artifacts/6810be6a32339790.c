/*
PROBLEM: Given a string of words separated by spaces, return the length of the last
word. A word is a maximal run of non-space characters.

EXAMPLES:
  "Hello World"                  ->  5
  "   fly me   to   the moon  "  ->  4
*/

#include <stdio.h>
#include <stdlib.h>

int lengthOfLastWord(char *s)
{
    int len = 0;
    while (*s != '\0') {
        if (s[-1] == ' ' && s[0] != ' ') {
            len = 1;
        } else if (*s != ' ') {
            len++;
        }
        s++;
    }
    return len;
}

int main(int argc, char **argv)
{
    if (argc != 2) {
        fprintf(stderr, "Usage: ./test word\n");
        exit(-1);
    }

    printf("%d\n", lengthOfLastWord(argv[1]));
    return 0;
}
