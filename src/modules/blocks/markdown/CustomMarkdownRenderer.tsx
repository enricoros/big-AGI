import * as React from 'react';

import type { Pluggable as UnifiedPluggable } from 'unified';
import { CSVLink } from 'react-csv';
import { Components as ReactMarkdownComponents, default as ReactMarkdown } from 'react-markdown';
import { default as rehypeKatex } from 'rehype-katex';
import { default as remarkGfm } from 'remark-gfm';
import { default as remarkMath } from 'remark-math';
import { remarkMark } from 'remark-mark-highlight';

import { Box, Button } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';

import { copyToClipboard } from '~/common/util/clipboardUtils';

import { wrapWithMarkdownSyntax } from './markdown.wrapper';


// LinkRenderer adds a target="_blank" to all links

interface LinkRendererProps {
  node?: any; // an optional field we want to not pass to the <a/> element
  children: React.ReactNode;
}

const LinkRenderer = ({ children, node, ...props }: LinkRendererProps) => (
  <a {...props} target='_blank' rel='noopener'>
    {children}
  </a>
);


// DelRenderer adds a strikethrough to the text
function DelRenderer({ children }: { children: React.ReactNode }) {
  return <del className='agi-content-delete'>{children}</del>;
}

// Mark Renderer adds a yellow background to the text
function MarkRenderer({ children }: { children: React.ReactNode }) {
  // Mark by default has a yellow background, but we want to set a custom class here, so we can style it
  return <mark className='agi-highlight'>{children}</mark>;
}


// TableRenderer adds a CSV Download Link and a Copy Markdown Button

const tableButtonsSx = {
  backgroundColor: 'background.popup',
  borderRadius: 0,
};

interface TableRendererProps {
  node?: any; // an optional field we want to not pass to element
  children: React.JSX.Element;
}

function TableRenderer({ children, node, ...props }: TableRendererProps) {

  // Apply custom styles or modifications here
  const tableData = _extractTableData(children);

  // Generate markdown string
  const markdownString = tableData?.length >= 1 ? generateMarkdownTableFromData(tableData) : '';

  // Function to copy markdown to clipboard
  const copyMarkdownToClipboard = React.useCallback(() => {
    copyToClipboard(markdownString, 'Markdown Table');
  }, [markdownString]);

  return (
    <>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }} {...props}>
        {children}
      </table>

      {/* Download CSV link and Copy Markdown Button */}
      {tableData?.length >= 1 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CSVLink filename='big-agi-table.csv' data={tableData}>
            <Button
              variant='outlined'
              color='neutral'
              size='sm'
              endDecorator={<DownloadIcon />}
              sx={tableButtonsSx}
            >
              Download CSV
            </Button>
          </CSVLink>

          {/* Button to copy markdown */}
          {!!markdownString && (
            <Button
              variant='outlined'
              color='neutral'
              size='sm'
              onClick={copyMarkdownToClipboard}
              // endDecorator={<ContentCopyIcon />}
              sx={tableButtonsSx}
            >
              Copy Markdown
            </Button>
          )}
        </Box>
      )}
    </>
  );
}

// Function to extract text from a React element or component
function extractText(element: any): string {
  if (element === null)
    return '';
  // Base case: if the element is a string, return it
  if (typeof element === 'string') {
    return element;
  }
  // If the element has children, recursively extract text from them
  if (element.props?.children) {
    if (Array.isArray(element.props.children)) {
      return element.props.children.map(extractText).join('');
    }
    return extractText(element.props.children);
  }
  return '';
}

// Function to traverse and extract data from table rows and cells
function traverseAndExtract(elements: React.JSX.Element, tableData: any[] = []): any[] {
  React.Children.forEach(elements, (element) => {
    if (element.type === 'tr') {
      const rowData = React.Children.map(element.props?.children, (cell) => {
        // Extract and return the text content of each cell
        return extractText(cell);
      });
      tableData.push(rowData);
    } else if (element.props?.children) {
      traverseAndExtract(element.props.children, tableData);
    }
  });
  return tableData;
}

function _extractTableData(children: React.JSX.Element) {
  return traverseAndExtract(children);
}

function generateMarkdownTableFromData(tableData: any[]): string {
  if (tableData.length === 0)
    return '';

  // Extract header and rows
  const [header, ...rows] = tableData;

  // Create markdown header
  const headerMarkdown = `| ${header.join(' | ')} |`;
  // Create separator
  const separator = `| ${header.map(() => '---').join(' | ')} |`;
  // Create markdown rows
  const rowsMarkdown = rows.map(row => `| ${row.join(' | ')} |`).join('\n');

  // Combine all parts
  return [headerMarkdown, separator, rowsMarkdown].join('\n');
}


// shared components for the markdown renderer

const reactMarkdownComponents = {
  a: LinkRenderer, // override the link renderer to add target="_blank"
  del: DelRenderer, // renders the <del> tag (~~strikethrough~~)
  mark: MarkRenderer, // renders the <mark> tag (==highlight==)
  table: TableRenderer, // override the table renderer to show the download CSV links and Copy Markdown button
  // math/inlineMath components are not needed, rehype-katex handles this automatically
} as ReactMarkdownComponents;

const remarkPluginsStable: UnifiedPluggable[] = [
  remarkGfm, // GitHub Flavored Markdown
  remarkMark, // Mark-Highlight, for ==yellow==
  [remarkMath, { singleDollarTextMath: false }], // Math
];

const rehypePluginsStable: UnifiedPluggable[] = [
  rehypeKatex, // KaTeX
];


/*
 * Convert OpenAI-style markdown with LaTeX to 'remark-math' compatible format.
 * Note that inline or block will both be converted to $$...$$ format, and we
 * disable on purpose the single dollar sign for inline math, as it can clash
 * with other markdown syntax.
 */
const preprocessMarkdown = (markdownText: string) => markdownText
  // Replace LaTeX delimiters with $$...$$
  .replace(/\s\\\((.*?)\\\)/gs, (_match, p1) => ` $$${p1}$$`) // Replace inline LaTeX delimiters \( and \) with $$
  .replace(/\s\\\[(.*?)\\]/gs, (_match, p1) => ` $$${p1}$$`) // Replace block LaTeX delimiters \[ and \] with $$
  // Replace <mark>...</mark> with ==...==, but not in multiple lines, or if preceded by a backtick (disabled, was (?<!`))
  .replace(/<mark>([\s\S]*?)<\/mark>/g, (_match, p1) => wrapWithMarkdownSyntax(p1, '=='))
  // Replace <del>...</del> with ~~...~~, but not in multiple lines, or if preceded by a backtick (disabled, was (?<!`))
  .replace(/<del>([\s\S]*?)<\/del>/g, (_match, p1) => wrapWithMarkdownSyntax(p1, '~~'));

export default function CustomMarkdownRenderer(props: { content: string }) {
  return (
    <ReactMarkdown
      components={reactMarkdownComponents}
      remarkPlugins={remarkPluginsStable}
      rehypePlugins={rehypePluginsStable}
    >
      {preprocessMarkdown(props.content)}
    </ReactMarkdown>
  );
}