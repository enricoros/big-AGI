/**
 * @fileoverview Utility functions for Markdown.
 */

/**
 * Quick and dirty conversion of HTML tables to Markdown tables.
 * Big plus: doesn't require any dependencies.
 */
export function htmlTableToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return '';

  const markdownRows: string[] = [];
  const headerCells = table.querySelectorAll('thead th');
  if (headerCells.length > 0) {
    const headerRow = '| ' + Array.from(headerCells)
      .map(cell => cell.textContent?.trim() || '')
      .join(' | ') + '| ';
    markdownRows.push(headerRow);
    markdownRows.push('|:' + Array(headerCells.length).fill('-').join('|:') + '|');
  }

  const bodyRows = table.querySelectorAll('tbody tr');
  for (const row of Array.from(bodyRows)) {
    const rowCells = row.querySelectorAll('td');
    const markdownRow = '| ' + Array.from(rowCells)
      .map(cell => cell.textContent?.trim() || '')
      .join(' | ') + ' |';
    markdownRows.push(markdownRow);
  }

  return markdownRows.join('\n');
}