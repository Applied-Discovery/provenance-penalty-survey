import type { Submission } from '../submission';
import type { DomainManifest } from '../manifest';
import type { Row, BrowserMeta } from './types';

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b), mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function runColumns(s: Submission): Row {
  return { domain: s.domain, session_id: s.session_id, start_time: s.start_time, protocol_version: s.protocol_version,
           domain_version: s.domain_version, evaluator_type: s.evaluator_type, evaluator_class: s.evaluator_class, wave: s.wave };
}

export function toSessionRow(s: Submission, meta: BrowserMeta, m: DomainManifest): Row {
  const all = [...s.data.ratings, ...s.data.unlabeled_ratings];
  const times = [...s.data.ratings.map((r) => r.time_spent), ...s.data.unlabeled_ratings.map((r) => r.rating_time_spent)];
  const passed = s.data.attention_expected.every((e, i) => e === s.data.attention_answer[i]);
  return {
    domain: s.domain, session_id: s.session_id, study_id: s.study_id, start_time: s.start_time, submission_time: s.submission_time,
    protocol_version: s.protocol_version, domain_version: s.domain_version, evaluator_type: s.evaluator_type,
    evaluator_class: s.evaluator_class, wave: s.wave,
    artifact_type: m.artifact_type, stem_noun: m.stem_noun, human_verb: m.human_verb, attention_checks: m.attention_checks,
    labeled_artifacts_per_session: m.labeled_artifacts_per_session, unlabeled_per_session: m.unlabeled_per_session,
    pool_size: Object.keys(m.artifacts.human).length + Object.keys(m.artifacts.ai).length,
    withdrawn: s.data.withdrawn,
    attention_expected: s.data.attention_expected.join(';'), attention_answer: s.data.attention_answer.join(';'), attention_passed: passed,
    n_labeled: s.data.ratings.length, n_unlabeled: s.data.unlabeled_ratings.length,
    avg_rating: all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : null,
    min_time_spent: times.length ? Math.min(...times) : null, median_time_spent: median(times),
    browser: meta.browser, jspsych_version: meta.jspsych_version, viewport_width: meta.viewport_width, viewport_height: meta.viewport_height,
    ...(s.data.prescreen ? { prescreen_answer: s.data.prescreen.answer, prescreen_passed: s.data.prescreen.passed } : {}),   // expert domains only
    ...Object.fromEntries(s.data.demographics.map((d) => [`demo_${d.id}`, d.answer])),   // one column per manifest question, last so the fixed columns keep their places
  };
}

export function toLabeledRows(s: Submission): Row[] {
  const base = runColumns(s);
  return s.data.ratings.map((r): Row => ({ ...base, artifact_id: r.id, actual_author: r.actual_author,
    stated_author: r.stated_author, survey_pos: r.survey_pos, rating: r.rating, time_spent: r.time_spent }));
}

export function toUnlabeledRows(s: Submission): Row[] {
  const base = runColumns(s);
  return s.data.unlabeled_ratings.map((r): Row => ({ ...base, artifact_id: r.id, actual_author: r.actual_author,
    predicted_author: r.predicted_author, survey_pos: r.survey_pos, rating: r.rating,
    rating_time_spent: r.rating_time_spent, belief_time_spent: r.belief_time_spent }));
}
