import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const targets = [
  { name: 'index', path: '/index.html' },
  { name: 'player', path: '/hoja_personaje.html' },
  { name: 'dm-screen', path: '/pantalla_dm.html' },
  { name: 'dm-on-game', path: '/hoja_de_DM.html' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let failed = false;
const summary = [];

for (const target of targets) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const vttRequests = [];
  const vttInitiators = [];

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', event => {
    const url = event?.request?.url || '';
    if (/\/vtt\.html(?:$|[?#])|\/js\/vtt\//i.test(url)) {
      vttInitiators.push({ url, initiator: event.initiator || null });
    }
  });

  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', request => {
    const url = request.url();
    if (/\/vtt\.html(?:$|[?#])|\/js\/vtt\//i.test(url)) vttRequests.push(url);
  });

  let navError = null;
  let metrics = null;
  try {
    await page.goto(base + target.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);
    metrics = await page.evaluate(async () => {
      const readyState = document.readyState;
      const bodyPresent = !!document.body;
      const scriptSrcs = [...document.scripts].map(s => s.src).filter(Boolean);
      const iframeSrcs = [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src') || f.getAttribute('data-vtt-src') || '');
      const start = performance.now();
      const timerDelayMs = await new Promise(resolve => setTimeout(() => resolve(performance.now() - start), 75));
      const rafStart = performance.now();
      const rafDelayMs = await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - rafStart))));
      return {
        readyState,
        bodyPresent,
        title: document.title,
        timerDelayMs,
        rafDelayMs,
        iframeSrcs,
        hasVttScript: scriptSrcs.some(src => /\/js\/vtt\//i.test(src)),
        hasVttIframe: iframeSrcs.some(src => /vtt\.html/i.test(src)),
      };
    });
  } catch (error) {
    navError = String(error?.stack || error);
  }

  const hardConsoleErrors = consoleErrors.filter(text => !/favicon|ERR_BLOCKED_BY_CLIENT/i.test(text));
  const frozen = metrics && (metrics.timerDelayMs > 1500 || metrics.rafDelayMs > 1500);
  const vttLeak = vttRequests.length > 0 || metrics?.hasVttScript || metrics?.hasVttIframe;
  const targetFailed = !!navError || pageErrors.length > 0 || frozen || (target.name === 'dm-on-game' && vttLeak);
  if (targetFailed) failed = true;

  summary.push({
    target: target.name,
    url: base + target.path,
    navError,
    pageErrors,
    consoleErrors: hardConsoleErrors.slice(0, 20),
    vttRequests,
    vttInitiators,
    metrics,
    failed: targetFailed,
  });

  await cdp.detach();
  await page.close();
}

console.log(JSON.stringify(summary, null, 2));
await browser.close();
if (failed) process.exit(1);
