import { Rng, hashSeed } from '../src/rng';
import fc from 'fast-check';

test('same seed, same sequence', () => {
  const a = new Rng(hashSeed('s1')), b = new Rng(hashSeed('s1'));
  expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
});
test('different seeds differ', () => {
  expect(new Rng(hashSeed('s1')).next()).not.toBe(new Rng(hashSeed('s2')).next());
});
test('int is inclusive and in range', () => {
  const r = new Rng(1); const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(r.int(1, 10));
  expect([...seen].sort((x, y) => x - y)).toEqual([1,2,3,4,5,6,7,8,9,10]);
});
test('shuffle is a permutation and leaves input untouched', () => {
  const input = [1,2,3,4,5]; const out = new Rng(7).shuffle(input);
  expect(input).toEqual([1,2,3,4,5]); expect([...out].sort()).toEqual([1,2,3,4,5]);
});

// Property tests: the same claims for any seed and any bounds.
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
test('property: int is an integer within [min, max] for any seed and bounds', () => {
  fc.assert(fc.property(fc.integer(), fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 0, max: 100 }), (seed, min, span) => {
    const r = new Rng(seed);
    return Array.from({ length: 200 }, () => r.int(min, min + span)).every((v) => Number.isInteger(v) && v >= min && v <= min + span);
  }));
});
test('property: shuffle is a permutation for any input and seed', () => {
  fc.assert(fc.property(fc.integer(), fc.array(fc.integer()), (seed, xs) => {
    const out = new Rng(seed).shuffle(xs);
    return out.length === xs.length && sorted(out).every((v, i) => v === sorted(xs)[i]);
  }));
});
test('property: same seed replays the same sequence', () => {
  fc.assert(fc.property(fc.integer(), (seed) => {
    const a = new Rng(seed), b = new Rng(seed);
    return Array.from({ length: 50 }, () => a.next()).every((v) => v === b.next());
  }));
});

// Golden values. These pin the hash and generator output themselves; if either algorithm changes, every
// recorded session's plan changes with it. A failure here means a protocol version bump, not a test update.
test('golden: hashSeed and Rng output are frozen', () => {
  expect(hashSeed('golden-session')).toBe(-2144505350);
  expect(hashSeed('')).toBe(1382371643);
  const r = new Rng(hashSeed('golden-session'));
  expect([r.next(), r.next(), r.next()]).toEqual([0.6379581808578223, 0.02998705906793475, 0.7278741744812578]);
  const ints = new Rng(hashSeed('golden-session'));
  expect(Array.from({ length: 5 }, () => ints.int(1, 10))).toEqual([7, 1, 8, 2, 4]);
  expect(new Rng(hashSeed('golden-session')).shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([4, 8, 3, 2, 7, 5, 1, 6]);
});
