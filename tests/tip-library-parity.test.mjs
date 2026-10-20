// Parity of the app's tip lookup (NATIONSPIT.html, between "tip-lookup:start"
// and "tip-lookup:end") with the team's Python version.
// tests/fixtures/tip_parity.json holds answers from SpinOff_AI's sklearn index
// (feedback_knn.pkl) with the rule of amir_pipeline._get_tip: of the 5 nearest
// tips, the first one written for the same kick type, else the nearest tip.
// The app never shows a tip written for another kick type, so where Python
// falls back to one, the app must return -1.
// Run with: bash tests/run.sh   (or: node --test tests/tip-library-parity.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const read = p => fs.readFileSync(new URL(p, ROOT), 'utf8');
const html = read('NATIONSPIT.html');
const T = JSON.parse(read('amir/tips.json'));
const FX = JSON.parse(read('tests/fixtures/tip_parity.json'));

// The app's own lookup code, run in a sandbox.
const a = html.indexOf('// tip-lookup:start'), b = html.indexOf('// tip-lookup:end');
assert.ok(a > 0 && b > a, 'NATIONSPIT.html marks the tip lookup block');
const app = vm.runInNewContext(html.slice(a, b) +
  ';({TIP_TYPES,tipNeighbours,tipIndex,libraryTipFor,validTipTable})', {});

// Squared distance from a query to tip i, written out here so the test can
// tell exact ties apart from real differences. Shot type is a number in the
// index (power 0, curve 1, chip 2, ...), so two tips can be exactly as far
// away as each other; the 6-decimal rows in tips.json move such ties by
// about 1e-6, and sklearn may list either tip first.
const f = Math.fround;
const dist = (type, v, i) => {
  const q = [T.shot_type_id[type] ?? 0, ...v].map((x, j) => f(f(f(x) - T.mean[j]) / T.scale[j]));
  return T.X[i].reduce((s, x, j) => s + (x - q[j]) ** 2, 0);
};
const tied = (type, v, i, j) => Math.abs(dist(type, v, i) - dist(type, v, j)) < 1e-5;

test('amir/tips.json is a valid, minified tip table', () => {
  assert.ok(app.validTipTable(T));
  assert.equal(T.k, 5);
  assert.equal(T.tip.length, 201);
  assert.deepEqual(Object.keys(T.shot_type_id), ['power_shot', 'curve_ball', 'chip_shot', 'weak_foot',
    'penalty_kick', 'free_kick', 'dribble_touch']);
  for (const t of Object.values(app.TIP_TYPES)) assert.ok(T.shot_type.includes(t), 'library has ' + t + ' tips');
  // X keeps 6 decimals; the file has no pretty-printing.
  assert.ok(T.X.flat().every(v => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 1e-6), 'X has at most 6 decimals');
  const raw = read('amir/tips.json');
  assert.ok(!/\n|": |, "/.test(raw), 'tips.json is minified');
  // The skip list only holds tips about fatigue or a whole session.
  assert.ok(T.skip.length > 0 && T.skip.every(i => Number.isInteger(i) && i >= 0 && i < T.tip.length));
  for (const i of T.skip) assert.match(T.tip[i], /fatigu|session|inconsisten|varian|declin|drop/i, 'skip ' + i);
  // validTipTable rejects broken tables.
  for (const bad of [null, {}, { ...T, X: [] }, { ...T, tip: T.tip.slice(1) }, { ...T, scale: [1, 1, 0, 1, 1] },
    { ...T, mean: [1, 2, 3] }, { ...T, k: 0 }, { ...T, skip: 'x' }, { ...T, X: [[1, 2, 3, 4, NaN], ...T.X.slice(1)] }])
    assert.equal(app.validTipTable(bad), false);
});

test('lookup matches the Python _get_tip on >= 99.5% of the reference queries', t => {
  assert.equal(FX.Q.length, FX.ref.length);
  assert.ok(FX.Q.length >= 1000, 'enough queries');
  let same = 0;
  const off = [];
  FX.Q.forEach(([ti, ...v], n) => {
    const type = FX.types[ti], r = FX.ref[n];
    const want = T.shot_type[r] === type ? r : -1;
    const got = app.tipIndex(T, type, ...v);
    if (got === want) same++; else off.push({ n, type, got, want });
  });
  const share = same / FX.Q.length;
  t.diagnostic(`identical: ${same}/${FX.Q.length} (${(100 * share).toFixed(2)}%)`);
  assert.ok(share >= 0.995, `parity ${(100 * share).toFixed(2)}% is below 99.5%`);
  // Any difference must be an exact tie between two tips of the same type.
  for (const o of off) {
    assert.ok(o.got >= 0 && o.want >= 0, 'mismatch is not a tie: ' + JSON.stringify(o));
    assert.equal(T.shot_type[o.got], T.shot_type[o.want]);
    assert.ok(tied(o.type, FX.Q[o.n].slice(1), o.got, o.want), 'mismatch is not a tie: ' + JSON.stringify(o));
  }
  // The only queries of the full 3,000-query set where the JS port and sklearn
  // differ: tips 132 and 196 have the same index row, so either may come first.
  assert.equal(FX.ties.length, 4);
  for (const [ti, ...rest] of FX.ties) {
    const ref = rest.pop(), type = FX.types[ti], got = app.tipIndex(T, type, ...rest);
    assert.equal(T.shot_type[got], type);
    assert.ok(got === ref || tied(type, rest, got, ref), `tie query ${type} ${rest}: app ${got}, Python ${ref}`);
  }
  // The 5 nearest tips match Python's list for firmware-shaped kicks too.
  let lists = 0;
  for (const [type, ...rest] of FX.kicks) {
    const top5 = rest.pop();
    if (!top5.length) continue;
    const lib = app.TIP_TYPES[type], got = app.tipNeighbours(T, lib, ...rest);
    got.forEach((g, i) => assert.ok(g === top5[i] || tied(lib, rest, g, top5[i]),
      `${type} ${rest}: app ${got}, Python ${top5}`));
    lists++;
  }
  assert.ok(lists >= 200, 'checked the 5-nearest lists of firmware-shaped kicks');
});

test('firmware kick types: mapped types get a same-type tip, ground passes and headers get none', () => {
  // Every classification the firmware can send is either mapped or knowingly left out.
  const fw = read('firmware/SpinOff/SpinOff.ino');
  const classes = [...new Set([...fw.matchAll(/strcpy\(kick\.classification,\s*"(\w+)"\)/g)].map(m => m[1]))];
  assert.ok(classes.length >= 6);
  for (const c of classes) assert.ok(c in app.TIP_TYPES || ['ground_pass', 'header'].includes(c), 'firmware type ' + c);
  assert.equal(app.TIP_TYPES.lob_pass, 'chip_shot');

  const kick = (classification, speedMph, spinRPM, launchAngle, strikeQuality) =>
    ({ classification, speedMph, spinRPM, launchAngle, strikeQuality });
  let shown = 0, skipped = 0;
  for (const [type, s, p, an, q, top5] of FX.kicks) {
    const r = app.libraryTipFor(T, kick(type, s, p, an, q));
    const lib = app.TIP_TYPES[type];
    // Expected from Python's 5 nearest: first tip of the mapped type that is not skipped.
    const want = lib ? top5.find(i => T.shot_type[i] === lib && !T.skip.includes(i)) : undefined;
    if (!lib) { assert.equal(r, null, type + ' gets no tip'); continue; }
    if (top5.some(i => T.shot_type[i] === lib && T.skip.includes(i))) skipped++;
    if (want === undefined) { assert.equal(r, null, `${type} ${[s, p, an, q]}`); continue; }
    assert.ok(r, `${type} ${[s, p, an, q]} gets a tip`);
    assert.equal(r.type, lib);
    assert.equal(T.shot_type[r.index], lib, 'tip is written for the same kick type');
    assert.ok(!T.skip.includes(r.index));
    assert.equal(r.tip, T.tip[r.index]);
    if (r.index !== want) assert.ok(tied(lib, [s, p, an, q], r.index, want), 'only an exact tie may differ');
    shown++;
  }
  assert.ok(shown >= 100, 'most mapped kicks get a tip');
  assert.ok(skipped > 0, 'the fixture exercises the skip list');

  // Named cases (also used by the browser test).
  const N = FX.named, pick = n => app.libraryTipFor(T, kick(...N[n].slice(0, 5)));
  assert.equal(pick('ground'), null);
  assert.equal(pick('header'), null);
  assert.equal(pick('lob').type, 'chip_shot');
  assert.equal(pick('skipped').index, N.skipped[5].find(i => T.shot_type[i] === 'curve_ball' && !T.skip.includes(i)));
  assert.ok(T.skip.includes(N.skipped[5][0]), 'the nearest curve tip of "skipped" is a fatigue tip');
  assert.equal(pick('skippedNone'), null);

  // Unknown types and missing numbers give no tip instead of a wrong one.
  assert.equal(app.libraryTipFor(T, kick('spin_shot', 40, 200, 20, 70)), null);
  assert.equal(app.libraryTipFor(T, kick(undefined, 40, 200, 20, 70)), null);
  assert.equal(app.libraryTipFor(T, kick('curve_ball', NaN, 200, 20, 70)), null);
  assert.equal(app.libraryTipFor(T, kick('curve_ball', 40, undefined, 20, 70)), null);
});
