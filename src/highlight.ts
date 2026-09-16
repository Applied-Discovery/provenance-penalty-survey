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
 * The grammars a code artifact can be highlighted with, chosen by file extension (EXTENSIONS below). A fixed, registered
 * set keeps the bundle small (highlight.js core plus these grammars rather than every language) and makes the colouring
 * deterministic: the grammar comes from the file name, never from the content, so a human and an AI artifact in the same
 * language are always coloured by the same rules. `plaintext` (`.txt`) is the escape hatch for a language not here.
 */
const GRAMMARS = { bash, c, cpp, csharp, go, java, javascript, kotlin, php, plaintext, python, r, ruby, rust, scala, sql, swift, typescript };
for (const [name, grammar] of Object.entries(GRAMMARS)) hljs.registerLanguage(name, grammar);

export const CODE_LANGUAGES = Object.keys(GRAMMARS).sort() as (keyof typeof GRAMMARS)[];
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/** File extension (lower case, no dot) to grammar. The manifest requires every artifact of a code domain to have one of these. */
const EXTENSIONS: Record<string, CodeLanguage> = {
  sh: 'bash', bash: 'bash', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp', go: 'go', java: 'java',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', kt: 'kotlin', kts: 'kotlin', php: 'php', txt: 'plaintext',
  py: 'python', r: 'r', rb: 'ruby', rs: 'rust', scala: 'scala', sql: 'sql', swift: 'swift', ts: 'typescript', tsx: 'typescript',
};
export const CODE_EXTENSIONS = Object.keys(EXTENSIONS).sort();

/** The grammar an artifact path's extension names, or undefined when the extension is missing or not registered. */
export function languageForPath(path: string): CodeLanguage | undefined {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return m ? EXTENSIONS[m[1].toLowerCase()] : undefined;
}

/** HTML for `code` highlighted as `language`: text nodes escaped, tokens wrapped in `hljs-*` spans. Never auto-detects. */
export function highlightCode(code: string, language: CodeLanguage): string {
  return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}
