// Menguji js/gsheets.js terhadap Google Sheets API tiruan di memori.
// Jalankan: node tests/gsheets.test.js
const assert = require('assert');
const G = require('../js/gsheets.js');

const SID = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets/' + SID;

// ---------- Sheets API tiruan ----------
function colIdx(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function parseRange(r) {
  const m = r.match(/^'((?:[^']|'')+)'!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
  if (!m) throw new Error('A1 tidak dikenal: ' + r);
  return { tab: m[1].replace(/''/g, "'"), c1: colIdx(m[2]), r1: m[3] ? Number(m[3]) - 1 : 0, c2: m[4] ? colIdx(m[4]) : colIdx(m[2]), r2: m[5] ? Number(m[5]) - 1 : Infinity };
}

function makeSheet(opts = {}) {
  const book = { tabs: {}, nextId: 1, calls: [], failNext: null, locale: opts.locale || 'en', loadingReads: opts.loadingReads || 0, gf: opts.gf || {} };
  const addTab = t => { book.tabs[t] = { sheetId: book.nextId++, rows: [] }; };
  const get = (tab, r, c) => ((book.tabs[tab].rows[r] || [])[c]);
  const set = (tab, r, c, v) => { const rows = book.tabs[tab].rows; (rows[r] = rows[r] || [])[c] = v; };

  function evalCell(v) {
    if (typeof v !== 'string' || v[0] !== '=') return v;
    const m = v.match(/^=GOOGLEFINANCE\("([^"]+)"(?:([,;])"closeyest")?\)$/);
    if (!m) return '#ERROR!';
    if (m[2] && m[2] !== (book.locale === 'id' ? ';' : ',')) return '#ERROR!';
    const row = book.gf[m[1]];
    if (!row) return '#N/A';
    const val = m[2] ? row.prev : row.price;
    return val === undefined ? '#N/A' : val;
  }

  function read(range) {
    const p = parseRange(range);
    const rows = book.tabs[p.tab].rows;
    const last = Math.min(p.r2, rows.length - 1);
    const out = [];
    for (let r = p.r1; r <= last; r++) {
      const row = [];
      for (let c = p.c1; c <= p.c2; c++) row.push((rows[r] || [])[c]);
      while (row.length && (row[row.length - 1] === undefined || row[row.length - 1] === '')) row.pop();
      out.push(row);
    }
    while (out.length && !out[out.length - 1].length) out.pop();
    return out;
  }

  function write(range, values, userEntered) {
    const p = parseRange(range);
    values.forEach((vr, i) => vr.forEach((v, j) => set(p.tab, p.r1 + i, p.c1 + j, userEntered ? v : v)));
    return p;
  }

  function resp(status, body) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }

  async function fetch(url, o = {}) {
    book.calls.push((o.method || 'GET') + ' ' + url);
    if (book.failNext) { const f = book.failNext; book.failNext = null; return resp(f.status, f.body || {}); }
    if (url.startsWith('https://data-api.binance.vision')) return book.binance(url);
    if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) return resp(200, { email: 'ahmad@example.com' });
    assert(url.startsWith(BASE), 'URL tak terduga: ' + url);
    const u = new URL(url);
    const path = u.pathname.slice(('/v4/spreadsheets/' + SID).length);
    const body = o.body ? JSON.parse(o.body) : null;
    const method = o.method || 'GET';

    if (method === 'GET' && path === '') {
      return resp(200, { sheets: Object.keys(book.tabs).map(t => ({ properties: { sheetId: book.tabs[t].sheetId, title: t } })) });
    }
    if (method === 'POST' && path === ':batchUpdate') {
      body.requests.forEach(rq => {
        if (rq.addSheet) addTab(rq.addSheet.properties.title);
        if (rq.deleteDimension) {
          const d = rq.deleteDimension.range;
          const tab = Object.keys(book.tabs).find(t => book.tabs[t].sheetId === d.sheetId);
          book.tabs[tab].rows.splice(d.startIndex, d.endIndex - d.startIndex);
        }
      });
      return resp(200, {});
    }
    if (method === 'POST' && path === '/values:batchUpdate') {
      body.data.forEach(d => write(d.range, d.values));
      return resp(200, {});
    }
    if (method === 'POST' && path === '/values:batchClear') {
      body.ranges.forEach(rg => {
        const p = parseRange(rg);
        const rows = book.tabs[p.tab].rows;
        for (let r = p.r1; r < rows.length && r <= p.r2; r++) for (let c = p.c1; c <= p.c2; c++) if (rows[r]) rows[r][c] = undefined;
      });
      return resp(200, {});
    }
    if (method === 'GET' && path === '/values:batchGet') {
      return resp(200, { valueRanges: u.searchParams.getAll('ranges').map(rg => ({ range: rg, values: read(rg) })) });
    }
    const m = path.match(/^\/values\/(.+?)(:append)?$/);
    if (m) {
      const range = decodeURIComponent(m[1]);
      const p = parseRange(range);
      if (method === 'POST' && m[2]) {
        const rows = book.tabs[p.tab].rows;
        let at = rows.length;
        while (at > 1 && (!rows[at - 1] || !rows[at - 1].some(x => x !== undefined && x !== ''))) at--;
        body.values.forEach((vr, i) => vr.forEach((v, j) => set(p.tab, at + i, p.c1 + j, v)));
        return resp(200, {});
      }
      if (method === 'PUT') {
        const ue = u.searchParams.get('valueInputOption') === 'USER_ENTERED';
        write(range, body.values, ue);
        if (p.tab === 'Harga') book.pendingReads = book.loadingReads;
        return resp(200, {});
      }
      if (method === 'GET') {
        let vals = read(range);
        if (p.tab === 'Harga') {
          if (book.pendingReads > 0) { book.pendingReads--; vals = vals.map(r => [r[0], 'Loading...', 'Loading...']); }
          else vals = vals.map(r => [r[0], evalCell(r[1]), evalCell(r[2])]);
        }
        return resp(200, { values: vals });
      }
    }
    throw new Error('Endpoint tak terduga: ' + method + ' ' + url);
  }
  book.fetch = fetch;
  book.get = get;
  book.addTab = addTab;
  return book;
}

const authOk = { ensure: async () => 'tok', invalidate() {}, token: () => 'tok' };
const sleep = async () => {};
const mk = (book, auth = authOk) => G.createClient({ sheetId: SID, auth, fetch: book.fetch, sleep });
const run = async (name, fn) => { await fn(); console.log('  ok', name); };

(async () => {
  // ---------- util ----------
  await run('parseSheetId', async () => {
    assert.strictEqual(G.parseSheetId('https://docs.google.com/spreadsheets/d/' + SID + '/edit?usp=sharing'), SID);
    assert.strictEqual(G.parseSheetId(SID), SID);
    assert.strictEqual(G.parseSheetId('abc'), '');
    assert.strictEqual(G.parseSheetId(''), '');
  });

  // ---------- tab & data ----------
  await run('ensureTabs membuat 6 tab data + Harga dengan judul kolom, aman diulang', async () => {
    const b = makeSheet(); b.addTab('Sheet1');
    const c = mk(b);
    await c.ensureTabs();
    assert.deepStrictEqual(Object.keys(b.book || b.tabs).sort(), ['Crypto Reward', 'Crypto Transaksi', 'Harga', 'ID Dividen', 'ID Transaksi', 'Sheet1', 'US Dividen', 'US Transaksi']);
    assert.strictEqual(b.get('ID Transaksi', 0, 4), 'Lot');
    assert.strictEqual(b.get('US Transaksi', 0, 5), 'Harga per Lembar (USD)');
    assert.strictEqual(b.get('Crypto Reward', 0, 6), 'Total Diterima');
    const before = b.calls.length;
    await c.ensureTabs();
    assert(!b.calls.slice(before).some(x => x.includes('batchUpdate')), 'tidak membuat tab lagi');
  });

  await run('append lalu readAll: angka tetap angka, tanggal tetap teks, pasar benar', async () => {
    const b = makeSheet(); const c = mk(b);
    await c.ensureTabs();
    await c.append('transaksi', { id: 'a1', pasar: 'ID', tanggal: '2026-10-09', kode: 'BBCA', jenis: 'BELI', qty: 10, harga: 9000, fee: 13500, catatan: 'x' });
    await c.append('transaksi', { id: 'a2', pasar: 'US', tanggal: '2026-10-09', kode: 'AAPL', jenis: 'BELI', qty: 2.5, harga: 200.5, fee: 0, catatan: '' });
    await c.append('transaksi', { id: 'a3', pasar: 'CRYPTO', tanggal: '2026-10-09', kode: 'BTC', jenis: 'BELI', qty: 0.0025, harga: 1500000000, fee: 7500, catatan: '' });
    await c.append('dividen', { id: 'd1', pasar: 'ID', tanggal: '2026-10-09', kode: 'TLKM', qty: '', dps: '', pajak: 10, jumlah: 360000, catatan: '' });
    const all = await c.readAll();
    assert.strictEqual(all.transaksi.length, 3);
    const us = all.transaksi.find(x => x.id === 'a2');
    assert.strictEqual(us.pasar, 'US'); assert.strictEqual(us.qty, 2.5); assert.strictEqual(us.harga, 200.5);
    assert.strictEqual(all.transaksi.find(x => x.id === 'a3').qty, 0.0025);
    assert.strictEqual(all.transaksi[0].tanggal, '2026-10-09');
    assert.strictEqual(all.dividen[0].jumlah, 360000);
    assert.strictEqual(all.dividen[0].pasar, 'ID');
  });

  await run('baris diketik manual: tanggal nomor seri jadi YYYY-MM-DD dan ID dibuat lalu ditulis balik', async () => {
    const b = makeSheet(); const c = mk(b);
    await c.ensureTabs();
    // 2026-10-09 sebagai nomor seri Sheets
    const serial = Math.round((Date.UTC(2026, 9, 9) - Date.UTC(1899, 11, 30)) / 86400000);
    b.tabs['ID Transaksi'].rows[1] = ['', serial, 'tlkm', 'BELI', 5, 3000, 0, 'manual'];
    b.tabs['US Transaksi'].rows[1] = ['', '2026-01-02', '', 'BELI', 1, 1, 0, '']; // tanpa kode: diabaikan
    const all = await c.readAll();
    assert.strictEqual(all.transaksi.length, 1);
    assert.strictEqual(all.transaksi[0].tanggal, '2026-10-09');
    assert(all.transaksi[0].id, 'ID dibuat');
    assert.strictEqual(b.get('ID Transaksi', 1, 0), all.transaksi[0].id, 'ID ditulis balik');
  });

  await run('update di tempat, pindah pasar, dan hapus', async () => {
    const b = makeSheet(); const c = mk(b);
    await c.ensureTabs();
    const base = { pasar: 'ID', tanggal: '2026-10-01', kode: 'BBCA', jenis: 'BELI', qty: 10, harga: 9000, fee: 0, catatan: '' };
    await c.append('transaksi', Object.assign({ id: 'x1' }, base));
    await c.append('transaksi', Object.assign({ id: 'x2' }, base, { kode: 'BMRI' }));
    await c.append('transaksi', Object.assign({ id: 'x3' }, base, { kode: 'ASII' }));

    await c.update('transaksi', Object.assign({ id: 'x2' }, base, { kode: 'BMRI', qty: 99 }));
    let all = await c.readAll();
    assert.strictEqual(all.transaksi.find(x => x.id === 'x2').qty, 99);
    assert.strictEqual(all.transaksi.length, 3);

    // pindah ke pasar US: hilang dari tab ID, muncul di tab US
    await c.update('transaksi', Object.assign({ id: 'x2' }, base, { pasar: 'US', kode: 'MSFT', qty: 1.5 }));
    all = await c.readAll();
    assert.strictEqual(all.transaksi.length, 3);
    assert.strictEqual(all.transaksi.find(x => x.id === 'x2').pasar, 'US');
    assert.strictEqual(all.transaksi.filter(x => x.pasar === 'ID').length, 2);

    // update untuk id yang tidak ada menambah baris
    await c.update('transaksi', Object.assign({ id: 'x9' }, base, { kode: 'TLKM' }));
    assert.strictEqual((await c.readAll()).transaksi.length, 4);

    await c.remove('transaksi', 'x1', 'ID');
    await c.remove('transaksi', 'x3');
    all = await c.readAll();
    assert.deepStrictEqual(all.transaksi.map(x => x.id).sort(), ['x2', 'x9']);
    assert.strictEqual(b.get('ID Transaksi', 0, 0), 'ID', 'judul kolom tidak ikut terhapus');
  });

  await run('replaceAll mengganti isi per tab', async () => {
    const b = makeSheet(); const c = mk(b);
    await c.ensureTabs();
    await c.append('transaksi', { id: 'old', pasar: 'ID', tanggal: '2026-01-01', kode: 'BBCA', jenis: 'BELI', qty: 1, harga: 1, fee: 0, catatan: '' });
    await c.replaceAll({
      transaksi: [
        { id: 'n1', pasar: 'US', tanggal: '2026-02-01', kode: 'MSFT', jenis: 'BELI', qty: 1, harga: 400, fee: 0, catatan: '' },
        { id: 'n2', pasar: 'CRYPTO', tanggal: '2026-02-01', kode: 'ETH', jenis: 'BELI', qty: 0.5, harga: 5, fee: 0, catatan: '' }
      ],
      dividen: []
    });
    const all = await c.readAll();
    assert.deepStrictEqual(all.transaksi.map(x => x.id).sort(), ['n1', 'n2']);
    assert.strictEqual(b.get('ID Transaksi', 0, 0), 'ID');
  });

  // ---------- harga ----------
  const binanceFor = known => async url => {
    const u = new URL(url);
    const list = u.searchParams.get('symbols') ? JSON.parse(u.searchParams.get('symbols')) : [u.searchParams.get('symbol')];
    const unknown = list.filter(s => !known[s]);
    const item = s => ({ symbol: s, lastPrice: String(known[s].last), openPrice: String(known[s].open), closeTime: 1760000000000 });
    if (unknown.length) return { ok: false, status: 400, json: async () => ({ code: -1121, msg: 'Invalid symbol.' }) };
    return { ok: true, status: 200, json: async () => (u.searchParams.get('symbols') ? list.map(item) : item(list[0])) };
  };

  await run('harga: crypto dari Binance, saham dan kurs dari GOOGLEFINANCE (sambil menunggu Loading)', async () => {
    const b = makeSheet({ loadingReads: 2, gf: {
      'CURRENCY:USDIDR': { price: 16250 }, 'IDX:BBCA': { price: 9500, prev: 9400 }, 'AAPL': { price: 230.5, prev: 228 }
    } });
    b.binance = binanceFor({ BTCUSDT: { last: 98000, open: 97000 } });
    const c = mk(b); await c.ensureTabs();
    const r = await c.prices(['ID:BBCA', 'US:AAPL', 'CRYPTO:BTC']);
    assert.strictEqual(r.prices['ID:BBCA'].price, 9500); assert.strictEqual(r.prices['ID:BBCA'].prev, 9400);
    assert.strictEqual(r.prices['US:AAPL'].price, 230.5);
    assert.strictEqual(r.prices['CRYPTO:BTC'].price, 98000); assert.strictEqual(r.prices['CRYPTO:BTC'].prev, 97000);
    assert.strictEqual(r.fx, 16250);
    assert.deepStrictEqual(r.errors, {});
  });

  await run('harga: spreadsheet berbahasa Indonesia (titik koma) tetap mendapat harga sebelumnya', async () => {
    const b = makeSheet({ locale: 'id', gf: { 'CURRENCY:USDIDR': { price: 16000 }, 'IDX:TLKM': { price: 3400, prev: 3350 } } });
    b.binance = binanceFor({});
    const r = await mk(b).prices(['ID:TLKM']);
    assert.strictEqual(r.prices['ID:TLKM'].price, 3400);
    assert.strictEqual(r.prices['ID:TLKM'].prev, 3350, 'prev lewat percobaan ulang dengan titik koma');
    assert.strictEqual(r.fx, 16000);
  });

  await run('harga: simbol crypto tak dikenal Binance jatuh ke GOOGLEFINANCE, kode salah dilaporkan', async () => {
    const b = makeSheet({ gf: { 'CURRENCY:USDIDR': { price: 16000 }, 'CURRENCY:SOLUSD': { price: 150 } } });
    b.binance = binanceFor({ BTCUSDT: { last: 98000, open: 97000 } });
    const r = await mk(b).prices(['CRYPTO:BTC', 'CRYPTO:SOL', 'CRYPTO:ZZZ', 'ID:NOPE']);
    assert.strictEqual(r.prices['CRYPTO:BTC'].price, 98000);
    assert.strictEqual(r.prices['CRYPTO:SOL'].price, 150);
    assert.strictEqual(r.prices['CRYPTO:SOL'].prev, null);
    assert(r.errors['CRYPTO:ZZZ'] && r.errors['ID:NOPE']);
    assert(!r.prices['CRYPTO:ZZZ'] && !r.prices['ID:NOPE']);
  });

  await run('harga: Binance tidak terjangkau -> semua crypto lewat GOOGLEFINANCE', async () => {
    const b = makeSheet({ gf: { 'CURRENCY:USDIDR': { price: 16000 }, 'CURRENCY:BTCUSD': { price: 97500 } } });
    b.binance = async () => { throw new TypeError('Failed to fetch'); };
    const r = await mk(b).prices(['CRYPTO:BTC']);
    assert.strictEqual(r.prices['CRYPTO:BTC'].price, 97500);
  });

  await run('harga: kode saham US dengan tanda hubung memakai titik di GOOGLEFINANCE', async () => {
    const b = makeSheet({ gf: { 'CURRENCY:USDIDR': { price: 16000 }, 'BRK.B': { price: 480, prev: 478 } } });
    b.binance = binanceFor({});
    const r = await mk(b).prices(['US:BRK-B']);
    assert.strictEqual(r.prices['US:BRK-B'].price, 480);
  });

  // ---------- error ----------
  await run('401 memicu login ulang sekali lalu mengulang', async () => {
    const b = makeSheet(); b.addTab('X');
    let invalidated = 0;
    const auth = { ensure: async () => 'tok', invalidate: () => { invalidated++; }, token: () => 'tok' };
    const c = mk(b, auth);
    b.failNext = { status: 401 };
    await c.ensureTabs();
    assert.strictEqual(invalidated, 1);
    assert(Object.keys(b.tabs).includes('ID Transaksi'));
  });

  await run('pesan error berbahasa Indonesia untuk 403, 404, dan API belum aktif', async () => {
    const b = makeSheet(); const c = mk(b);
    b.failNext = { status: 403, body: { error: { message: 'The caller does not have permission' } } };
    await assert.rejects(() => c.ensureTabs(), /tidak punya akses ke spreadsheet/);
    b.failNext = { status: 404, body: {} };
    await assert.rejects(() => c.ensureTabs(), /Spreadsheet tidak ditemukan/);
    b.failNext = { status: 403, body: { error: { message: 'Google Sheets API has not been used in project 123 before or it is disabled.' } } };
    await assert.rejects(() => c.ensureTabs(), /belum diaktifkan/);
  });

  // ---------- login ----------
  const gisWith = behaviour => ({
    initTokenClient: cfg => {
      const client = { cfg };
      client.requestAccessToken = () => behaviour(client);
      return client;
    },
    revoke: (t, cb) => { gisWith.revoked = t; cb && cb(); }
  });

  await run('login: token berlaku sampai kedaluwarsa lalu meminta lagi', async () => {
    let n = 0, t = 1000000;
    const gis = gisWith(client => { n++; client.callback({ access_token: 'T' + n, expires_in: 3600 }); });
    const auth = G.createAuth({ clientId: 'cid', loadGis: async () => gis, now: () => t, fetch: async () => ({ ok: true, json: async () => ({ email: 'ahmad@example.com' }) }) });
    assert.strictEqual(auth.token(), null);
    assert.strictEqual(await auth.ensure(), 'T1');
    assert.strictEqual(await auth.ensure(), 'T1');
    assert.strictEqual(n, 1);
    t += 3600 * 1000;
    assert.strictEqual(auth.token(), null, 'kedaluwarsa');
    assert.strictEqual(await auth.ensure(), 'T2');
    await auth.signIn();
    assert.strictEqual(auth.email(), 'ahmad@example.com');
    auth.signOut();
    assert.strictEqual(auth.token(), null);
    assert.strictEqual(gisWith.revoked, 'T3');
  });

  await run('login: jendela ditutup, pop-up diblokir, akses ditolak', async () => {
    const mkAuth = behaviour => G.createAuth({ clientId: 'cid', loadGis: async () => gisWith(behaviour) });
    await assert.rejects(() => mkAuth(c => c.error_callback({ type: 'popup_closed' })).ensure(), /ditutup/);
    await assert.rejects(() => mkAuth(c => c.error_callback({ type: 'popup_failed_to_open' })).ensure(), /memblokir/);
    await assert.rejects(() => mkAuth(c => c.callback({ error: 'access_denied' })).ensure(), /Test user/);
    await assert.rejects(() => G.createAuth({ clientId: 'cid', loadGis: async () => { throw new Error('Tidak bisa memuat layanan login Google.'); } }).ensure(), /Tidak bisa memuat/);
  });

  console.log('Semua tes Google Sheets lulus.');
})().catch(e => { console.error(e); process.exit(1); });
