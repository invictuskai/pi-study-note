// A deterministic vector renderer for reviewed grid diagrams.
// Text stays selectable; every connector is SVG geometry, never a bitmap or a font glyph.
export const CELL = 10;
export const ROW = 30;
const PAD = 28;
const TOP = 74;

const PORTS = {
  '─': 'ew', '━': 'ew', '│': 'ns', '┃': 'ns',
  '┌': 'es', '┐': 'ws', '└': 'en', '┘': 'wn',
  '├': 'nes', '┤': 'nws', '┬': 'ews', '┴': 'ewn', '┼': 'news',
  '┏': 'es', '┓': 'ws', '┗': 'en', '┛': 'wn',
  '┣': 'nes', '┫': 'nws', '┳': 'ews', '┻': 'ewn', '╋': 'news',
  '╭': 'es', '╮': 'ws', '╰': 'en', '╯': 'wn',
  '═': 'ew', '║': 'ns', '╔': 'es', '╗': 'ws', '╚': 'en', '╝': 'wn',
  '╠': 'nes', '╣': 'nws', '╦': 'ews', '╩': 'ewn', '╬': 'news',
};
const ARROWS = {
  '→': 'e', '⇒': 'e', '▶': 'e', '►': 'e',
  '←': 'w', '⇐': 'w', '◀': 'w', '◄': 'w',
  '↓': 's', '▼': 's', '↑': 'n', '▲': 'n', '↔': 'ew',
};
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

export function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function displayWidth(value) {
  let width = 0;
  for (const { segment } of segmenter.segment(value)) {
    if (/^[\p{Mark}\u200d\ufe0f]+$/u.test(segment)) continue;
    if (PORTS[segment] || ARROWS[segment]) { width++; continue; }
    width += /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6\p{Extended_Pictographic}]/u.test(segment) ? 2 : 1;
  }
  return width;
}

export function diagramLayout(source) {
  const lines = source.replace(/\r\n?/g, '\n').replaceAll('\t', '    ').split('\n');
  const labels = [];
  const connectors = [];
  for (const [row, line] of lines.entries()) {
    let column = 0;
    let run = '';
    let start = 0;
    const flush = () => {
      if (run.trim()) {
        const leading = run.length - run.trimStart().length;
        const text = run.trim();
        labels.push({ row, column: start + leading, text, width: displayWidth(text) });
      }
      run = '';
    };
    for (const { segment } of segmenter.segment(line)) {
      const width = displayWidth(segment);
      const caret = segment === '^' && /^\s*\^+\s*$/.test(line);
      if (PORTS[segment] || ARROWS[segment] || caret) {
        flush();
        connectors.push({ row, column, glyph: segment, ports: PORTS[segment], arrow: caret ? 'n' : ARROWS[segment] });
      } else {
        if (!run) start = column;
        run += segment;
      }
      column += width;
    }
    flush();
  }
  // Hand-written box borders can drift by one or two cells with CJK labels.
  // Snap vertical rails to their enclosing corner guide, without reordering labels or rows.
  if (lines.some(line => /[┌┏╔╭].*[┐┓╗╮]/.test(line))) {
    const guides = [...new Set(connectors.filter(c => c.ports && c.ports.length > 1 && !['─', '━', '═', '│', '┃', '║'].includes(c.glyph)).map(c => c.column))];
    for (const connector of connectors) {
      if (!connector.ports?.match(/[ns]/)) continue;
      const guide = guides.filter(column => Math.abs(column - connector.column) <= 2)
        .sort((a, b) => Math.abs(a - connector.column) - Math.abs(b - connector.column))[0];
      if (guide === undefined) continue;
      connector.rail = Math.max(guide, ...connectors.filter(c => c.ports?.match(/[ns]/) && Math.abs(c.column - guide) <= 2).map(c => c.column));
    }
  }
  return { lines, labels, connectors, columns: Math.max(1, ...lines.map(displayWidth)) };
}

function connectorPath(connector) {
  const x = PAD + connector.column * CELL;
  const y = TOP + connector.row * ROW;
  const cx = PAD + (connector.rail ?? connector.column) * CELL + CELL / 2;
  const cy = y + ROW / 2;
  const end = { n: [cx, y], s: [cx, y + ROW], e: [x + CELL, cy], w: [x, cy] };
  if (connector.ports) {
    return [...connector.ports].map(port => `M${cx},${cy} L${end[port].join(',')}`).join(' ');
  }
  const directions = connector.arrow;
  const horizontal = directions.includes('e') || directions.includes('w');
  let path = horizontal ? `M${x},${cy} H${x + CELL}` : `M${cx},${y} V${y + ROW}`;
  for (const direction of directions) {
    const [tx, ty] = end[direction];
    const dx = direction === 'e' ? -4 : direction === 'w' ? 4 : 0;
    const dy = direction === 's' ? -6 : direction === 'n' ? 6 : 0;
    path += horizontal
      ? ` M${tx + dx},${ty - 4} L${tx},${ty} L${tx + dx},${ty + 4}`
      : ` M${tx - 4},${ty + dy} L${tx},${ty} L${tx + 4},${ty + dy}`;
  }
  return path;
}

function renderValidationFlow({ id, caption, source }) {
  const labels = new Map([...source.matchAll(/([A-E])(?:\["([^"]+)"\]|\{"([^"]+)"\})/g)]
    .map(match => [match[1], (match[2] ?? match[3]).split('<br/>')]));
  if (labels.size !== 5) throw new Error('Validation diagram must contain its five original nodes');
  const nodes = [
    { id: 'A', x: 230, y: 85, w: 420, h: 80 },
    { id: 'B', x: 230, y: 225, w: 420, h: 65 },
    { id: 'C', x: 330, y: 345, w: 220, h: 90 },
    { id: 'D', x: 60, y: 500, w: 380, h: 85 },
    { id: 'E', x: 550, y: 500, w: 290, h: 85 },
  ];
  const shapes = nodes.map(node => {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    const shape = node.id === 'C'
      ? `<path d="M${cx},${node.y} L${node.x + node.w},${cy} L${cx},${node.y + node.h} L${node.x},${cy} Z"/>`
      : `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="10"/>`;
    const lines = labels.get(node.id);
    const text = lines.map((line, index) => `<text x="${cx}" y="${cy + (index - (lines.length - 1) / 2) * 24}" stroke="none" fill="#25201d">${escapeXml(line)}</text>`).join('');
    return `<g data-node="${node.id}" fill="#ffffff" stroke="#b5523a">${shape}${text}</g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650" role="img" aria-labelledby="${id}-title">
<title id="${id}-title">${escapeXml(caption)}</title>
<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="#a3543e"/></marker></defs>
<rect x="1" y="1" width="898" height="648" rx="14" fill="#faf7f2" stroke="#d9d0c4"/>
<text x="28" y="40" fill="#43382f" font-family="system-ui, sans-serif" font-size="17" font-weight="600">${escapeXml(caption)}</text>
<g fill="none" stroke="#a3543e" stroke-width="2" marker-end="url(#${id}-arrow)">
<path data-edge="A-B" d="M440,165 V225"/>
<path data-edge="B-C" d="M440,290 V345"/>
<path data-edge="C-D" d="M330,390 H250 V500"/>
<path data-edge="C-E" d="M550,390 H695 V500"/>
<path data-edge="D-A" d="M60,542 H24 V125 H230" stroke-dasharray="6 4"/>
</g>
<g font-family="system-ui, 'Microsoft YaHei', sans-serif" font-size="17" text-anchor="middle" dominant-baseline="central">
${shapes}
<g fill="#733d2c"><text x="280" y="415">不合法</text><text x="610" y="415">合法</text><text x="100" y="105">重试</text></g>
</g></svg>\n`;
}

export function renderDiagram({ id, caption, source, kind }) {
  if (kind === 'validation-flow') return renderValidationFlow({ id, caption, source });
  const layout = diagramLayout(source);
  const titleWidth = displayWidth(caption) * 9;
  const width = Math.max(400, layout.columns * CELL + PAD * 2, titleWidth + PAD * 2);
  const height = TOP + layout.lines.length * ROW + PAD;
  const labels = layout.labels.map(label => {
    const x = PAD + label.column * CELL;
    const y = TOP + label.row * ROW + ROW / 2;
    return `<text data-row="${label.row}" data-column="${label.column}" x="${x}" y="${y}" textLength="${label.width * CELL}" lengthAdjust="spacingAndGlyphs" style="white-space:pre">${escapeXml(label.text)}</text>`;
  }).join('\n');
  const paths = layout.connectors.map(connector =>
    `<path data-row="${connector.row}" data-column="${connector.column}" data-glyph="${escapeXml(connector.glyph)}" d="${connectorPath(connector)}"/>`,
  ).join('\n');
  const description = layout.labels.map(label => label.text.trim()).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-description">
<title id="${id}-title">${escapeXml(caption)}</title>
<desc id="${id}-description">${escapeXml(description)}</desc>
<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="14" fill="#faf7f2" stroke="#d9d0c4"/>
<rect x="${PAD}" y="24" width="4" height="22" rx="2" fill="#b5523a"/>
<text x="${PAD + 14}" y="41" fill="#43382f" font-family="system-ui, 'Microsoft YaHei', sans-serif" font-size="16" font-weight="600">${escapeXml(caption)}</text>
<path d="M${PAD},58 H${width - PAD}" stroke="#e4ddd4"/>
<g class="diagram-connectors" stroke="#a3543e" stroke-width="1.7" stroke-linecap="butt" stroke-linejoin="round" fill="none">
${paths}
</g>
<g class="diagram-labels" font-family="'Cascadia Mono', 'Consolas', 'Microsoft YaHei', monospace" font-size="16" fill="#25201d" dominant-baseline="central" xml:space="preserve">
${labels}
</g>
</svg>
`;
}
