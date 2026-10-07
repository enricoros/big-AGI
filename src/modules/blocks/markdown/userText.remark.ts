/**
 * Remark plugin for text a person typed or pasted, which is not shaped like model output:
 * - a single newline is a line break - CommonMark would join the lines of a typed message into one
 * - 4-space indents stay text - pasted unfenced code would otherwise turn into code blocks, partially
 * - <tags> stay text - XML-tagged prompts would otherwise become raw HTML, which swallows their markdown and line breaks
 */

import type { PhrasingContent, Root } from 'mdast';
import type { Processor } from 'unified';
import type {} from 'remark-parse'; // types `micromarkExtensions` on the processor data (remark-parse comes with react-markdown)
import { visit } from 'unist-util-visit';


export function remarkUserText(this: Processor) {

  // parse: disable the micromark constructs above
  const data = this.data();
  (data.micromarkExtensions ??= []).push({ disable: { null: ['codeIndented', 'htmlFlow', 'htmlText'] } });

  // transform: soft line endings -> breaks
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('\n')) return;
      const nodes: PhrasingContent[] = [];
      node.value.split(/\r?\n/).forEach((value, i) => {
        if (i) nodes.push({ type: 'break' });
        if (value) nodes.push({ type: 'text', value });
      });
      parent.children.splice(index, 1, ...nodes);
      return index + nodes.length;
    });
  };
}
