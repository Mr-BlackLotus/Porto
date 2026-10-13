// Menguji pencarian/pembuatan spreadsheet "Porto" otomatis. Jalankan: node tests/locate.test.js
const assert = require('assert');
const G = require('../js/gsheets.js');
const auth = { ensure: async () => 'tok' };
function fake(files, failDrive) {
  const calls = [];
  const f = async (url, o) => {
    calls.push({ url, method: o.method, body: o.body && JSON.parse(o.body) });
    const res = (status, j) => ({ ok: status < 400, status, json: async () => j });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files')) return failDrive ? res(403, { error: { message: 'Google Drive API has not been used in project 1 before or it is disabled' } }) : res(200, { files });
    if (url === 'https://sheets.googleapis.com/v4/spreadsheets') return res(200, { spreadsheetId: 'NEWID' });
    if (url.endsWith('/values:batchUpdate')) return res(200, {});
    return res(404, {});
  };
  return { f, calls };
}
(async () => {
  assert.ok(G.SCOPE.includes('drive.file') && !/auth\/spreadsheets/.test(G.SCOPE), 'izin sempit drive.file');
  let t = fake([{ id: 'A1' }, { id: 'B2' }]);
  assert.strictEqual(await G.locateSheet({ auth, fetch: t.f }), 'A1');
  assert.strictEqual(await G.locateSheet({ auth, fetch: t.f, preferred: 'B2' }), 'B2');
  assert.ok(/name%20%3D%20'?%27?Porto|Porto/.test(decodeURIComponent(t.calls[0].url)) && t.calls.every(c => c.method === 'GET'));
  t = fake([]);
  assert.strictEqual(await G.locateSheet({ auth, fetch: t.f }), 'NEWID');
  const create = t.calls[1];
  assert.strictEqual(create.body.properties.title, 'Porto');
  const titles = create.body.sheets.map(s => s.properties.title);
  assert.deepStrictEqual(titles.slice().sort(), ['Crypto Dividen', 'Crypto Reward', 'Crypto Transaksi', 'Harga', 'ID Dividen', 'ID Transaksi', 'US Dividen', 'US Transaksi'].filter(x => x !== 'Crypto Dividen').sort());
  assert.strictEqual(t.calls[2].body.data.length, 6, 'judul kolom ditulis untuk 6 tab');
  t = fake([], true);
  await assert.rejects(() => G.locateSheet({ auth, fetch: t.f }), /Drive API/);
  console.log('Semua tes locate lulus.');
})().catch(e => { console.error(e); process.exit(1); });
