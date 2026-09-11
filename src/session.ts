/** `platform_session` is true when SESSION_ID came from the recruitment platform's link, so consent can mention
 * the platform id only when one is actually being handled. */
export interface SessionContext { session_id: string; study_id: string | null; platform_session: boolean; redirect?: string; start_time: string }

/** Prolific ids are short hex strings; anything else is a malformed or hand-edited link. The same rule keeps ids safe
 * in DataPipe file names and in HTML, and rejects oversized values before they reach storage. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function readId(p: URLSearchParams, name: string, warn: (msg: string) => void): string | null {
  const v = p.get(name);
  if (v === null || v === '') return null;
  if (ID_PATTERN.test(v)) return v;
  warn(`${name} ignored: must match ${ID_PATTERN}`);
  return null;
}

export function readSessionContext(
  search: string, manifestRedirect?: string, uuid: () => string = () => crypto.randomUUID(),
  warn: (msg: string) => void = (msg) => console.warn(msg),
): SessionContext {
  const p = new URLSearchParams(search);
  const platformId = readId(p, 'SESSION_ID', warn);
  return {
    session_id: platformId ?? uuid(),
    study_id: readId(p, 'STUDY_ID', warn),
    platform_session: platformId !== null,
    redirect: manifestRedirect,
    start_time: new Date().toISOString(),
  };
}
