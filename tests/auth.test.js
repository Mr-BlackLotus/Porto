const assert = require('assert');
const G = require('../js/gsheets.js');
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; }, m }; };
let clock = 1000000; const now = () => clock;
let requests = 0;
const gis = { initTokenClient: cfg => ({ requestAccessToken() { requests++; setTimeout(() => this.callback({ access_token: 'tok' + requests, expires_in: 3600 }), 5); } }), revoke: (t, cb) => cb && cb() };
const mk = (storage) => G.createAuth({ clientId: 'cid', loadGis: async () => gis, now, storage, fetch: async () => ({ ok: true, json: async () => ({ email: 'a@b.c' }) }) });
(async () => {
  const st = mem();
  let a = mk(st);
  assert.strictEqual(a.token(), null);
  const [t1, t2] = await Promise.all([a.signIn(), a.signIn()]);
  assert.strictEqual(requests, 1, 'login bersamaan hanya satu pop-up');
  assert.ok(a.token());
  assert.ok(a.remaining() > 3000000);
  // muat ulang halaman: token dipulihkan
  let b = mk(st);
  assert.strictEqual(b.token(), a.token(), 'token dipulihkan dari penyimpanan');
  // Client ID lain tidak memakai token itu
  const c = G.createAuth({ clientId: 'lain', loadGis: async () => gis, now, storage: st });
  assert.strictEqual(c.token(), null);
  // kedaluwarsa
  clock += 3700 * 1000;
  assert.strictEqual(mk(st).token(), null, 'token kedaluwarsa tidak dipulihkan');
  // keluar menghapus
  await a.signIn(); assert.ok(st.getItem('porto.auth.v1'));
  a.signOut(); assert.strictEqual(st.getItem('porto.auth.v1'), null);
  // penyimpanan rusak/diblokir tidak membuat error
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const d = mk(bad); await d.signIn(); assert.ok(d.token());
  console.log('Semua tes auth lulus.');
})().catch(e => { console.error(e); process.exit(1); });
