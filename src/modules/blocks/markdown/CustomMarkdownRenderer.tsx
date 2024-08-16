import * as React from 'react';

import type { Pluggable as UnifiedPluggable } from 'unified';
import { CSVLink } from 'react-csv';
import { Components as ReactMarkdownComponents, default as ReactMarkdown } from 'react-markdown';
import { default as rehypeKatex } from 'rehype-katex';
import { default as remarkGfm } from 'remark-gfm';
import { default as remarkMath } from 'remark-math';
import { remarkMark } from 'remark-mark-highlight';

import { Button } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';


// LinkRenderer adds a target="_blank" to all links

interface LinkRendererProps {
  node?: any; // an optional field we want to not pass to the <table/> element
  children: React.JSX.Element;
}

const LinkRenderer = ({ children, node, ...props }: LinkRendererProps) => (
  <a {...props} target='_blank' rel='noopener'>
    {children}
  </a>
);


// Mark Renderer adds a yellow background to the text
function MarkRenderer({ children }: { children: React.ReactNode }) {
  // Mark by default has a yellow background, but we want to set a custom class here, so we can style it
  return (
    <mark className='agi-highlight'>
      {children}
    </mark>
  );
}


// TableRenderer adds a CSV Download Link

interface TableRendererProps {
  node?: any; // an optional field we want to not pass to element
  children: React.JSX.Element;
}

function TableRenderer({ children, node, ...props }: TableRendererProps) {

  // Apply custom styles or modifications here
  const tableData = _extractTableData(children);

  return (
    <>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }} {...props}>
        {children}
      </table>

      {/* Download CSV link */}
      {tableData?.length >= 1 && (
        <CSVLink filename='big-agi-export' data={tableData}>
          <Button variant='outlined' color='neutral' size='md' endDecorator={<DownloadIcon />} sx={{
            mb: '1rem',
            backgroundColor: 'background.popup', // make this button 'pop' a bit from the page
          }}>
            Download table as .csv
          </Button>
        </CSVLink>
      )}
    </>
  );
}

function _extractTableData(children: React.JSX.Element) {

  // Function to extract text from a React element or component
  function extractText(element: any): String {
    // Base case: if the element is a string, return it
    if (typeof element === 'string') {
      return element;
    }
    // If the element has children, recursively extract text from them
    if (element.props && element.props.children) {
      if (Array.isArray(element.props.children)) {
        return element.props.children.map(extractText).join('');
      }
      return extractText(element.props.children);
    }
    return '';
  }

  // Function to traverse and extract data from table rows and cells
  function traverseAndExtract(elements: React.JSX.Element, tableData: any[] = []) {
    React.Children.forEach(elements, (element) => {
      if (element.type === 'tr') {
        const rowData = React.Children.map(element.props.children, (cell) => {
          // Extract and return the text content of each cell
          return extractText(cell);
        });
        tableData.push(rowData);
      } else if (element.props && element.props.children) {
        traverseAndExtract(element.props.children, tableData);
      }
    });
    return tableData;
  }

  return traverseAndExtract(children);
}


// shared components for the markdown renderer

const reactMarkdownComponents = {
  a: LinkRenderer, // override the link renderer to add target="_blank"
  mark: MarkRenderer, // renders the <mark> tag
  table: TableRenderer, // override the table renderer to show the download CSV links
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
  .replace(/<mark>(.+?)<\/mark>/g, (_match, p1) => ` ==${p1}==`);


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