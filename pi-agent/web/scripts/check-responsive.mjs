// Real browser regressions for small screens. Run after `npm run build`.
// Uses installed Edge on Windows, Playwright Chromium elsewhere; external fonts are blocked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { base } from '../site.config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'diagrams/manifest.json'), 'utf8'));
const remote = process.argv.find(arg => arg.startsWith('--url='))?.slice(6).replace(/\/$/, '');
const server = remote ? undefined : spawn(process.execPath, [join(root, 'node_modules/astro/astro.js'), 'preview', '--host', '127.0.0.1', '--port', '4343'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  let url = remote;
  if (!url) {
    const origin = await new Promise((resolveReady, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Preview startup timed out')), 15000);
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited: ${code}`)); });
      server.stdout.on('data', chunk => {
        output += chunk.toString();
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+(?=\/|\s|\u001b)/);
        if (match) { clearTimeout(timer); resolveReady(match[0]); }
      });
    });
    url = `${origin}${base}`;
  }
  const origin = new URL(url).origin;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  let pages = 0;
  for (const width of [320, 360, 390, 430, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${url}/`);
    const cards = await page.locator('.toc-row').evaluateAll(rows => rows.map(row => {
      const title = row.querySelector('.toc-title');
      const meta = row.querySelector('.toc-aside');
      return { title: title.textContent, whiteSpace: getComputedStyle(title).whiteSpace, clipped: title.scrollWidth > title.clientWidth + 1 || title.scrollHeight > title.clientHeight + 1, titleBottom: title.getBoundingClientRect().bottom, metaTop: meta.getBoundingClientRect().top };
    }));
    assert.equal(cards.length, 17);
    for (const card of cards) {
      assert.equal(card.whiteSpace, 'normal', `${width}px: truncated title ${card.title}`);
      assert.equal(card.clipped, false, `${width}px: clipped title ${card.title}`);
      assert.ok(card.metaTop >= card.titleBottom - 1, `${width}px: title overlaps metadata`);
    }
    assert.ok(await page.evaluate(w => document.documentElement.scrollWidth <= w + 1, width), `${width}px: home overflows`);
    for (const entry of manifest.coverage) {
      const slug = entry.file.replace('.python.mdx', '/python').replace('.mdx', '');
      const source = readFileSync(join(root, 'src/content/modules', entry.file), 'utf8');
      const expected = (source.match(/^<Diagram\s+file=/gm) ?? []).length;
      assert.equal((await page.goto(`${url}/modules/${slug}/`)).status(), 200, slug);
      await page.waitForFunction(count => document.querySelectorAll('figure.diagram svg.diagram-inline-svg').length === count, expected);
      const metrics = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        figures: [...document.querySelectorAll('figure.diagram')].map(figure => {
          const viewport = figure.querySelector('.diagram-viewport');
          const svg = figure.querySelector('svg');
          const bounds = svg.getBoundingClientRect();
          const box = svg.viewBox.baseVal;
          return { width: bounds.width, container: viewport.clientWidth, scroll: viewport.scrollWidth, ratio: bounds.height / bounds.width, originalRatio: box.height / box.width };
        }),
      }));
      assert.ok(metrics.width <= width + 1, `${width}px ${slug}: page overflows to ${metrics.width}px`);
      for (const figure of metrics.figures) {
        assert.ok(figure.width > 0 && figure.width <= figure.container + 1, `${width}px ${slug}: image does not fit`);
        assert.ok(figure.scroll <= figure.container + 1, `${width}px ${slug}: image needs horizontal scrolling`);
        assert.ok(Math.abs(figure.ratio - figure.originalRatio) < 0.02, `${slug}: image aspect ratio changed`);
      }
      pages++;
    }
    // Touch-operated zoom must work without a mouse wheel, and reopening must reset it.
    await page.goto(`${url}/modules/ch01-overview/`);
    await page.locator('figure.diagram svg').first().waitFor();
    await page.locator('figure.diagram svg').first().tap();
    await page.locator('#diagram-lightbox.is-open').waitFor();
    await page.waitForFunction(() => {
      const img = document.querySelector('#diagram-lightbox .lb-img');
      return img.complete && img.naturalWidth > 0 && img.style.visibility === 'visible';
    });
    const fit = await page.locator('.lb-img').boundingBox();
    await page.getByRole('button', { name: '放大图片', exact: true }).tap();
    await page.waitForFunction(w => document.querySelector('.lb-img').getBoundingClientRect().width > w, fit.width);
    const zoomed = await page.locator('.lb-img').boundingBox();
    assert.ok(zoomed.width > fit.width, `${width}px: zoom button has no effect (${fit.width} -> ${zoomed.width})`);
    assert.ok(await page.locator('.lb-viewport').evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft > 0; }), `${width}px: enlarged image cannot be panned`);
    await page.getByRole('button', { name: '适应屏幕', exact: true }).tap();
    await page.waitForFunction(w => Math.abs(document.querySelector('.lb-img').getBoundingClientRect().width - w) < 1, fit.width);
    const reset = await page.locator('.lb-img').boundingBox();
    assert.ok(Math.abs(reset.width - fit.width) < 1);
    await page.getByRole('button', { name: '关闭', exact: true }).tap();
    await page.locator('#diagram-lightbox').waitFor({ state: 'hidden' });
    if (width < 768) {
      await page.locator('.hamburger').tap();
      assert.ok(await page.locator('.toc-left').isVisible(), 'Mobile contents drawer did not open');
      await page.locator('.hamburger').tap();
      assert.equal(await page.locator('.toc-left').isVisible(), false);
    }
    assert.deepEqual(errors, [], `${width}px: resource or JavaScript failures`);
    await context.close();
    console.log(`PASS ${width}px: home + 27 articles, uncropped text, fitted SVGs and touch zoom`);
  }
  // Desktop keeps the deliberate full-resolution, scrollable diagram layout.
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await desktop.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await desktop.goto(`${url}/modules/pr07-deploy/`);
  await desktop.locator('figure.diagram svg').first().waitFor();
  assert.ok(await desktop.locator('.diagram-viewport').first().evaluate(el => el.scrollWidth > el.clientWidth));
  console.log(`Responsive checks passed: ${pages} mobile/tablet article visits, 5 home layouts, desktop layout retained.`);
} finally {
  if (browser) await browser.close();
  server?.kill();
}
