// Thin client for the local Margin server.

async function req(method, url, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) {
    opt.headers['Content-Type'] = typeof body === 'string' ? 'text/plain' : 'application/json';
    opt.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const r = await fetch(url, opt);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

const q = (id) => encodeURIComponent(id);

export const api = {
  library: () => req('GET', '/api/library'),
  book: (id) => req('GET', `/api/book?id=${q(id)}`),
  siblings: (id) => req('GET', `/api/siblings?id=${q(id)}`),
  removeBook: (id) => req('DELETE', `/api/book?id=${q(id)}`),
  state: (id) => req('GET', `/api/state?id=${q(id)}`),
  saveState: (id, s) => req('PUT', `/api/state?id=${q(id)}`, s),
  saveStateBeacon(id, s) {
    try {
      fetch(`/api/state?id=${q(id)}`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    } catch (e) { /* ignore */ }
  },
  states: () => req('GET', '/api/states'),
  settings: () => req('GET', '/api/settings'),
  saveSettings: (s) => req('PUT', '/api/settings', s),
  addRoot: (path) => req('POST', '/api/roots', { path }),
  removeRoot: (id) => req('DELETE', `/api/roots?id=${q(id)}`),
  async importFile(file) {
    const text = await file.text();
    return req('POST', `/api/import?name=${q(file.name)}`, text);
  },
  assetURL: (bookId, src) => `/api/asset?id=${q(bookId)}&src=${encodeURIComponent(src)}`,
  events(bookId, onBook, onLibrary) {
    const es = new EventSource(`/api/events?id=${q(bookId || '')}${onLibrary ? '&library=1' : ''}`);
    if (onBook) es.addEventListener('book', onBook);
    if (onLibrary) es.addEventListener('library', onLibrary);
    return es;
  },
};
