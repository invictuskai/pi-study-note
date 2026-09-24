import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { diagramLayout, displayWidth, escapeXml, renderDiagram } from '../scripts/lib/diagram-svg.mjs';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const book = dirname(web);
const manifest = JSON.parse(readFileSync(join(web, 'diagrams/manifest.json'), 'utf8'));

test('display cells preserve CJK, emoji and combining characters', () => {
  assert.equal(displayWidth('中文A'), 5);
  assert.equal(displayWidth('e\u0301'), 1);
  assert.equal(displayWidth('\u{1f4e1}'), 2);
  assert.equal(displayWidth('│→←↓↑'), 5);
});

test('tree branches, indentation and arrows retain their original positions', () => {
  const layout = diagramLayout('root\n├── A\n│   └── 子节点\n└── B → C');
  assert.deepEqual(layout.labels.map(({ row, column, text }) => [row, column, text]), [
    [0, 0, 'root'], [1, 4, 'A'], [2, 8, '子节点'], [3, 4, 'B'], [3, 8, 'C'],
  ]);
  assert.equal(layout.connectors.find(c => c.glyph === '├').ports, 'nes');
  assert.equal(layout.connectors.find(c => c.glyph === '→').arrow, 'e');
});

test('all grid diagrams round-trip every label, connector and row without semantic loss', () => {
  for (const diagram of manifest.diagrams.filter(d => d.kind === 'grid')) {
    const layout = diagramLayout(diagram.source);
    const reconstructed = layout.lines.map((_line, row) => {
      const parts = [
        ...layout.labels.filter(label => label.row === row),
        ...layout.connectors.filter(edge => edge.row === row).map(edge => ({ column: edge.column, text: edge.glyph })),
      ].sort((a, b) => a.column - b.column);
      let line = '';
      for (const part of parts) {
        line += ' '.repeat(part.column - displayWidth(line)) + part.text;
      }
      return line;
    });
    assert.deepEqual(reconstructed, layout.lines.map(line => line.trimEnd()), diagram.id);
    const svg = renderDiagram(diagram);
    assert.doesNotMatch(svg, /<(?:image|foreignObject|script)\b/i, diagram.id);
    for (const label of layout.labels) assert.ok(svg.includes(`>${escapeXml(label.text)}</text>`), `${diagram.id}: ${label.text}`);
    assert.equal((svg.match(/data-glyph=/g) ?? []).length, layout.connectors.length, diagram.id);
  }
});

test('the Mermaid validation flow retains both decision branches and the retry edge', () => {
  const flow = manifest.diagrams.find(d => d.kind === 'validation-flow');
  assert.ok(flow);
  const svg = renderDiagram(flow);
  for (const edge of ['A-B', 'B-C', 'C-D', 'D-A', 'C-E']) assert.ok(svg.includes(`data-edge="${edge}"`));
  for (const node of ['A', 'B', 'C', 'D', 'E']) assert.ok(svg.includes(`data-node="${node}"`));
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, /不合法/);
  assert.match(svg, /重试/);
});

test('all 27 chapters are covered and every converted occurrence has a web and Markdown image', () => {
  assert.equal(manifest.coverage.length, 27);
  assert.equal(manifest.coverage.reduce((sum, c) => sum + c.converted, 0), 156);
  for (const coverage of manifest.coverage) {
    const text = readFileSync(join(web, 'src/content/modules', coverage.file), 'utf8');
    assert.equal((text.match(/file="\/assets\/diagrams\//g) ?? []).length, coverage.converted, coverage.file);
  }
  for (const diagram of manifest.diagrams) {
    assert.ok(existsSync(join(web, 'public/assets/diagrams', `${diagram.id}.svg`)), diagram.id);
    for (const occurrence of diagram.occurrences) {
      const markdown = readFileSync(join(book, occurrence.markdown), 'utf8');
      assert.ok(markdown.includes(`](assets/diagrams/${diagram.id}.svg)`), occurrence.markdown);
    }
  }
});

test('no unreviewed character diagram or raw Mermaid block remains in the ebook', () => {
  const retained = new Set(manifest.retained.map(entry => `${entry.file}:${entry.sourceSha256}`));
  const dir = join(web, 'src/content/modules');
  for (const file of readdirSync(dir).filter(f => f.endsWith('.mdx'))) {
    const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    for (const match of text.matchAll(/^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm)) {
      const language = match[1].trim();
      assert.notEqual(language, 'mermaid', file);
      if (!['', 'text', 'plaintext', 'ascii', 'tree'].includes(language)) continue;
      const source = match[2].trimEnd();
      if (!/[┌┐└┘├┤┬┴┼│─━┃╔╗╚╝║═↑↓←→↔⇒⇐]/.test(source)) continue;
      const hash = createHash('sha256').update(source).digest('hex');
      assert.ok(retained.has(`${file}:${hash}`), `${file}: unconverted diagram`);
    }
  }
});

test('all diagram strings are XML escaped and author promotion is absent from the page component', () => {
  const svg = renderDiagram({ id: 'escape', caption: 'A & B', source: '<script> & "test" → safe' });
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.doesNotMatch(svg, /<script>/);
  const topBar = readFileSync(join(web, 'src/components/TopBar.astro'), 'utf8');
  assert.doesNotMatch(topBar, /author-menu|author-card|donghua|douyin|bilibili|buchidonggua|冬瓜/);
  assert.ok(topBar.includes('<ThemeToggle />'));
  assert.ok(topBar.includes('data-immersive-toggle'));
  assert.ok(topBar.includes('class="hamburger"'));
});
