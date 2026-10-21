// Browser tests for the AMIR tip library in NATIONSPIT.html: one tip from
// amir/tips.json under the latest kick, and in the AI Coach prompt.
// Expected tips come from tests/fixtures/tip_parity.json (the team's Python
// index), not from the app. Run with: bash tests/run.sh
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const H = require('./helpers');

const T = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'amir/tips.json'), 'utf8'));
const FX = require('./fixtures/tip_parity.json');
const LIB = { power_shot: 'power_shot', curve_ball: 'curve_ball', chip_shot: 'chip_shot', lob_pass: 'chip_shot' };

let browser, server, APP;
before(async () => {
  server = await H.startServer();
  browser = await chromium.launch();
  APP = server.origin + '/NATIONSPIT.html';
});
after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
});

const noErrors = h => assert.deepEqual(h.errors, [], 'page errors: ' + h.errors.join(' | '));
async function connect(h) {
  await h.page.click('.nav-btn[data-page="tracker"]');
  await h.page.click('#connectBtn');
  await h.page.waitForFunction(() => document.getElementById('statusText').textContent === 'Connected to Spin Off');
}
// Sends a named fixture kick as a firmware packet and waits until it is counted.
let kickNo = 0;
async function kick(h, name, extra = {}) {
  const [classification, speedMph, spinRPM, launchAngle, strikeQuality] = FX.named[name];
  kickNo++;
  await h.page.evaluate(t => window.__bleSend(t), H.nestedKick(Object.assign({ number: kickNo, totalKicks: kickNo,
    classification, speedMph, spinRPM, rpmClipped: spinRPM >= 333, launchAngle, strikeQuality }, extra)));
  await h.page.waitForFunction(n => allKicks.length && allKicks[allKicks.length - 1].number === n, kickNo);
}
// The tip Python's 5 nearest give for a named kick: the first one written
// for the mapped type that is not on the skip list (null if none).
function expectedTip(name) {
  const [type, , , , , top5] = FX.named[name];
  const i = (top5 || []).find(j => T.shot_type[j] === LIB[type] && !T.skip.includes(j));
  return i === undefined ? null : T.tip[i];
}
const tipState = p => p.evaluate(() => ({
  shown: getComputedStyle(document.getElementById('libTip')).display !== 'none',
  label: document.querySelector('#libTip .lib-tip-label').textContent,
  text: document.getElementById('libTipText').textContent,
  note: document.getElementById('libTipNote').textContent,
}));
async function waitTip(p, want) {
  await p.waitForFunction(w => {
    const shown = getComputedStyle(document.getElementById('libTip')).display !== 'none';
    return w === null ? !shown : shown && document.getElementById('libTipText').textContent === w;
  }, want, { timeout: 4000 }).catch(() => {});
  return tipState(p);
}

test('tip library: a same-type tip after each kick, none for ground passes and headers', async () => {
  const requests = [];   // counted from before the page loads (it starts the download on load)
  const h = await H.openPage(browser, APP, { routes: [['**/amir/tips.json', r => {
    requests.push(r.request().url());
    return r.continue();
  }]] });
  const p = h.page;
  await connect(h);

  await kick(h, 'curve');
  let s = await waitTip(p, expectedTip('curve'));
  assert.ok(expectedTip('curve'));
  assert.ok(s.shown, 'tip shown for a curve ball');
  assert.equal(s.label, "From AMIR's tip library");
  assert.equal(s.text, expectedTip('curve'));
  assert.match(s.note, /^Nearest curve ball tip for this kick's speed, spin, launch angle and strike quality\.$/);
  // It sits in the Latest Kick card, under the kick banner.
  assert.ok(await p.$eval('#libTip', e => e.parentElement.contains(document.getElementById('kickClassName')) &&
    e.previousElementSibling.classList.contains('kick-banner')));

  for (const [name, note] of [['ground', null], ['lob', 'chip shot'], ['header', null], ['power', 'power shot'],
    ['skipped', 'curve ball'], ['skippedNone', null]]) {
    await kick(h, name);
    s = await waitTip(p, expectedTip(name));
    if (note === null) {
      assert.equal(expectedTip(name), null);
      assert.equal(s.shown, false, name + ' gets no tip');
    } else {
      assert.equal(s.shown, true, name + ' gets a tip');
      assert.equal(s.text, expectedTip(name), name);
      assert.ok(s.note.startsWith('Nearest ' + note + ' tip'), name + ': ' + s.note);
    }
  }
  // A new session clears it.
  await kick(h, 'curve');
  assert.equal((await waitTip(p, expectedTip('curve'))).shown, true);
  await p.click('#newSessionBtn');
  assert.equal((await tipState(p)).shown, false, 'new session hides the tip');
  assert.equal(requests.length, 1, 'tips.json is fetched once and cached');
  noErrors(h);
  await h.context.close();
});

test('the AI Coach prompt includes the tip from our tip library', async () => {
  const h = await H.openPage(browser, APP);
  const p = h.page;
  await connect(h);
  await kick(h, 'curve');
  const tip = expectedTip('curve');
  assert.equal((await waitTip(p, tip)).text, tip);
  await p.click('.nav-btn[data-page="ai-coach"]');
  await p.click('#coachBtn');
  await p.waitForFunction(() => document.getElementById('coachResponse').textContent.includes('Nice session'));
  assert.equal(h.aiRequests.length, 1);
  let prompt = h.aiRequests[0].body.messages[1].content;
  assert.ok(prompt.includes('Tip from our tip library: ' + tip + '\n'), prompt);
  assert.ok(prompt.includes('Latest kick: Curve Ball, 45.2 mph, 333 RPM (sensor limit, may be higher), ' +
    '18.4 degree launch angle, strike quality 81/100\n'), prompt);
  assert.match(prompt, /build on the tip from our tip library where it fits/);
  assert.match(prompt, /Max speed: 45\.2 mph/);

  // After a header (no tips) the prompt has no tip, so no stale tip is sent.
  await p.click('.nav-btn[data-page="tracker"]');
  await kick(h, 'header');
  assert.equal((await waitTip(p, null)).shown, false);
  h.aiReply = 'Second reply';
  await p.click('.nav-btn[data-page="ai-coach"]');
  await p.click('#coachBtn');
  await p.waitForFunction(() => document.getElementById('coachResponse').textContent.includes('Second reply'));
  assert.equal(h.aiRequests.length, 2);
  prompt = h.aiRequests[1].body.messages[1].content;
  assert.ok(!/tip library/i.test(prompt), prompt);
  noErrors(h);
  await h.context.close();
});

test('tip text is shown as text, never as HTML', async () => {
  const evil = '<img src=x onerror="window.__xss=1">Kick <b>through</b> & "follow"';
  const i = FX.named.curve[5].find(j => T.shot_type[j] === 'curve_ball' && !T.skip.includes(j));
  const body = JSON.stringify(Object.assign({}, T, { tip: T.tip.map((t, j) => (j === i ? evil : t)) }));
  const h = await H.openPage(browser, APP, { routes: [['**/amir/tips.json', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body })]] });
  const p = h.page;
  await connect(h);
  await kick(h, 'curve');
  const s = await waitTip(p, evil);
  assert.equal(s.text, evil);
  await p.waitForTimeout(200);
  assert.equal(await p.$$eval('#libTip img, #libTip b', e => e.length), 0);
  assert.equal(await p.evaluate(() => window.__xss), undefined);
  noErrors(h);
  await h.context.close();
});

test('the tip hides silently when amir/tips.json cannot load or is broken', async () => {
  const cases = {
    missing: r => r.fulfill({ status: 404, body: 'not found' }),
    offline: r => r.abort(),
    'bad JSON': r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"k":5,"X":[[1,2' }),
    'wrong shape': r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(Object.assign({}, T, { tip: T.tip.slice(0, 10) })) }),
  };
  for (const [name, handler] of Object.entries(cases)) {
    const h = await H.openPage(browser, APP, { routes: [['**/amir/tips.json', handler]] });
    const p = h.page;
    await connect(h);
    await kick(h, 'curve');
    assert.equal(await H.waitText(p, 'speedMph', '45.2'), '45.2', name + ': kick still tracked');
    await p.waitForTimeout(300);
    assert.equal((await tipState(p)).shown, false, name + ': no tip');
    assert.equal(await p.evaluate(() => libraryTipPrompt()), '', name + ': nothing for the prompt');
    noErrors(h);
    await h.context.close();
  }
});

test('the tip hides silently when the app is opened from file://', async () => {
  const h = await H.openPage(browser, 'file://' + path.join(H.ROOT, 'NATIONSPIT.html'), { chart: 'block',
    routes: [[u => u.protocol === 'file:', r => r.continue()]] });
  const p = h.page;
  await connect(h);
  await kick(h, 'curve');
  assert.equal(await H.waitText(p, 'speedMph', '45.2'), '45.2');
  assert.equal(await p.evaluate(async () => await loadTipLibrary()), null);
  assert.equal((await tipState(p)).shown, false);
  noErrors(h);
  await h.context.close();
});

test('a slow tip library never shows a tip for an older kick', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const h = await H.openPage(browser, APP, { routes: [['**/amir/tips.json', async r => {
    await gate;
    await r.continue();
  }]] });
  const p = h.page;
  await connect(h);
  await kick(h, 'curve');          // waits for the table...
  await kick(h, 'header');         // ...and a header comes in first
  release();
  await p.evaluate(() => loadTipLibrary());
  await p.waitForTimeout(200);
  assert.equal((await tipState(p)).shown, false, 'no tip from the earlier curve ball');
  await kick(h, 'curve');
  assert.equal((await waitTip(p, expectedTip('curve'))).shown, true);
  noErrors(h);
  await h.context.close();

  // Same with a new session started while the table is loading.
  let release2;
  const gate2 = new Promise(r => { release2 = r; });
  const h2 = await H.openPage(browser, APP, { routes: [['**/amir/tips.json', async r => {
    await gate2;
    await r.continue();
  }]] });
  await connect(h2);
  await kick(h2, 'curve');
  await h2.page.click('#newSessionBtn');
  release2();
  await h2.page.evaluate(() => loadTipLibrary());
  await h2.page.waitForTimeout(200);
  assert.equal((await tipState(h2.page)).shown, false, 'no tip after a new session');
  noErrors(h2);
  await h2.context.close();
});

test('the tip fits at 360 px (dark) and 1280 px (light)', async () => {
  for (const [width, theme] of [[360, 'dark'], [1280, 'light']]) {
    const h = await H.openPage(browser, APP, { width, theme });
    const p = h.page;
    if (theme === 'dark') await p.click('#themeToggle');
    await connect(h);
    await kick(h, 'skipped');      // one of the longer tips
    assert.equal((await waitTip(p, expectedTip('skipped'))).shown, true);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), width, `${width}px ${theme}`);
    const box = await p.$eval('#libTip', e => e.getBoundingClientRect().toJSON());
    assert.ok(box.left >= 0 && box.right <= width, `tip box inside the page at ${width}px`);
    noErrors(h);
    await h.context.close();
  }
});
