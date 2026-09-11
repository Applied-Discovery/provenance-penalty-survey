import { readSessionContext } from '../src/session';

const uuid = () => 'generated';
test('reads Prolific SESSION_ID and STUDY_ID, generating a session id when absent', () => {
  const c = readSessionContext('?SESSION_ID=P1&STUDY_ID=ST&PROLIFIC_PID=X', undefined, uuid);
  expect(c.session_id).toBe('P1'); expect(c.study_id).toBe('ST'); expect(c.platform_session).toBe(true);
  const d = readSessionContext('', undefined, uuid);
  expect(d.session_id).toBe('generated'); expect(d.study_id).toBeNull(); expect(d.platform_session).toBe(false);
});
test('never records a participant id', () => {
  expect(Object.keys(readSessionContext('?PROLIFIC_PID=X', undefined, uuid))).not.toContain('user_id');
});
test('redirect comes from the manifest only', () => {
  expect(readSessionContext('?redirect=https%3A%2F%2Fx.test', 'https://m.test', uuid).redirect).toBe('https://m.test');
  expect(readSessionContext('', undefined, uuid).redirect).toBeUndefined();
});
test('start_time is ISO', () => {
  expect(() => new Date(readSessionContext('', undefined, uuid).start_time).toISOString()).not.toThrow();
});
test('malformed or oversized ids are ignored and logged, so they never reach storage or HTML', () => {
  const warn = vi.fn();
  const bad = readSessionContext('?SESSION_ID=%3Cimg%20src%3Dx%3E&STUDY_ID=a%20b', undefined, uuid, warn);
  expect(bad.session_id).toBe('generated'); expect(bad.study_id).toBeNull(); expect(bad.platform_session).toBe(false);
  expect(warn).toHaveBeenCalledTimes(2);
  const long = readSessionContext('?SESSION_ID=' + 'a'.repeat(129), undefined, uuid, warn);
  expect(long.session_id).toBe('generated');
  const ok = readSessionContext('?SESSION_ID=5f3a-B_9&STUDY_ID=st_1', undefined, uuid, warn);
  expect(ok).toMatchObject({ session_id: '5f3a-B_9', study_id: 'st_1' });
});
