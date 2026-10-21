// Browser tests for the app extras in NATIONSPIT.html: kick tagging and its
// export contract, AMIR session memory, the progress chart, demo mode, the
// fatigue check, read-aloud and the installable/offline app.
// Run with: bash tests/run.sh
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const H = require('./helpers');

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
async function kick(h, n, o = {}) {
  await h.page.evaluate(t => window.__bleSend(t), H.nestedKick(Object.assign({ number: n, totalKicks: n }, o)));
  await h.page.waitForFunction(n => allKicks.length && allKicks[allKicks.length - 1].number === n, n);
}
const session = (date, maxSpeed, avgSpeed, consistency) => ({ sessionDate: date, kicks: 20, maxSpeed, avgSpeed,
  maxSpin: 210, avgPower: 70, consistency, improvementTrend: 'improving', lastArch: 'power_shot', lastUpdate: date });
const seed = sessions => `localStorage.setItem('spinoffSessionHistory', ${JSON.stringify(JSON.stringify(sessions))});`;
const THREE = [session('2026-10-03T10:00:00Z', 51.4, 40.2, 81), session('2026-09-26T10:00:00Z', 48.9, 38.7, 74),
  session('2026-09-19T10:00:00Z', 44.1, 35.5, 66)];   // newest first, like the app stores them

test('tagging a kick saves it, re-tapping changes the label, and the CSV matches the export contract', async () => {
  const h = await H.openPage(browser, APP);
  await connect(h);
  await kick(h, 1, { classification: 'curve_ball', speedMph: 38.4 });
  await h.page.fill('#tagPlayer', 'Sahil "S", Jr');
  await h.page.click('#tagBtns [data-label="power_shot"]');
  await h.page.click('#tagBtns [data-label="curve_ball"]');   // changes the label, no second record
  await kick(h, 2, { classification: 'chip_shot', speedMph: 22.1, launchAngle: 54 });
  await h.page.click('#tagBtns [data-label="chip_shot"]');
  const recs = await h.page.evaluate(() => JSON.parse(localStorage.getItem('spinoffTaggedKicks')));
  assert.equal(recs.length, 2);
  assert.equal(recs[0].label, 'curve_ball');
  assert.equal(recs[0].firmware_class, 'curve_ball');
  assert.equal(recs[0].speed_mph, 38.4);
  assert.equal(recs[0].is_demo, false);
  assert.equal(recs[0].raw.kick.number, 1, 'raw packet is kept');
  assert.equal(await h.page.getAttribute('#tagBtns [data-label="chip_shot"]', 'aria-pressed'), 'true');

  const [dl] = await Promise.all([h.page.waitForEvent('download'), h.page.click('#tagCsvBtn')]);
  assert.match(dl.suggestedFilename(), /^spinoff-tagged-kicks-.+\.csv$/);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'tagged_at,session_id,player,label,is_demo,kick_number,speed_mph,speed_kmh,spin_rpm,' +
    'spin_clipped,spin_axis,mixed_spin,launch_angle_deg,flight_time_ms,curl_deg,peak_g,g_clipped,contact_ms,' +
    'strike_quality,strike_class,strike_intensity,power_score,firmware_class');
  assert.equal(lines.length, 4, 'header, 2 rows, trailing CRLF');
  assert.ok(lines[1].includes(',"Sahil ""S"", Jr",curve_ball,false,1,38.4,'), lines[1]);
  assert.ok(lines[1].endsWith(',curve_ball'));
  assert.match(await h.page.textContent('#trainCounts'), /2\s*real kicks tagged/);
  noErrors(h);
  await h.context.close();
});

test('a full browser storage shows a message instead of crashing', async () => {
  const h = await H.openPage(browser, APP);
  await connect(h);
  await kick(h, 1);
  await h.page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; });
  await h.page.click('#tagBtns [data-label="power_shot"]');
  assert.match(await h.page.textContent('#alert'), /storage is full/);
  noErrors(h);
  await h.context.close();
});

test('AMIR sees the last saved sessions, and nothing when there are none', async () => {
  const h = await H.openPage(browser, APP, { initScript: seed(THREE) });
  await connect(h);
  await kick(h, 1);
  await h.page.click('.nav-btn[data-page="ai-coach"]');
  await h.page.click('#coachBtn');
  await h.page.waitForFunction(() => !document.getElementById('coachBtn').disabled);
  const prompt = JSON.stringify(h.aiRequests.at(-1).body.messages);
  for (const v of ['51.4', '48.9', '44.1', 'consistency 66']) assert.ok(prompt.includes(v), v);
  assert.ok(prompt.includes('never invent other sessions'));
  assert.ok(prompt.includes('Fatigue check (simple speed rule, not AI)'));
  await h.context.close();

  const h2 = await H.openPage(browser, APP);
  await connect(h2);
  await kick(h2, 1);
  await h2.page.click('.nav-btn[data-page="chat"]');
  await h2.page.fill('#chatInput', 'How am I doing?');
  await h2.page.click('#chatSendBtn');
  await h2.page.waitForFunction(() => !document.getElementById('chatSendBtn').disabled);
  assert.ok(!JSON.stringify(h2.aiRequests.at(-1).body.messages).includes('Past saved sessions'));
  noErrors(h2);
  await h2.context.close();
});

test('progress chart shows one point per saved session, or a hint with fewer than 2', async () => {
  const h = await H.openPage(browser, APP, { initScript: seed(THREE) });
  await h.page.click('.nav-btn[data-page="tracker"]');
  const charted = await h.page.evaluate(() => typeof Chart !== 'undefined');
  if (charted) {
    const pts = await h.page.evaluate(() => progressChart.data.datasets.map(d => d.data));
    assert.deepEqual(pts, [[44.1, 48.9, 51.4], [35.5, 38.7, 40.2], [66, 74, 81]], 'oldest first');
    assert.equal(await h.page.isVisible('#progressBox'), true);
  }
  noErrors(h);
  await h.context.close();

  const h2 = await H.openPage(browser, APP, { initScript: seed(THREE.slice(0, 1)) });
  assert.match(await h2.page.textContent('#progressHint'), /Save one more session/);
  assert.equal(await h2.page.isVisible('#progressBox'), false);
  await h2.context.close();
});

test('demo mode streams realistic kicks inside the ball limits, shows DEMO and never saves', async () => {
  const h = await H.openPage(browser, APP);
  await h.page.click('.nav-btn[data-page="tracker"]');
  await h.page.click('#demoBtn');
  await h.page.waitForFunction(() => allKicks.length >= 3, null, { timeout: 15000 });
  const ks = await h.page.evaluate(() => allKicks.map(k => ({ ...k })));
  for (const k of ks) {
    assert.ok(k.demo, 'flagged as demo');
    assert.ok(k.speedMph >= 5 && k.speedMph <= 70, 'speed ' + k.speedMph);
    assert.ok(k.spinRPM >= 0 && k.spinRPM <= 333, 'spin ' + k.spinRPM);
    assert.ok(k.peakG >= 7 && k.peakG <= 16, 'G ' + k.peakG);
    assert.ok(['power_shot', 'curve_ball', 'chip_shot', 'lob_pass', 'ground_pass', 'header'].includes(k.classification));
  }
  assert.equal(await h.page.isVisible('#tracker .status-text .demo-badge'), true);
  assert.equal(await h.page.textContent('#demoBtn'), 'Stop demo');
  await h.page.click('#tagBtns [data-label="other"]');
  assert.equal(await h.page.evaluate(() => JSON.parse(localStorage.getItem('spinoffTaggedKicks'))[0].is_demo), true);
  await h.page.click('#newSessionBtn');   // stops the demo instead of saving it
  assert.equal(await h.page.evaluate(() => getSessionHistory().length), 0);
  assert.equal(await h.page.evaluate(() => allKicks.length), 0);
  assert.equal(await h.page.isVisible('#tracker .status-text .demo-badge'), false);
  assert.equal(await h.page.textContent('#demoBtn'), 'Try a demo (no ball)');
  noErrors(h);
  await h.context.close();
});

test('godmode kicks are never saved as a session', async () => {
  const h = await H.openPage(browser, APP);
  await h.page.evaluate(() => activateGodmode());
  await h.page.waitForFunction(() => allKicks.length >= 2, null, { timeout: 10000 });
  await h.page.evaluate(() => startNewSession());
  assert.equal(await h.page.evaluate(() => getSessionHistory().length), 0);
  await h.context.close();
});

test('fatigue check: waits for 10 kicks, flags a 10%+ speed drop, and stays quiet when steady', async () => {
  const h = await H.openPage(browser, APP);
  await connect(h);
  const falling = [50, 51, 52, 51, 50, 49, 46, 44, 43, 42, 41, 40];
  for (let i = 0; i < 9; i++) await kick(h, i + 1, { speedMph: falling[i] });
  assert.match(await h.page.textContent('#fatigueText'), /starts after 10 kicks \(9 so far\)/);
  for (let i = 9; i < falling.length; i++) await kick(h, i + 1, { speedMph: falling[i] });
  // best earlier 5-kick stretch 50.8 mph (kicks 1-5); last 5 average 42.0 -> 17% slower
  assert.equal(await h.page.textContent('#fatigueText'),
    'Your last 5 kicks are 17% slower than your best stretch — a short break might help.');
  await h.page.evaluate(() => startNewSession());
  for (let i = 0; i < 12; i++) await kick(h, 100 + i, { speedMph: 45 + (i % 2) });
  assert.equal(await h.page.textContent('#fatigueText'), 'No sign of fatigue (speed is holding steady).');
  noErrors(h);
  await h.context.close();
});

test('read aloud speaks AMIR replies only when switched on', async () => {
  // speechSynthesis is a read-only getter in Chromium, so redefine it.
  const stub = `window.__spoken = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true,
      value: { speak(u) { window.__spoken.push(u.text); }, cancel() {}, getVoices() { return []; } } });`;
  const h = await H.openPage(browser, APP, { initScript: stub });
  h.aiReply = 'Great power. Lock your ankle.';
  await h.page.click('.nav-btn[data-page="chat"]');
  assert.equal(await h.page.isVisible('#chat .speak-row'), true);
  const send = async text => {
    await h.page.fill('#chatInput', text);
    await h.page.click('#chatSendBtn');
    await h.page.waitForFunction(() => !document.getElementById('chatSendBtn').disabled);
  };
  await send('hello');
  assert.deepEqual(await h.page.evaluate(() => window.__spoken), [], 'off by default');
  await h.page.check('#chat .speak-toggle input');
  await send('what drill?');
  assert.deepEqual(await h.page.evaluate(() => window.__spoken), ['Great power. Lock your ankle.']);
  assert.equal(await h.page.isChecked('#ai-coach .speak-toggle input'), true, 'both toggles stay in sync');
  noErrors(h);
  await h.context.close();
});

test('installable: manifest and icons are valid', async () => {
  const m = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.start_url, 'NATIONSPIT.html');
  assert.equal(m.display, 'standalone');
  for (const ic of m.icons) {
    const buf = fs.readFileSync(path.join(H.ROOT, ic.src));
    const [w, hgt] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];   // PNG IHDR
    assert.equal(`${w}x${hgt}`, ic.sizes, ic.src);
  }
});

test('service worker lets the app load offline and never caches AMIR requests', async () => {
  const h = await H.openPage(browser, APP);
  await h.page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !!(r && r.active && r.active.state === 'activated');
  }, null, { timeout: 15000 });
  await h.page.reload({ waitUntil: 'load' });   // now controlled by the service worker
  await h.page.click('.nav-btn[data-page="chat"]');
  await h.page.fill('#chatInput', 'hi');
  await h.page.click('#chatSendBtn');
  await h.page.waitForFunction(() => !document.getElementById('chatSendBtn').disabled);
  const cached = await h.page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  assert.ok(cached.some(u => u.endsWith('/NATIONSPIT.html')), 'app cached');
  assert.ok(!cached.some(u => u.includes(H.WORKER_HOST)), 'AI requests not cached');
  await h.context.setOffline(true);
  await h.page.reload({ waitUntil: 'load' });
  assert.equal(await h.page.textContent('.nav-btn[data-page="tracker"]'), 'Live Tracker');
  await h.page.click('.nav-btn[data-page="chat"]');
  await h.page.fill('#chatInput', 'still there?');
  await h.page.click('#chatSendBtn');
  await h.page.waitForFunction(() => !document.getElementById('chatSendBtn').disabled);
  assert.match(await h.page.textContent('#chatMessages'), /AMIR needs an internet connection/);
  noErrors(h);
  await h.context.close();
});

test('new parts fit on a 360 px phone in dark mode', async () => {
  const h = await H.openPage(browser, APP, { width: 360, theme: 'dark', initScript: seed(THREE) });
  await h.page.click('.nav-btn[data-page="tracker"]');
  await h.page.click('#demoBtn');
  await h.page.waitForFunction(() => allKicks.length >= 1);
  for (const page of ['tracker', 'ai-coach', 'chat']) {
    await h.page.click(`.nav-btn[data-page="${page}"]`);
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth), 360, page);
  }
  noErrors(h);
  await h.context.close();
});
