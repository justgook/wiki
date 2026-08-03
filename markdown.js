function isTableDelimiter(line) {
  let value = line.trim();
  if (!value.includes('|')) return false;
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').every(cell => /^\s*:?-+:?\s*$/.test(cell));
}

function protectWikilinks(line) {
  let output = '';
  let cursor = 0;

  while (cursor < line.length) {
    if (line.startsWith('[[', cursor)) {
      const end = line.indexOf(']]', cursor + 2);
      if (end !== -1) {
        const content = line.slice(cursor + 2, end);
        const separator = content.indexOf('|');
        if (separator > 0 && separator < content.length - 1) {
          output += `[[${content.replace(/(?<!\\)\|/g, '\\|')}]]`;
          cursor = end + 2;
          continue;
        }
      }
    }

    output += line[cursor];
    cursor += 1;
  }

  return output;
}

export function prepareMarkdown(markdown) {
  const lines = markdown.split('\n');

  for (let delimiter = 1; delimiter < lines.length; delimiter += 1) {
    if (!isTableDelimiter(lines[delimiter])) continue;

    lines[delimiter - 1] = protectWikilinks(lines[delimiter - 1]);
    for (let row = delimiter + 1; row < lines.length && lines[row].trim(); row += 1) {
      lines[row] = protectWikilinks(lines[row]);
    }
  }

  return lines.join('\n');
}

export function tokenizeWikilink(source) {
  const match = /^\[\[((?:(?!\\?\|)[^\]\n])+)(?:\\?\|([^\]\n]+))?\]\]/.exec(source);
  if (!match) return undefined;

  return {
    type: 'wikilink',
    raw: match[0],
    target: match[1].trim(),
    label: (match[2] || match[1]).replace(/\\\|/g, '|').trim(),
  };
}
