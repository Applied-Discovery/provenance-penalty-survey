import { validateManifest } from '../src/manifest';
import { attributionHtml } from '../src/attribution';
import { disclosureTrial, appendAttribution } from '../src/trials/disclosure';
import type { SessionPlan } from '../src/plan';

const art = (author: 'human' | 'ai', index: number) => ({ id: `d_v0_${author}_${index}`, author, index, path: `${author}${index}.txt` });
// The session shows human 0, then ai 1 as the attention check, then human 1 unlabeled; ai 0 stays in the pool.
const plan: SessionPlan = {
  labeled: [
    { kind: 'labeled', artifact: art('human', 0), stated_author: 'ai', survey_pos: 1 },
    { kind: 'attention', check_index: 0, expected: 7, artifact: art('ai', 1) },
  ],
  unlabeled: [{ kind: 'unlabeled', artifact: art('human', 1), survey_pos: 2 }],
};

const base = {
  name: 'd', protocol_version: 'v0', domain_version: 'v0', wave: 1, artifact_type: 'text', evaluator_class: 'lay',
  stem_noun: 'poem', labeled_artifacts_per_session: 2, attention_checks: 1, unlabeled_per_session: 1,
  artifacts: { human: { '0': 'human0.txt', '1': 'human1.txt' }, ai: { '0': 'ai0.txt', '1': 'ai1.txt' } },
  curation_criteria: 'c.md', osf_study: 'x',
};
const withAttribution = (attribution: unknown) => validateManifest({ ...base, attribution });

const full = {
  title: 'Winter Trees', title_url: 'https://example.test/winter',
  author: 'A. Author', author_url: 'https://example.test/author',
  licence: 'CC BY-SA 4.0', licence_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

test('lists one source per session artifact that has attribution, in session order', () => {
  const m = withAttribution({ human: { '0': full, '1': { title: 'Second' } }, ai: { '0': { title: 'Not in this session' } } });
  const html = attributionHtml(m, plan);
  expect(html).toContain('Sources');
  expect(html).toContain('Winter Trees');
  expect(html).toContain('Second');
  expect(html).not.toContain('Not in this session');   // ai 0 is in the pool but was never shown
  expect(html.indexOf('Winter Trees')).toBeLessThan(html.indexOf('Second'));
  expect(html.match(/<li>/g)).toHaveLength(2);
});

test('an artifact with a list of credits gets one line per source, in manifest order, in its place in the session', () => {
  const m = withAttribution({ human: { '0': [{ ...full, title: 'The answer' }, { title: 'The question', author: 'Q. Poster', licence: 'CC BY-SA 3.0' }],
    '1': { title: 'Second' } } });
  const html = attributionHtml(m, plan);
  expect(html.match(/<li>/g)).toHaveLength(3);
  const order = ['The answer', 'The question', 'Second'].map((t) => html.indexOf(t));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(html).toContain('<li>The question by Q. Poster · CC BY-SA 3.0</li>');
});

test('a source credited by several shown artifacts is listed once, where it first appears', () => {
  const corpus = { title: 'The corpus', licence: 'CC BY 4.0' };
  const m = withAttribution({ human: { '0': [{ title: 'Page one' }, corpus], '1': [{ title: 'Page two' }, { ...corpus }] }, ai: { '1': corpus } });
  const html = attributionHtml(m, plan);
  expect(html.match(/The corpus/g)).toHaveLength(1);
  expect(html.match(/<li>/g)).toHaveLength(3);
  const order = ['Page one', 'The corpus', 'Page two'].map((t) => html.indexOf(t));
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test('a full entry reads title by author, licence', () => {
  const html = attributionHtml(withAttribution({ human: { '0': full } }), plan);
  expect(html).toContain('>Winter Trees</a> by <a');
  expect(html).toContain('>A. Author</a> · <a');
  expect(html).toContain('>CC BY-SA 4.0</a>');
});

test('missing fields are skipped with their separators', () => {
  const titleOnly = attributionHtml(withAttribution({ human: { '0': { title: 'Just a title' } } }), plan);
  expect(titleOnly).toContain('<li>Just a title</li>');
  const noTitle = attributionHtml(withAttribution({ human: { '0': { author: 'A. Author', licence: 'CC0' } } }), plan);
  expect(noTitle).toContain('<li>A. Author · CC0</li>');   // no dangling "by" when there is no title
});

test('links open in a new tab, so a participant cannot lose the session before submitting', () => {
  const html = attributionHtml(withAttribution({ human: { '0': full } }), plan);
  expect(html).toContain('href="https://example.test/winter"');
  expect(html.match(/<a /g)!.length).toBe(3);
  for (const a of html.match(/<a [^>]*>/g)!) {
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="noopener noreferrer"');
  }
});

test('a url without its text links the url itself', () => {
  const html = attributionHtml(withAttribution({ human: { '0': { title_url: 'https://example.test/winter' } } }), plan);
  expect(html).toContain('>https://example.test/winter</a>');
});

test('text from the manifest is escaped', () => {
  const html = attributionHtml(withAttribution({ human: { '0': { title: '<script>alert(1)</script>' } } }), plan);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});

test('renders nothing when no artifact of this session has attribution', () => {
  expect(attributionHtml(validateManifest(base), plan)).toBe('');
  expect(attributionHtml(withAttribution({ ai: { '0': full } }), plan)).toBe('');
});

test('the sources block goes below the submit button, after the form', () => {
  document.body.innerHTML = '<div id="jspsych-content"><form id="jspsych-survey-html-form"><button>Submit</button></form></div>';
  appendAttribution('<div class="attribution">Sources</div>');
  const content = document.getElementById('jspsych-content')!;
  expect(content.lastElementChild!.className).toBe('attribution');
  expect(content.querySelector('form')!.nextElementSibling).toBe(content.lastElementChild);
});

test('appending nothing leaves the page alone', () => {
  document.body.innerHTML = '<div id="jspsych-content"><form></form></div>';
  appendAttribution('');
  expect(document.getElementById('jspsych-content')!.children).toHaveLength(1);
});

test('the disclosure trial renders its attribution when the page loads, and keeps the withdraw box above the button', () => {
  const html = attributionHtml(withAttribution({ human: { '0': full } }), plan);
  const t = disclosureTrial(false, html);
  expect(t.html).toContain('withdraw');
  expect(t.html).not.toContain('Winter Trees');   // the form holds the button; the sources go after it
  document.body.innerHTML = '<div id="jspsych-content"><form></form></div>';
  t.on_load();
  expect(document.getElementById('jspsych-content')!.innerHTML).toContain('Winter Trees');
});
