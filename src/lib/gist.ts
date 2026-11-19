/**
 * Sync via one secret GitHub Gist. No server of our own: every device talks to the
 * GitHub API directly with a personal access token that has only the "gist" scope.
 */
import { SyncDoc, emptyDoc } from './model';

export const GIST_FILE = 'chess-trainer-sync.json';
const API = 'https://api.github.com';

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function check(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub rejected the token (expired or wrong?).');
    if (res.status === 404) throw new Error(`${what}: not found (does the token have the "gist" scope?).`);
    throw new Error(`${what} failed: HTTP ${res.status}`);
  }
  return res;
}

/** Find an existing sync gist for this token's account, or create one. */
export async function findOrCreateGist(token: string): Promise<string> {
  for (let page = 1; page <= 10; page++) {
    const res = await check(await fetch(`${API}/gists?per_page=100&page=${page}`, { headers: headers(token) }), 'Listing gists');
    const list = (await res.json()) as { id: string; files: Record<string, unknown> }[];
    const hit = list.find((g) => GIST_FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  const res = await check(
    await fetch(`${API}/gists`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        description: 'Chess Trainer sync data (profiles, games, ratings)',
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify(emptyDoc()) } },
      }),
    }),
    'Creating gist',
  );
  return ((await res.json()) as { id: string }).id;
}

export async function readGist(token: string, gistId: string): Promise<SyncDoc> {
  const res = await check(await fetch(`${API}/gists/${gistId}`, { headers: headers(token), cache: 'no-store' }), 'Reading gist');
  const gist = (await res.json()) as { files: Record<string, { content: string; truncated: boolean; raw_url: string }> };
  const file = gist.files[GIST_FILE];
  if (!file) return emptyDoc();
  let text = file.content;
  if (file.truncated) {
    // Files over ~1 MB are truncated in the API response; fetch the raw file instead.
    text = await (await check(await fetch(file.raw_url, { cache: 'no-store' }), 'Reading raw gist')).text();
  }
  const doc = JSON.parse(text) as SyncDoc;
  return doc && doc.profiles ? doc : emptyDoc();
}

export async function writeGist(token: string, gistId: string, doc: SyncDoc): Promise<void> {
  await check(
    await fetch(`${API}/gists/${gistId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(doc) } } }),
    }),
    'Writing gist',
  );
}
