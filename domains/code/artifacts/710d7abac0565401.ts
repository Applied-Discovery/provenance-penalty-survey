/*
PROBLEM: Given a string, return the same string with every uppercase letter converted
to lowercase. Do not use .toLowerCase() or equivalent library function.

EXAMPLES:
  "Hello"   ->  "hello"
  "LOVELY"  ->  "lovely"
*/

function toLowerCase(input: string): string {
  const UPPER_A = 65; // 'A'
  const UPPER_Z = 90; // 'Z'
  const CASE_OFFSET = 32; // 'a' - 'A'

  let result = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= UPPER_A && code <= UPPER_Z) {
      result += String.fromCharCode(code + CASE_OFFSET);
    } else {
      result += input[i];
    }
  }
  return result;
}
