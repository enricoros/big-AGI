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
 * Visits the full tree and renumbers <input type="checkbox"> elements, if any
 */
export function rehypeTaskListRenumber() {
  return (tree: any) => {
    if (!tree || typeof tree !== 'object') return;

    let checkboxIndex = 0;

    function _traverseRehypeNode(node: any) {
      if (!node || typeof node !== 'object') return;

      if (node.tagName === 'input' && node.properties && node.properties.type === 'checkbox') {
        // renumber the checkbox
        node.properties['data-task-index'] = checkboxIndex++;

        // remove the disabled property, which otherwise we get by now
        delete node.properties.disabled;
      }

      if (Array.isArray(node.children))
        node.children.forEach(_traverseRehypeNode);
    }

    if (Array.isArray(tree.children))
      tree.children.forEach(_traverseRehypeNode);
  };
}


/**
 * Toggles the checkbox state of a task in a markdown content string
 */
function _markdownToggleTaskByIndex(content: string, taskIndex: number, setChecked: boolean): string {
  let currentTaskIndex = -1;
  const lines = content.split('\n');

  // This will match a bullet/numbered task list item in Markdown format
  // Note: we decide not to support empty checkboxes, to be consistent with rendering
  const taskListRegex = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX☑✓])(]\s+.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(taskListRegex);
    if (match) {
      currentTaskIndex++;

      if (currentTaskIndex === taskIndex) {
        // Replace just the checkbox state character
        lines[i] = match[1] + (setChecked ? 'x' : ' ') + match[3];
        break;
      }
    }
  }

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

      // only work on checkboxes with task indices
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;

      // find the closest parent with the 'data-task-index' attribute
      const taskIndex = parseInt(target.closest('[data-task-index]')?.getAttribute('data-task-index') ?? '-1');
      if (taskIndex === -1) return;

      // toggle the checkbox in the markdown
      const isChecked = target.checked;
      const newContent = _markdownToggleTaskByIndex(content, taskIndex, !isChecked);

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

  // this is set by our rehype plugin, which renumbers at render time
  const taskIndex = 'data-task-index' in props ? props['data-task-index'] ?? -1 : -1;

  return (
    <Checkbox
      data-task-index={taskIndex}
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
