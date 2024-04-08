/**
 * @fileoverview Utility functions for Markdown.
 */

import { isBrowser } from '~/common/util/pwaUtils';

/**
 * Quick and dirty conversion of HTML tables to Markdown tables.
 * Big plus: doesn't require any dependencies.
 */
export function htmlTableToMarkdown(html: string, includeInvisible: boolean): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return '';

  const markdownRows: string[] = [];
  const headerCells = table.querySelectorAll('thead th');
  if (headerCells.length > 0) {
    const headerRow = '| ' + Array.from(headerCells)
      .map(cell => getTextWithSpaces(cell, includeInvisible).trim())
      .join(' | ') + ' |';
    markdownRows.push(headerRow);
    markdownRows.push('|:' + Array(headerCells.length).fill('---').join('|:') + '|');
  }

  const bodyRows = table.querySelectorAll('tbody tr');
  for (const row of Array.from(bodyRows)) {
    const rowCells = row.querySelectorAll('td');
    const markdownRow = '| ' + Array.from(rowCells)
      .map(cell => getTextWithSpaces(cell, includeInvisible).trim())
      .join(' | ') + ' |';
    markdownRows.push(markdownRow);
  }

  return markdownRows.join('\n');
}

// Helper function to get text with spaces, ignoring hidden elements
function getTextWithSpaces(node: Node, includeInvisible: boolean): string {
  let text = '';
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE)
      text += child.textContent;
    else if (child.nodeType === Node.ELEMENT_NODE)
      if (includeInvisible || isVisible(child as Element))
        text += ' ' + getTextWithSpaces(child, includeInvisible) + ' ';
  });
  return text;
}

// Helper function to determine if an element is visible
function isVisible(element: Element): boolean {
  if (!isBrowser) return true;

  // if the cell is hidden, don't include it
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden')
    return false;

  // Check for common classes used to hide content or indicate tooltip/popover content.
  // You may need to add more classes here based on your actual HTML/CSS.
  const ignoredClasses = ['hidden', 'group-hover', 'tooltip', 'pointer-events-none', 'opacity-0'];
  for (const ignoredClass of ignoredClasses)
    if (element.classList.contains(ignoredClass))
      return false;

  // Otherwise, the element is considered visible
  return true;
}