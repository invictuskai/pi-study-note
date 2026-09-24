// Check the built artifact, without fetching external URLs or executing examples.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { base, site } from '../site.config.mjs';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
assert.ok(existsSync(join(dist, 'index.html')), 'Build the site before check:pages');
const prefix = `${base.replace(/\/$/, '')}/`;
const files = [];
const directories = [dist];
while (directories.length) {
  const directory = directories.pop();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) directories.push(fullPath);
    else if (entry.name.endsWith('.html')) files.push(fullPath);
  }
}

const failures = [];
let checked = 0;
for (const file of files) {
  const html = readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  const pagePath = relative(dist, file).replaceAll('\\', '/').replace(/index\.html$/, '');
  const pageUrl = new URL(`${prefix}${pagePath}`, site);
  for (const tag of html.matchAll(/<(?:a|link|img|script|astro-island)\b[^>]*>/gi)) {
    for (const attr of tag[0].matchAll(/\b(?:href|src|data-py-url|component-url|renderer-url)\s*=\s*(["'])(.*?)\1/gi)) {
      const value = attr[2].replaceAll('&amp;', '&');
      if (!value || value.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
      const url = new URL(value, pageUrl);
      if (!url.pathname.startsWith(prefix)) {
        failures.push(`${pagePath}: URL escapes site base: ${value}`);
        continue;
      }
      const target = resolve(dist, decodeURIComponent(url.pathname.slice(prefix.length)));
      if (relative(dist, target).startsWith('..')) {
        failures.push(`${pagePath}: URL escapes artifact: ${value}`);
        continue;
      }
      const exists = existsSync(target) &&
        (statSync(target).isDirectory() ? existsSync(join(target, 'index.html')) : true);
      if (!exists) failures.push(`${pagePath}: missing target: ${value}`);
      checked++;
    }
  }
}
assert.ok(existsSync(join(dist, 'modules/ch01-overview/index.html')), 'Missing overview page');
assert.ok(existsSync(join(dist, 'modules/ch03-agent-loop/python/index.html')), 'Missing Python route');
assert.ok(readFileSync(join(dist, 'modules/ch01-overview/index.html'), 'utf8').includes('id="关键数字"'), 'Missing overview anchor');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Pages artifact OK: ${files.length} pages, ${checked} local links/assets, base ${prefix}`);
}
