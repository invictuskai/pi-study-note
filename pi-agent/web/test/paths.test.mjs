import assert from 'node:assert/strict';
import test from 'node:test';
import { withBase } from '../src/utils/paths.ts';
import remarkBasePath from '../src/utils/remark-base-path.ts';

for (const base of ['/pi-study-note', '/pi-study-note/']) {
  test(`prefixes links and assets under ${base}`, () => {
    assert.equal(withBase('/', base), '/pi-study-note/');
    assert.equal(withBase('/modules/ch01-overview/#关键数字', base), '/pi-study-note/modules/ch01-overview/#关键数字');
    assert.equal(withBase('/modules/ch03-agent-loop/python/', base), '/pi-study-note/modules/ch03-agent-loop/python/');
    assert.equal(withBase('/assets/diagram.svg?raw=1', base), '/pi-study-note/assets/diagram.svg?raw=1');
    assert.equal(withBase('/js/diagram-linker.js', base), '/pi-study-note/js/diagram-linker.js');
  });
}

test('is idempotent and respects path boundaries', () => {
  for (const url of ['/pi-study-note', '/pi-study-note/', '/pi-study-note/assets/a.svg', '/pi-study-note?x=1', '/pi-study-note#top']) {
    assert.equal(withBase(url, '/pi-study-note'), url);
  }
  assert.equal(withBase('/pi-study-note-other/', '/pi-study-note'), '/pi-study-note/pi-study-note-other/');
});

test('root deployment and non-root-relative URLs stay unchanged', () => {
  assert.equal(withBase('/modules/ch01-overview/', '/'), '/modules/ch01-overview/');
  for (const url of ['https://github.com/earendil-works/pi', '//example.com/a.svg', '#关键数字', '?q=1', '../chapter/', 'mailto:author@example.com', 'data:image/svg+xml,test', '']) {
    assert.equal(withBase(url, '/pi-study-note'), url);
  }
});

test('Markdown links, images and reference definitions are rewritten, code is untouched', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'paragraph', children: [
        { type: 'link', url: '/modules/pr01-env-setup/', children: [{ type: 'text', value: 'Start' }] },
        { type: 'image', url: '/assets/a.svg', alt: 'diagram' },
        { type: 'link', url: 'https://example.com/', children: [] },
      ] },
      { type: 'definition', identifier: 'intro', url: '/modules/ch01-overview/' },
      { type: 'code', lang: 'js', value: 'fetch("/chat")' },
    ],
  };
  remarkBasePath({ base: '/pi-study-note' })(tree);
  assert.equal(tree.children[0].children[0].url, '/pi-study-note/modules/pr01-env-setup/');
  assert.equal(tree.children[0].children[1].url, '/pi-study-note/assets/a.svg');
  assert.equal(tree.children[0].children[2].url, 'https://example.com/');
  assert.equal(tree.children[1].url, '/pi-study-note/modules/ch01-overview/');
  assert.equal(tree.children[2].value, 'fetch("/chat")');
});
