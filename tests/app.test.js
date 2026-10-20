// Browser regression tests for NATIONSPIT.html (the web app) and index.html.
// Run with: bash tests/run.sh   (or: PW=$(npm root -g)/playwright node --test tests/app.test.js)
// The AMIR Worker is stubbed and every outside request except Chart.js is
// blocked, so these tests never reach Groq or the live Worker.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const H = require('./helpers');

let browser, server, APP, SITE;
before(async () => {
  server = await H.startServer();
  browser = await chromium.launch();
  APP = server.origin + '/NATIONSPIT.html';
  SITE = server.origin + '/index.html';
});
after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
});

const noErrors = h => assert.deepEqual(h.errors, [], 'page errors: ' + h.errors.join(' | '));
const send = (h, text, size) => h.page.evaluate(([t, s]) => window.__bleSend(t, s), [text, size]);
async function connect(h) {
  await h.page.click('.nav-btn[data-page="tracker"]');
  await h.page.click('#connectBtn');
  await h.page.waitForFunction(() => document.getElementById('statusText').textContent === 'Connected to Spin Off');
}
async function app(opts) { return H.openPage(browser, APP, opts); }

test('both pages load without page errors', async t => {
  for (const url of [APP, SITE]) {
    const h = await H.openPage(browser, url);
    await h.page.waitForTimeout(200);
    noErrors(h);
    assert.ok((await h.page.title()).length > 0);
    if (url === APP) t.diagnostic('Chart.js loaded: ' + await h.page.evaluate(() => typeof Chart !== 'undefined'));
    await h.context.close();
  }
});

test('app still loads and tracks kicks when Chart.js cannot load', async () => {
  const h = await app({ chart: 'block', width: 360 });
  const p = h.page;
  assert.equal(await p.evaluate(() => typeof Chart), 'undefined');
  await connect(h);
  await send(h, H.nestedKick());
  assert.equal(await H.waitText(p, 'quickKicks', '1'), '1');
  // Unsized chart canvases must not push the page sideways at phone width.
  for (const tab of await p.$$eval('.nav-btn', b => b.map(x => x.dataset.page))) {
    await p.evaluate(t => switchPage(t), tab);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.equal(sw, 360, `no Chart.js, app tab ${tab} at 360px: scrollWidth ${sw}`);
  }
  await p.evaluate(() => switchPage('tracker'));
  await p.click('#newSessionBtn');
  assert.equal(await H.waitText(p, 'quickKicks', '0'), '0');
  noErrors(h);
  await h.context.close();
});

test('BLE connect uses the firmware service and characteristic UUIDs', async () => {
  const src = H.firmwareSource();
  const svc = src.match(/#define SVC_UUID\s+"([^"]+)"/)[1].toLowerCase();
  const chr = src.match(/#define CHR_UUID\s+"([^"]+)"/)[1].toLowerCase();
  const name = src.match(/BLE\.setLocalName\("([^"]+)"\)/)[1];
  const h = await app();
  await connect(h);
  const ble = await h.page.evaluate(() => window.__ble);
  assert.equal(ble.service, svc);
  assert.equal(ble.characteristic, chr);
  assert.ok(ble.requested.filters.some(f => f.name === name), 'filters include the firmware name');
  assert.ok(ble.requested.filters.some(f => (f.services || []).includes(svc)), 'filters include the service');
  assert.equal(await h.page.textContent('#deviceStatusText'), 'Connected');
  await h.page.evaluate(() => window.__bleDevice.gatt.disconnect());
  assert.equal(await h.page.textContent('#deviceStatusText'), 'Disconnected');
  noErrors(h);
  await h.context.close();
});

test('test fixture matches buildKickJson() and the app knows every firmware value', async () => {
  const src = H.firmwareSource();
  const keysIn = (fn, end) => {
    const body = src.slice(src.indexOf(fn), src.indexOf(end, src.indexOf(fn)));
    return [...body.matchAll(/\\"(\w+)\\":/g)].map(m => m[1]);
  };
  assert.deepEqual(H.jsonKeyOrder(H.nestedKick({ recs: ['a'] })), keysIn('String buildKickJson() {', 'return j;'));
  assert.deepEqual(H.jsonKeyOrder(H.nestedBattery(50)), keysIn('void servicePeriodicBattery() {', 'dataChar.writeValue'));

  const classes = [...new Set([...src.matchAll(/strcpy\(kick\.classification,\s*"(\w+)"\)/g)].map(m => m[1]))];
  const bests = [...new Set([...src.matchAll(/strcpy\(whichBest,\s*"(\w+)"\)/g)].map(m => m[1]))];
  assert.ok(classes.length >= 6 && bests.length === 4, 'found firmware classifications and best names');
  const h = await app();
  const known = await h.page.evaluate(() => ({ types: Object.keys(KICK_TYPES), bests: NESTED_BEST_NAMES }));
  for (const c of classes) assert.ok(known.types.includes(c), 'KICK_TYPES has ' + c);
  for (const b of bests) assert.ok(['speed', 'power', 'spin', 'quality'].includes(known.bests[b]), 'best name ' + b);
  await h.context.close();
});

test('nested firmware packet in 160-byte chunks updates the tracker', async () => {
  const h = await app();
  await connect(h);
  const recs = ['Your spin rate is inconsistent - focus on a repeatable foot contact point', 'Kick <b>through</b> the ball & follow "through"'];
  const packet = H.nestedKick({ recs });
  assert.ok(packet.length > 320, 'packet spans several chunks');
  await send(h, packet);
  const p = h.page;
  assert.equal(await H.waitText(p, 'quickKicks', '1'), '1');
  assert.equal(await H.waitText(p, 'quickMaxSpeed', '45.2'), '45.2');
  assert.equal(await H.waitText(p, 'speedMph', '45.2'), '45.2');
  assert.equal(await H.waitText(p, 'spin', '333'), '333');
  assert.equal(await H.waitText(p, 'impact', '16.0'), '16.0');
  assert.equal(await p.textContent('#kickClassName'), 'Curve Ball');
  assert.equal(await p.textContent('#kickIcon'), 'CRV');
  assert.match(await p.textContent('#kickSubInfo'), /Kick #1 .*Sidespin Left/);
  assert.ok(await p.$eval('#spinFlag', e => e.classList.contains('show')), 'spin clipped flag shown');
  assert.ok(await p.$eval('#impactFlag', e => e.classList.contains('show')), 'impact clipped flag shown');
  assert.ok(await p.$eval('#pbBanner', e => e.classList.contains('show')), 'personal best banner shown');
  assert.equal(await p.textContent('#pbBanner'), 'NEW PERSONAL BEST — Speed!');
  assert.equal(await H.waitText(p, 'pbSpeed', '45.2'), '45.2');
  const items = await p.$$eval('#recommendationsList .rec-item span', els => els.map(e => e.textContent));
  assert.deepEqual(items, recs);
  assert.equal(await p.$$eval('#recommendationsList b', els => els.length), 0, 'tip text is escaped');
  assert.equal(await p.textContent('#batteryText'), '85%');
  const state = await p.evaluate(() => ({ kicks: sessionData.kicks, n: allKicks.length,
    chart: charts.speed ? charts.speed.data.datasets[0].data.slice() : null }));
  assert.equal(state.kicks, 1);
  assert.equal(state.n, 1);
  if (state.chart) assert.deepEqual(state.chart, ['45.2']);

  // A second kick with no new best clears the banner and fills the comparison.
  await send(h, H.nestedKick({ number: 2, totalKicks: 2, speedMph: 40, newBest: false, whichBest: '',
    peakG: 12.3, gClipped: false, spinRPM: 210, rpmClipped: false, classification: 'power_shot' }));
  assert.equal(await H.waitText(p, 'quickKicks', '2'), '2');
  assert.equal(await H.waitText(p, 'quickMaxSpeed', '45.2'), '45.2');
  assert.equal(await p.textContent('#kickClassName'), 'Power Shot');
  assert.ok(!(await p.$eval('#pbBanner', e => e.classList.contains('show'))), 'banner cleared');
  assert.ok(!(await p.$eval('#spinFlag', e => e.classList.contains('show'))), 'spin flag cleared');
  assert.match(await p.textContent('#compareLast'), /Power Shot/);
  assert.match(await p.textContent('#comparePrev'), /Curve Ball/);
  noErrors(h);
  await h.context.close();
});

test('flat packet works', async () => {
  const h = await app();
  await connect(h);
  const flat = { n: 3, ts: 999, cls: 'power_shot', pwr: 88, g: 11.2, gClip: false, spd: 52.4, spdK: 84.3,
    ang: 12, flt: 900, curl: 2.5, rpm: 180, rpmF: 175, rpmClip: false, axis: 'topspin', mix: false,
    sq: 90, sc: 'clean', si: 70, ct: 9, sKicks: 3, avgSpd: 48.1, avgPwr: 80, cons: 77, trend: 'improving',
    pkSpd: 52.4, pbSpd: 52.4, pbPwr: 88, pbRpm: 180, pbQ: 90, newBest: true, bestOf: 'power',
    bat: 50, recs: ['Generate more speed - follow through fully and accelerate the kicking leg'] };
  await send(h, JSON.stringify(flat) + '\n');
  const p = h.page;
  assert.equal(await H.waitText(p, 'quickKicks', '3'), '3');
  assert.equal(await H.waitText(p, 'quickMaxSpeed', '52.4'), '52.4');
  assert.equal(await H.waitText(p, 'quickConsistency', '77'), '77');
  assert.equal(await p.textContent('#kickClassName'), 'Power Shot');
  assert.equal(await p.textContent('#pbBanner'), 'NEW PERSONAL BEST — Power Score!');
  assert.equal(await p.textContent('#batteryText'), '50%');
  assert.equal(await p.textContent('#improvementTrend'), 'Improving');
  assert.deepEqual(await p.$$eval('#recommendationsList .rec-item span', els => els.map(e => e.textContent)), flat.recs);
  noErrors(h);
  await h.context.close();
});

test('battery-only packets update the battery and nothing else', async () => {
  const h = await app();
  await connect(h);
  const p = h.page;
  await send(h, H.nestedBattery(64));
  assert.equal(await p.textContent('#batteryText'), '64%');
  await send(h, H.nestedBattery(15));
  assert.equal(await p.textContent('#batteryText'), '15%');
  assert.match(await p.textContent('#alert'), /battery low \(15%\)/);
  await send(h, '{"bat":42}\n');
  assert.equal(await p.textContent('#batteryText'), '42%');
  assert.equal(await p.evaluate(() => sessionData.kicks), 0);
  assert.equal(await p.evaluate(() => allKicks.length), 0);
  assert.equal(await p.textContent('#quickKicks'), '0');
  noErrors(h);
  await h.context.close();
});

test('bad lines are ignored and odd chunk sizes still reassemble', async () => {
  const h = await app();
  await connect(h);
  await send(h, 'garbage {not json\n\n');
  await send(h, H.nestedKick({ number: 1 }) + H.nestedBattery(77), 7);
  assert.equal(await H.waitText(h.page, 'quickKicks', '1'), '1');
  assert.equal(await h.page.textContent('#batteryText'), '77%');
  assert.equal(await h.page.evaluate(() => rxBuffer), '');
  noErrors(h);
  await h.context.close();
});

test('startNewSession saves history and resets the tracker', async () => {
  const h = await app();
  await connect(h);
  const p = h.page;
  await send(h, H.nestedKick({ recs: ['Solid all-round session - keep repeating your technique to lock it in'] }));
  assert.equal(await H.waitText(p, 'quickKicks', '1'), '1');
  await p.click('#newSessionBtn');
  const hist = await p.evaluate(() => JSON.parse(localStorage.getItem('spinoffSessionHistory')));
  assert.equal(hist.length, 1);
  assert.equal(hist[0].kicks, 1);
  assert.equal(hist[0].maxSpeed, '45.2');
  assert.equal(await p.textContent('#savedSessionsCount'), '1');
  assert.match(await p.textContent('#sessionHistory'), /Total kicks:\s*1/);
  assert.equal(await H.waitText(p, 'quickKicks', '0'), '0');
  assert.equal(await p.textContent('#kickClassName'), 'Waiting for kick…');
  assert.equal(await p.$$eval('#recommendationsList .rec-item', e => e.length), 0);
  const s = await p.evaluate(() => ({ kicks: sessionData.kicks, n: allKicks.length,
    chart: charts.speed ? charts.speed.data.datasets[0].data.length : 0 }));
  assert.deepEqual(s, { kicks: 0, n: 0, chart: 0 });
  // An empty session is not saved again.
  await p.click('#newSessionBtn');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('spinoffSessionHistory')).length), 1);
  noErrors(h);
  await h.context.close();
});

test('chat goes to the stubbed proxy with no key and shows the reply as text', async () => {
  const h = await app();
  const p = h.page;
  h.aiReply = 'Try this <img src=x onerror="window.__xss=1"> drill\nLine two';
  await p.click('.nav-btn[data-page="chat"]');
  await p.fill('#chatInput', 'How was my kick?');
  await p.click('#chatSendBtn');
  await p.waitForFunction(() => document.querySelectorAll('#chatMessages .chat-message.ai').length === 2 &&
    !document.getElementById('loadingMessage'));
  assert.equal(h.aiRequests.length, 1);
  const r = h.aiRequests[0];
  assert.equal(r.method, 'POST');
  assert.ok(!('authorization' in r.headers), 'no Authorization header');
  assert.equal(r.body.model, 'openai/gpt-oss-120b');
  assert.equal(r.body.messages[0].role, 'system');
  assert.deepEqual(r.body.messages[r.body.messages.length - 1], { role: 'user', content: 'How was my kick?' });
  const bubbles = await p.$$eval('#chatMessages .chat-message.ai .chat-bubble', els => els.map(e => e.textContent));
  assert.equal(bubbles[1], h.aiReply);
  await p.waitForTimeout(200);
  assert.equal(await p.$$eval('#chatMessages img', e => e.length), 0);
  assert.equal(await p.evaluate(() => window.__xss), undefined);
  assert.equal(await p.evaluate(() => localStorage.getItem('spinoffGroqKey')), null);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('spinoffChatHistory')));
  assert.deepEqual(saved.map(m => m.role), ['user', 'assistant']);
  assert.ok(!h.blocked.some(u => u.includes('groq.com')), 'nothing went to Groq directly');
  noErrors(h);
  await h.context.close();
});

test('AI coach feedback is escaped, and a proxy error is shown safely', async () => {
  const h = await app();
  const p = h.page;
  await connect(h);
  await send(h, H.nestedKick());
  assert.equal(await H.waitText(p, 'quickKicks', '1'), '1');
  h.aiReply = 'Good work <img src=x onerror="window.__xss=1">';
  await p.click('.nav-btn[data-page="ai-coach"]');
  await p.click('#coachBtn');
  await p.waitForFunction(() => document.getElementById('coachResponse').textContent.includes('Good work'));
  assert.equal(await p.textContent('#coachResponse'), h.aiReply);
  assert.match(h.aiRequests[0].body.messages[1].content, /Max speed: 45\.2 mph/);
  h.aiStatus = 500;
  await p.click('#planBtn');
  await p.waitForFunction(() => document.getElementById('trainingPlanContent').textContent.includes('Error'));
  assert.match(await p.textContent('#trainingPlanContent'), /stubbed failure/);
  await p.waitForTimeout(200);
  assert.equal(await p.$$eval('#coachResponse img, #trainingPlanContent img', e => e.length), 0);
  assert.equal(await p.evaluate(() => window.__xss), undefined);
  noErrors(h);
  await h.context.close();
});

test('CSV and JSON exports download the session', async () => {
  const h = await app();
  const p = h.page;
  await connect(h);
  await send(h, H.nestedKick());
  assert.equal(await H.waitText(p, 'quickKicks', '1'), '1');
  const grab = async label => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click(`button:has-text("${label}")`)]);
    return { name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8') };
  };
  const csv = await grab('Export CSV');
  assert.match(csv.name, /^spinoff-session-\d+\.csv$/);
  const lines = csv.text.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^"Kick","Classification","Speed mph"/);
  assert.match(lines[1], /^"1","curve_ball","45.2"/);
  const json = await grab('Export JSON');
  assert.match(json.name, /^spinoff-session-\d+\.json$/);
  const data = JSON.parse(json.text);
  assert.equal(data.kicks.length, 1);
  assert.equal(data.session.kicks, 1);
  noErrors(h);
  await h.context.close();
});

test('theme toggle switches and is remembered', async () => {
  const h = await app();
  const p = h.page;
  assert.equal(await p.getAttribute('html', 'data-theme'), 'light');
  await p.click('#themeToggle');
  assert.equal(await p.getAttribute('html', 'data-theme'), 'dark');
  await p.reload({ waitUntil: 'load' });
  assert.equal(await p.getAttribute('html', 'data-theme'), 'dark');
  noErrors(h);
  await h.context.close();
});

test('godmode easter egg still feeds the tracker', async () => {
  const h = await app();
  const p = h.page;
  await p.click('.nav-btn[data-page="chat"]');
  await p.fill('#chatInput', 'godmode');
  await p.click('#chatSendBtn');
  await p.waitForFunction(() => allKicks.length >= 1, null, { timeout: 5000 });
  assert.ok(await p.$eval('#tracker', e => e.classList.contains('active')));
  assert.equal(h.aiRequests.length, 0, 'godmode needs no AI call');
  noErrors(h);
  await h.context.close();
});

test('How It Works step 1 matches the firmware kick detection', async () => {
  const src = H.firmwareSource();
  const def = name => String(Number(src.match(new RegExp('#define ' + name + '\\s+([\\d.]+)'))[1]));
  const strongG = String(Number(src.match(/capPeakG >= ([\d.]+)f \|\|/)[1]));
  const h = await app();
  const text = await h.page.$eval('#how-it-works .timeline-item:first-child p', e => e.textContent);
  // Numbers and units are joined by a non-breaking space so they never wrap apart.
  const nb = '\u00a0';
  for (const s of [def('KICK_ENTER_G') + nb + 'G', def('DETECT_WINDOW_MS') + nb + 'ms', def('KICK_CONFIRM_G') + nb + 'G',
    strongG + nb + 'G', def('KICK_GYRO_CONFIRM') + nb + '°/s', def('KICK_SETTLE_G') + nb + 'G', 'crossed just once'])
    assert.ok(text.includes(s), 'step 1 mentions ' + JSON.stringify(s));
  assert.ok(!/consecutive frames/.test(text), 'old 3-frame rule is gone');
  await h.context.close();
});

test('no horizontal scroll at 360 px (every app tab, both themes) or at 1280 px', async () => {
  for (const width of [360, 1280]) {
    for (const theme of ['light', 'dark']) {
      const h = await app({ width, theme });
      const p = h.page;
      if (theme === 'dark') await p.click('#themeToggle');
      await connect(h);
      await send(h, H.nestedKick({ recs: ['Launch angle too low for curve shots - aim higher on the ball'] }));
      await H.waitText(p, 'quickKicks', '1');
      for (const tab of await p.$$eval('.nav-btn', b => b.map(x => x.dataset.page))) {
        await p.evaluate(t => switchPage(t), tab);
        const sw = await p.evaluate(() => document.documentElement.scrollWidth);
        assert.equal(sw, width, `app tab ${tab} at ${width}px ${theme}: scrollWidth ${sw}`);
      }
      noErrors(h);
      await h.context.close();
    }
    const s = await H.openPage(browser, SITE, { width });
    await s.page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await s.page.waitForTimeout(100);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth), width, 'index.html at ' + width);
    noErrors(s);
    await s.context.close();
  }
});

test('relative links on both pages resolve', async () => {
  for (const file of ['index.html', 'NATIONSPIT.html']) {
    const html = fs.readFileSync(path.join(H.ROOT, file), 'utf8');
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(m => m[1])
      .filter(u => !/^(https?:|mailto:|data:|javascript:)/.test(u));
    for (const ref of refs) {
      const r = await fetch(new URL(ref, server.origin + '/' + file));
      assert.equal(r.status, 200, `${file} links to ${ref}`);
    }
  }
});
