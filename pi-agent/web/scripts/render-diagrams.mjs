import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDiagram } from './lib/diagram-svg.mjs';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const book = dirname(web);
const manifest = JSON.parse(readFileSync(join(web, 'diagrams/manifest.json'), 'utf8'));
const check = process.argv.includes('--check');
let outputs = 0;
for (const diagram of manifest.diagrams) {
  assert.match(diagram.id, /^[a-z0-9-]+$/);
  assert.equal(createHash('sha256').update(diagram.source).digest('hex'), diagram.sourceSha256, `${diagram.id}: source changed`);
  const svg = renderDiagram(diagram);
  const targets = new Set([join(web, 'public/assets/diagrams', `${diagram.id}.svg`)]);
  for (const occurrence of diagram.occurrences) {
    assert.ok(!occurrence.markdown.includes('..') && !occurrence.markdown.startsWith('/'));
    targets.add(join(book, dirname(occurrence.markdown), 'assets/diagrams', `${diagram.id}.svg`));
  }
  for (const target of targets) {
    if (check) {
      assert.ok(existsSync(target), `Missing diagram: ${target}`);
      assert.equal(readFileSync(target, 'utf8').replace(/\r\n?/g, '\n'), svg, `Stale diagram: ${target}`);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, svg);
    }
    outputs++;
  }
}
console.log(`${check ? 'Checked' : 'Rendered'} ${manifest.diagrams.length} vector diagrams / ${outputs} web and Markdown assets.`);
