/**
 * Remark plugin that converts HTML <br> tags to mdast break nodes, but ONLY inside table cells.
 * This handles <br>, <br/>, and <br /> variants in LLM outputs.
 */

import type { Root, TableCell } from 'mdast';
import { visit } from 'unist-util-visit';


// Match <br>, <br/>, <br /> (case-insensitive)
const BR_TAG_REGEX = /^<br\s*\/?>$/i;


/**
 * Remark plugin that converts <br> HTML nodes to break nodes inside table cells
 */
export function remarkTableCellBreaks() {
  return (tree: Root) => {
    // Visit table cells and process their children
    visit(tree, 'tableCell', (cell: TableCell) => {
      const children = cell.children;

      // Process children in reverse to safely modify array while iterating
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];

        // Check if this is an HTML node with a <br> tag
        if (child.type === 'html' && BR_TAG_REGEX.test(child.value.trim())) {
          // Replace the HTML node with a break node (hard line break)
          children.splice(i, 1, { type: 'break' });
        }
      }
    });
  };
}
