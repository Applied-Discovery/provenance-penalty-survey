import { DomainManifest, Author, artifactId } from './manifest';
import { Rng } from './rng';

export interface PlannedArtifact { id: string; author: Author; index: number; path: string }
export interface LabeledItem   { kind: 'labeled';   artifact: PlannedArtifact; stated_author: Author; survey_pos: number }
export interface AttentionItem { kind: 'attention'; check_index: number; expected: number; artifact: PlannedArtifact }
export interface UnlabeledItem { kind: 'unlabeled'; artifact: PlannedArtifact; survey_pos: number }
export interface SessionPlan { labeled: (LabeledItem | AttentionItem)[]; unlabeled: UnlabeledItem[] }

function pool(m: DomainManifest, author: Author): PlannedArtifact[] {
  return Object.entries(m.artifacts[author]).map(([k, path]) => {
    const index = Number(k);
    return { id: artifactId(m, author, index), author, index, path };
  });
}

/** Split n into two halves; the odd remainder goes to either side at random. */
function halve(n: number, rng: Rng): [number, number] {
  const a = Math.floor(n / 2) + (n % 2 === 1 && rng.next() < 0.5 ? 1 : 0);
  return [a, n - a];
}

export function buildSessionPlan(m: DomainManifest, rng: Rng): SessionPlan {
  const perAuthor = m.labeled_artifacts_per_session / 2;
  const human = rng.shuffle(pool(m, 'human')), ai = rng.shuffle(pool(m, 'ai'));

  // Draw the first n eligible artifacts from a shuffled pool, removing them from it. With avoid_pairs, an artifact
  // is eligible only if its pair index has not been drawn yet (human i and ai i never share a session); with the
  // flag off every artifact is eligible and the draw sequence is unchanged.
  const used = new Set<number>();
  const draw = (arts: PlannedArtifact[], n: number): PlannedArtifact[] => {
    const out: PlannedArtifact[] = [];
    for (let i = 0; i < arts.length && out.length < n; ) {
      if (m.avoid_pairs && used.has(arts[i].index)) { i++; continue; }
      out.push(...arts.splice(i, 1));
    }
    out.forEach((a) => used.add(a.index));
    return out;
  };

  // Stated labels crossed with actual: within each actual group, half human-stated, half AI-stated.
  // If perAuthor is odd, the extra human-stated label goes to one group and the extra AI-stated to the other,
  // so that stated totals stay exactly perAuthor each.
  const [humanGroupHumanStated, aiGroupHumanStated] = halve(perAuthor, rng);   // sums to perAuthor
  const assign = (arts: PlannedArtifact[], nHumanStated: number): LabeledItem[] =>
    rng.shuffle(arts.map((artifact, i): LabeledItem => ({
      kind: 'labeled', artifact, stated_author: i < nHumanStated ? 'human' : 'ai', survey_pos: 0,
    })));
  const labeledItems = rng.shuffle([
    ...assign(draw(human, perAuthor), humanGroupHumanStated),
    ...assign(draw(ai, perAuthor), aiGroupHumanStated),
  ]);
  labeledItems.forEach((it, i) => { it.survey_pos = i + 1; });

  // Remaining pool. Draw order (implementation choice): unlabeled first, then attention. Unlabeled draws are
  // strict (never fall back to the other author) so the registered even split is enforced, not just arithmetic
  // that happens to hold given this draw order. Only attention-check draws may fall back to the other author,
  // since the spec's pool rule for attention checks is a sum over both authors.
  const rest: Record<Author, PlannedArtifact[]> = { human, ai };   // what the labeled draws left
  const take = (prefer: Author, allowFallback: boolean): PlannedArtifact => {
    const a = draw(rest[prefer], 1)[0] ?? (allowFallback ? draw(rest[prefer === 'human' ? 'ai' : 'human'], 1)[0] : undefined);
    if (!a) throw new Error(`Artifact pool exhausted for ${prefer}; manifest validation should have caught this`);
    return a;
  };

  // Unlabeled block: even split, odd remainder to either author at random; then shuffled.
  const [unlabHuman, unlabAi] = halve(m.unlabeled_per_session, rng);
  const unlabeledArts = rng.shuffle([
    ...Array.from({ length: unlabHuman }, () => take('human', false)),
    ...Array.from({ length: unlabAi }, () => take('ai', false)),
  ]);

  // Attention checks use real artifacts from what is left, at fixed slots:
  // check k of N goes before labeled position floor(k * L / N).
  const L = labeledItems.length, N = m.attention_checks;
  const attention: AttentionItem[] = Array.from({ length: N }, (_, k) => ({
    kind: 'attention', check_index: k, expected: rng.int(1, 10),
    artifact: take(rng.pick(['human', 'ai']), true),
  }));
  const slots = attention.map((_, k) => Math.floor((k * L) / N));
  const labeled: (LabeledItem | AttentionItem)[] = [];
  labeledItems.forEach((it, i) => {
    slots.forEach((s, k) => { if (s === i) labeled.push(attention[k]); });
    labeled.push(it);
  });

  const unlabeled = unlabeledArts.map((artifact, i): UnlabeledItem => ({ kind: 'unlabeled', artifact, survey_pos: L + i + 1 }));
  return { labeled, unlabeled };
}
