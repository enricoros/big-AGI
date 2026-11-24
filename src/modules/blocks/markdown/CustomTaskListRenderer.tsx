import * as React from 'react';

import { Checkbox } from '@mui/joy';


const _checkboxSx = {
  mr: 0.5,
  mt: -0.625,
  verticalAlign: 'middle',
  '--Checkbox-size': '1.125rem',
} as const;

const _checkboxSlotProps = {
  checkbox: {
    sx: {
      boxShadow: 'xs',
    },
  },
} as const;


/**
 * Stamps each <input type="checkbox"> with the source line of its list item, the line the toggler rewrites.
 * The parser decides what is a task (block quotes yes, code no), so the line comes from it, not from a second parse.
 */
export function rehypeTaskListSourceLines() {
  return (tree: any) => {
    if (!tree || typeof tree !== 'object') return;

    // the checkbox element has no position of its own: it takes the line of its nearest positioned ancestor, the list item
    function _traverseRehypeNode(node: any, line: number | undefined) {
      if (!node || typeof node !== 'object') return;
      const nodeLine: number | undefined = node.position?.start?.line ?? line;

      if (node.tagName === 'input' && node.properties && node.properties.type === 'checkbox') {
        node.properties['data-task-line'] = nodeLine ?? -1;

        // remove the disabled property, which otherwise we get by now
        delete node.properties.disabled;
      }

      if (Array.isArray(node.children))
        for (const child of node.children)
          _traverseRehypeNode(child, nodeLine);
    }

    if (Array.isArray(tree.children))
      for (const child of tree.children)
        _traverseRehypeNode(child, undefined);
  };
}


/**
 * Toggles the task checkbox on one line (1-based) of a markdown content string; a line without one is left alone.
 * The lines are those the renderer parsed: the markdown preprocessor rewrites within lines only.
 */
function _markdownToggleTaskAtLine(content: string, line: number, setChecked: boolean): string {
  const lines = content.split('\n');

  // container markers only (block quotes, bullets, numbers), then the checkbox
  const match = lines[line - 1]?.match(/^([\s>*+\d.)-]*\[)[ xX]]/);
  if (!match) return content;

  // replace just the checkbox state character
  lines[line - 1] = match[1] + (setChecked ? 'x' : ' ') + lines[line - 1].slice(match[1].length + 1);
  return lines.join('\n');
}


/**
 * Listens to the container of the checkboxes to perform Markdown rewrites on checkbox toggles
 */
export function useMarkdownTaskListToggler(content: string, replaceContent?: (currentContent: string, newContent: string) => void) {

  const taskListContainerRef = React.useRef<HTMLDivElement>(null);

  // [effect] react to clicks on checkboxes, with a single per-container event listener
  React.useEffect(() => {
    // check preconditions
    const containerElement = taskListContainerRef.current;
    if (!containerElement || !replaceContent) return;

    // replace content on any (indexed) checkbox change
    const handleCheckboxChange = (e: Event) => {
      const target = e.target as HTMLElement;

      // only work on checkboxes with task lines
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;

      // find the closest parent with the 'data-task-line' attribute
      const taskLine = parseInt(target.closest('[data-task-line]')?.getAttribute('data-task-line') ?? '-1');
      if (!(taskLine >= 1)) return;

      // toggle the checkbox in the markdown
      const isChecked = target.checked;
      const newContent = _markdownToggleTaskAtLine(content, taskLine, !isChecked);

      if (newContent !== content)
        replaceContent(content, newContent);
    };

    // use event delegation for better performance
    containerElement.addEventListener('change', handleCheckboxChange);
    return () => containerElement?.removeEventListener('change', handleCheckboxChange);
  }, [content, replaceContent]);

  return taskListContainerRef;

}


/**
 * Note: we shall actually intercept the 'li' for our purposes, but we can also intercept the 'input' directly.
 * If we intercepted the outer node (li), we could have a richer presentation for input (e.g. clickable text), but also
 * we may lose markdown rendering of text therein.
 */
export function CustomInputRenderer({ node, children, ...props }: {
  node?: any; // rehype node
  children: React.JSX.Element; // expected: undefined
}) {

  // default rendering for non-checkboxes
  if (!('type' in props) || props.type !== 'checkbox')
    return <input {...props} />;

  // this is set by our rehype plugin, at render time
  const taskLine = 'data-task-line' in props ? props['data-task-line'] ?? -1 : -1;

  return (
    <Checkbox
      data-task-line={taskLine}
      size='sm'
      color='neutral'
      checked={'checked' in props && !!props.checked}
      // onChange={handleToggle}
      sx={_checkboxSx}
      slotProps={_checkboxSlotProps}
    >
      {children /* expected: undefined */}
    </Checkbox>
  );
}
