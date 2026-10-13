const assert = require('assert');
const Live = require('../js/live.js');
const made = [];
class FakeWS { constructor(u) { this.url = u; made.push(this); } close() { this.closed = true; this.onclose && this.onclose(); } }
const ticks = [], states = [];
const l = Live.create({ WebSocket: FakeWS, onTick: (k, t) => ticks.push([k, t]), onState: s => states.push(s) });
l.setKeys(['ID:BBCA', 'CRYPTO:ETH', 'CRYPTO:BTC']);
assert.strictEqual(made.length, 1);
assert.ok(/streams=btcusdt@miniTicker\/ethusdt@miniTicker$/.test(made[0].url), made[0].url);
made[0].onopen(); assert.deepStrictEqual(states, ['on']);
made[0].onmessage({ data: JSON.stringify({ stream: 'x', data: { s: 'BTCUSDT', c: '100000.5', o: '98000', E: 1760000000000 } }) });
made[0].onmessage({ data: 'bukan json' });
made[0].onmessage({ data: JSON.stringify({ data: { s: 'BTCBUSD', c: '1', o: '1' } }) });
assert.deepStrictEqual(ticks, [['CRYPTO:BTC', { price: 100000.5, prev: 98000, time: 1760000000 }]]);
l.setKeys(['CRYPTO:BTC', 'CRYPTO:ETH']); assert.strictEqual(made.length, 1, 'daftar sama tidak menyambung ulang');
l.setKeys(['CRYPTO:SOL']); assert.strictEqual(made.length, 2); assert.ok(made[0].closed);
l.setKeys([]); assert.strictEqual(states[states.length - 1], 'idle');
l.stop();
console.log('Semua tes live lulus.');
