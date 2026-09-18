import type { DomainManifest, Author } from './manifest';
import type { SessionContext } from './session';
export type { Author };
export interface Rating          { id: string; actual_author: Author; stated_author: Author; survey_pos: number; rating: number; time_spent: number }
export interface UnlabeledRating { id: string; actual_author: Author; predicted_author: Author; survey_pos: number; rating: number; rating_time_spent: number; belief_time_spent: number }
export interface DemographicAnswer { id: string; answer: string }   // the option text chosen for manifest question `id`
export interface PrescreenResult { answer: string; passed: boolean }   // chosen option text; passed when it is the manifest's answer
export interface SubmissionData  { attention_expected: number[]; attention_answer: number[]; withdrawn: boolean; ratings: Rating[]; unlabeled_ratings: UnlabeledRating[]; demographics: DemographicAnswer[]; prescreen?: PrescreenResult }
export interface Submission {
  domain: string; submission_time: string; start_time: string; session_id: string; study_id: string | null;
  protocol_version: string; domain_version: string; evaluator_type: 'human'; evaluator_class: 'lay' | 'expert'; wave: number;
  data: SubmissionData;
}
export interface TrialRecord { trial_kind: string; response?: unknown; rt?: number; [k: string]: unknown }

const ratingOf = (t: TrialRecord) => Number(t.response) + 1;
// jsPsych records `rt` on every button-response trial: milliseconds from stimulus onset to the click, measured with
// performance.now(). A rating trial has no timeout, so a missing rt means the record is corrupt; fail loudly rather than store 0.
const ms = (t: TrialRecord) => {
  if (typeof t.rt !== 'number' || !Number.isFinite(t.rt)) throw new Error(`Trial ${t.trial_kind} for ${t.artifact_id ?? '?'} has no response time`);
  return Math.round(t.rt);
};

export function buildSubmission(
  m: DomainManifest, ctx: SessionContext, trials: TrialRecord[], now: () => string = () => new Date().toISOString(),
): Submission {
  const of = (kind: string) => trials.filter((t) => t.trial_kind === kind);
  const attention = of('attention').sort((a, b) => Number(a.check_index) - Number(b.check_index));
  const beliefs = new Map(of('belief').map((t) => [String(t.artifact_id), t]));
  const disclosure = of('disclosure')[0];
  const withdrawn = !!(disclosure?.response as Record<string, unknown> | undefined)?.withdraw;

  const ratings: Rating[] = of('labeled').map((t) => ({
    id: String(t.artifact_id), actual_author: t.actual_author as Author, stated_author: t.stated_author as Author,
    survey_pos: Number(t.survey_pos), rating: ratingOf(t), time_spent: ms(t),
  }));
  const unlabeled_ratings: UnlabeledRating[] = of('unlabeled_rating').map((t) => {
    const b = beliefs.get(String(t.artifact_id));
    if (!b) throw new Error(`Missing belief answer for ${t.artifact_id}`);
    return { id: String(t.artifact_id), actual_author: t.actual_author as Author,
      predicted_author: Number(b.response) === 0 ? 'human' : 'ai',
      survey_pos: Number(t.survey_pos), rating: ratingOf(t), rating_time_spent: ms(t), belief_time_spent: ms(b) };
  });

  // Scored here from the manifest, not read off the trial record, so the stored outcome never depends on page-side state.
  let prescreen: PrescreenResult | undefined;
  if (m.prescreener) {
    const t = of('prescreen')[0];
    const answer = t ? m.prescreener.options[Number(t.response)] : undefined;
    if (answer === undefined) throw new Error('Missing or out-of-range answer for the prescreen question');
    prescreen = { answer, passed: answer === m.prescreener.answer };
  }
  const screenedOut = prescreen !== undefined && !prescreen.passed;   // the session ended at the screen: nothing after it was asked

  const answered = new Map(of('demographic').map((t) => [String(t.question_id), t]));
  const demographics: DemographicAnswer[] = screenedOut ? [] : m.demographics.map((q) => {
    const t = answered.get(q.id);
    const answer = t ? q.options[Number(t.response)] : undefined;
    if (answer === undefined) throw new Error(`Missing or out-of-range answer for demographic question ${q.id}`);
    return { id: q.id, answer };
  });

  return {
    domain: m.name, submission_time: now(), start_time: ctx.start_time, session_id: ctx.session_id, study_id: ctx.study_id,
    protocol_version: m.protocol_version, domain_version: m.domain_version, evaluator_type: 'human',
    evaluator_class: m.evaluator_class, wave: m.wave,
    data: { attention_expected: attention.map((t) => Number(t.expected)), attention_answer: attention.map(ratingOf),
            withdrawn, ratings, unlabeled_ratings, demographics, ...(prescreen ? { prescreen } : {}) },
  };
}
