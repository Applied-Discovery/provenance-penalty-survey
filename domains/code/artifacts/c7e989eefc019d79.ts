/*
PROBLEM: Given a string, return the same string with every uppercase letter converted
to lowercase. Do not use .toLowerCase() or equivalent library function.

EXAMPLES:
  "Hello"   ->  "hello"
  "LOVELY"  ->  "lovely"
*/

const toLowerCase = function(str: string) {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const index = upper.indexOf(char);

        if (index >= 0) {
            result += lower[index];
        }
        else {
            result += char;
        }
    }

    return result;
};
