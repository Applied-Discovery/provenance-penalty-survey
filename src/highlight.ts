import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import kotlin from 'highlight.js/lib/languages/kotlin';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scala from 'highlight.js/lib/languages/scala';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';

/**
 * The languages a code domain may name in `code_language`. A fixed, registered set keeps the bundle small (highlight.js
 * core plus these grammars rather than every language) and makes the colouring deterministic: every artifact in a domain
 * is highlighted with the same grammar, so the rendering can never differ between the human and AI halves of the pool.
 * `plaintext` is the escape hatch for a domain whose language is not here.
 */
const GRAMMARS = { bash, c, cpp, csharp, go, java, javascript, kotlin, php, plaintext, python, r, ruby, rust, scala, sql, swift, typescript };
for (const [name, grammar] of Object.entries(GRAMMARS)) hljs.registerLanguage(name, grammar);

export const CODE_LANGUAGES = Object.keys(GRAMMARS).sort() as (keyof typeof GRAMMARS)[];
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export const isCodeLanguage = (s: string): s is CodeLanguage => (CODE_LANGUAGES as string[]).includes(s);

/** HTML for `code` highlighted as `language`: text nodes escaped, tokens wrapped in `hljs-*` spans. Never auto-detects. */
export function highlightCode(code: string, language: CodeLanguage): string {
  return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}
