export function escapeCsvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCsv(rows: Array<Array<string | number>>) {
  return `\uFEFF${rows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n')}`;
}
