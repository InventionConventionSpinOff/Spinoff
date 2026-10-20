// Shared helpers for the Spin Off regression tests.
// No dependencies beyond Node and Playwright: a tiny static server for the
// repo root, a fake Web Bluetooth device, a stubbed AMIR Worker and packet
// builders that mirror buildKickJson() in firmware/SpinOff/SpinOff.ino.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKER_HOST = 'spinoff-ai.minecraftboy1331.workers.dev';
const CHART_HOST = 'cdnjs.cloudflare.com';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Serves the repo root on a random free port. Resolves to {origin, close()}.
function startServer() {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400); return res.end(); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(r => server.close(r)),
  })));
}

// Fake navigator.bluetooth. window.__bleSend(text) splits text into 160-byte
// notifications (BLE_CHUNK_SIZE in the firmware) and fires them at whatever
// listener the app registered, which is handleData().
const FAKE_BLE = `(() => {
  const ble = window.__ble = { listeners: [], requested: null, service: null, characteristic: null };
  const ch = {
    value: null,
    async startNotifications() { return ch; },
    addEventListener(t, f) { if (t === 'characteristicvaluechanged') ble.listeners.push(f); },
    removeEventListener() {},
  };
  const dev = {
    name: 'SpinOff', _dl: [],
    addEventListener(t, f) { if (t === 'gattserverdisconnected') dev._dl.push(f); },
    gatt: {
      connected: false,
      async connect() {
        dev.gatt.connected = true;
        return { async getPrimaryService(u) { ble.service = u;
          return { async getCharacteristic(c) { ble.characteristic = c; return ch; } }; } };
      },
      disconnect() { dev.gatt.connected = false; dev._dl.forEach(f => f()); },
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { configurable: true,
    value: { async requestDevice(opts) { ble.requested = opts; return dev; } } });
  window.__bleDevice = dev;
  window.__bleSend = (text, size = 160) => {
    const bytes = new TextEncoder().encode(text);
    for (let i = 0; i < bytes.length; i += size) {
      ch.value = new DataView(bytes.slice(i, i + size).buffer);
      ble.listeners.forEach(f => f({ target: ch }));
    }
  };
})();`;

let chartCache = null;   // Chart.js body, fetched once per run if reachable

// Opens a page with the Worker stubbed and every other outside request
// blocked, except Chart.js (fetched from cdnjs when reachable, unless
// opts.chart === 'block'). Returns handles the tests inspect.
async function openPage(browser, url, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: opts.width || 1280, height: opts.height || 900 },
    colorScheme: opts.theme === 'dark' ? 'dark' : 'light',
    acceptDownloads: true,
  });
  const h = {
    context, errors: [], aiRequests: [], blocked: [],
    aiReply: 'Nice session! Keep your plant foot steady.', aiStatus: 200,
  };
  if (opts.fakeBle !== false) await context.addInitScript(FAKE_BLE);
  if (opts.initScript) await context.addInitScript(opts.initScript);
  await context.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (url.startsWith(u.origin + '/')) return route.continue();
    if (u.hostname === WORKER_HOST) {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      let body = null;
      try { body = JSON.parse(req.postData() || 'null'); } catch {}
      h.aiRequests.push({ url: req.url(), method: req.method(), headers: await req.allHeaders(), body });
      const reply = h.aiStatus === 200
        ? { choices: [{ message: { role: 'assistant', content: h.aiReply } }] }
        : { error: { message: 'stubbed failure' } };
      return route.fulfill({ status: h.aiStatus, headers: cors, contentType: 'application/json', body: JSON.stringify(reply) });
    }
    if (u.hostname === CHART_HOST && opts.chart !== 'block') {
      if (!chartCache) {
        try {
          const r = await route.fetch({ timeout: 15000 });
          if (r.ok()) chartCache = { body: await r.body() };
        } catch {}
      }
      if (chartCache) return route.fulfill({ status: 200, body: chartCache.body,
        headers: { 'content-type': 'application/javascript; charset=utf-8', 'access-control-allow-origin': '*' } });
    }
    h.blocked.push(req.url());
    return route.abort();
  });
  const page = h.page = await context.newPage();
  page.on('pageerror', e => h.errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(url, { waitUntil: 'load' });
  return h;
}

// Text of an element once its animated value has settled on `want`.
// animateValue() writes intermediate numbers for 600 ms and sets dataset.v
// when it finishes, so wait for both (a running animation would otherwise
// overwrite anything the test does next).
async function waitText(page, id, want, timeout = 4000) {
  await page.waitForFunction(([i, w]) => {
    const e = document.getElementById(i);
    return e && e.textContent.trim() === w && (e.dataset.v === undefined || Number(e.dataset.v) === Number(w));
  }, [id, want], { timeout }).catch(() => {});
  return page.$eval('#' + id, e => e.textContent.trim());
}

// ---- Packet builders --------------------------------------------------------
// nestedKick() returns the exact text buildKickJson() produces (same key
// order, one-decimal floats via f1()), plus the trailing newline the firmware
// adds before sending.
const f1 = v => Number(v).toFixed(1);
function nestedKick(o = {}) {
  const k = Object.assign({
    number: 1, timestamp: 123456, classification: 'curve_ball', powerScore: 72,
    peakG: 16.0, gClipped: true,
    speedMph: 45.2, speedKmh: 72.7, launchAngle: 18.4, flightTimeMs: 1250, curlDegrees: 7.5,
    spinRPM: 333, rpmClipped: true, spinAxis: 'sidespin_left', mixedSpin: false,
    strikeQuality: 81, strikeClass: 'clean', strikeIntensity: 64, contactMs: 11,
    totalKicks: 1, consistency: 0, avgSpeed: 45.2, avgPower: 72, trend: 'plateau',
    pbSpeed: 45.2, pbPower: 72, pbSpin: 333, pbQuality: 81, newBest: true, whichBest: 'speedMph',
    battery: 85, lowBattery: false, recs: [],
  }, o);
  const s = x => '"' + String(x).replace(/["\\]/g, '\\$&') + '"';
  const b = x => (x ? 'true' : 'false');
  return '{"kick":{"number":' + k.number + ',"timestamp":' + k.timestamp +
    ',"classification":' + s(k.classification) + ',"powerScore":' + k.powerScore + '},' +
    '"impact":{"peakG":' + f1(k.peakG) + ',"clipped":' + b(k.gClipped) + '},' +
    '"motion":{"speedMph":' + f1(k.speedMph) + ',"speedKmh":' + f1(k.speedKmh) +
    ',"launchAngle":' + f1(k.launchAngle) + ',"flightTimeMs":' + Math.round(k.flightTimeMs) +
    ',"curlDegrees":' + f1(k.curlDegrees) + '},' +
    '"spin":{"rateRPM":' + Math.round(k.spinRPM) + ',"clipped":' + b(k.rpmClipped) +
    ',"axis":' + s(k.spinAxis) + ',"mixedSpin":' + b(k.mixedSpin) + '},' +
    '"strike":{"quality":' + k.strikeQuality + ',"classification":' + s(k.strikeClass) +
    ',"intensity":' + k.strikeIntensity + ',"contactMs":' + k.contactMs + '},' +
    '"session":{"totalKicks":' + k.totalKicks + ',"consistencyScore":' + k.consistency +
    ',"avgSpeedMph":' + f1(k.avgSpeed) + ',"avgPowerScore":' + Math.round(k.avgPower) +
    ',"improvementTrend":' + s(k.trend) + '},' +
    '"personalBests":{"speedMph":' + f1(k.pbSpeed) + ',"powerScore":' + Math.round(k.pbPower) +
    ',"spinRPM":' + Math.round(k.pbSpin) + ',"strikeQuality":' + Math.round(k.pbQuality) +
    ',"newBestBroken":' + b(k.newBest) + ',"whichBest":' + s(k.whichBest) + '},' +
    '"battery":{"percentage":' + k.battery + ',"lowBattery":' + b(k.lowBattery) + '},' +
    '"recommendations":[' + k.recs.map(s).join(',') + ']}\n';
}
// What servicePeriodicBattery() sends.
const nestedBattery = (pct, low = pct <= 20) =>
  '{"battery":{"percentage":' + pct + ',"lowBattery":' + (low ? 'true' : 'false') + '}}\n';

// Keys, in order, that a JSON text uses (depth first), for contract checks.
function jsonKeyOrder(text) {
  const out = [];
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.keys(v).forEach(key => { out.push(key); walk(v[key]); });
  })(JSON.parse(text));
  return out;
}

const firmwareSource = () => fs.readFileSync(path.join(ROOT, 'firmware/SpinOff/SpinOff.ino'), 'utf8');

module.exports = { ROOT, WORKER_HOST, startServer, openPage, waitText, nestedKick, nestedBattery,
  jsonKeyOrder, firmwareSource };
