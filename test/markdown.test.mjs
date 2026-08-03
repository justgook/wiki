import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { prepareMarkdown, tokenizeWikilink } from '../markdown.js';

const require = createRequire(import.meta.url);
const marked = require('../vendor/marked.min.js');

marked.use({
  extensions: [{
    name: 'wikilink',
    level: 'inline',
    start(source) { return source.indexOf('[['); },
    tokenizer: tokenizeWikilink,
    renderer(token) {
      return `<a data-target="${token.target}">${token.label}</a>`;
    },
  }],
});

test('renders an aliased wiki link as one table cell', () => {
  const markdown = [
    '| Mission |',
    '| --- |',
    '| [[Missions/Lift the Governor|Lift the Governor]], |',
  ].join('\n');

  const html = marked.parse(prepareMarkdown(markdown));

  assert.equal((html.match(/<td>/g) || []).length, 1);
  assert.match(html, /<td><a data-target="Missions\/Lift the Governor">Lift the Governor<\/a>,<\/td>/);
});

test('leaves wiki-link examples in table code spans unchanged', () => {
  const markdown = [
    '| Syntax |',
    '| --- |',
    '| `[[target|label]]` |',
  ].join('\n');

  const html = marked.parse(prepareMarkdown(markdown));

  assert.match(html, /<code>\[\[target\|label\]\]<\/code>/);
});

test('does not rewrite wiki links outside tables', () => {
  const markdown = 'See [[Missions/Lift the Governor|Lift the Governor]].';
  assert.equal(prepareMarkdown(markdown), markdown);
});
