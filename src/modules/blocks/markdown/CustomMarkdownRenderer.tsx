import * as React from 'react';
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync';

import type { Pluggable as UnifiedPluggable } from 'unified';
import { Components as ReactMarkdownComponents, default as ReactMarkdown } from 'react-markdown';
import { default as rehypeKatex } from 'rehype-katex';
import { default as remarkGfm } from 'remark-gfm';
import { default as remarkMath } from 'remark-math';
import { remarkMark } from 'remark-mark-highlight';

import { Box, Chip } from '@mui/joy';

import { copyToClipboard } from '~/common/util/clipboardUtils';
import { downloadBlob } from '~/common/util/downloadUtils';

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

const _styles = {

  tableStyle: {
    borderCollapse: 'collapse',
    width: '100%',
    marginBottom: '0.5rem',
  } as const,

  buttons: {
    mb: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  } as const,

  button: {
    // backgroundColor: 'background.popup',
    borderRadius: 0,
    px: 1.5,
    py: 0.375,
    outline: '1px solid',
    outlineColor: 'neutral.outlinedBorder', // .outlinedBorder
    // boxShadow: `1px 2px 4px -3px var(--joy-palette-neutral-solidBg)`,
  } as const,

};

interface TableRendererProps {
  node?: any; // an optional field we want to not pass to element
  children: React.JSX.Element;
}

function TableRenderer({ children, node, ...props }: TableRendererProps) {

  // extracts the table data by parsing the DOM
  const tableData = _extractTableData(children);

  // handlers

  const handleDownloadCsv = React.useCallback(() => {
    if (!tableData?.length) return;

    // take all rows except the first one
    const dataRows = tableData.slice(1);

    // convert to CSV
    const csvString = csvStringify(dataRows, {
      bom: true,                 // add BOM marker for UTF-8 detection in Excel
      quoted: true,              // quote all fields
      quote: '"',                // use double quotes
      escape: '"',               // escape quotes with double quotes
      header: true,
      columns: tableData[0],
    });

    // create blob and trigger download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'table.csv');
  }, [tableData]);

  const handleCopyMarkdown = React.useCallback(() => {
    if (!tableData?.length) return;
    const markdownString = generateMarkdownTableFromData(tableData);
    copyToClipboard(markdownString, 'Markdown Table');
  }, [tableData]);


  return (
    <>
      <table style={_styles.tableStyle} {...props}>
        {children}
      </table>

      {/* Download CSV link and Copy Markdown Button */}
      {tableData?.length >= 1 && (
        <Box sx={_styles.buttons}>
          {/* Download button*/}
          <Chip
            variant='soft'
            color='neutral'
            size='sm'
            onClick={handleDownloadCsv}
            // endDecorator={<DownloadIcon />}
            sx={_styles.button}
          >
            Download CSV
          </Chip>

          {/* Button to copy markdown */}
          <Chip
            variant='soft'
            color='neutral'
            size='sm'
            onClick={handleCopyMarkdown}
            // endDecorator={<ContentCopyIcon />}
            sx={_styles.button}
          >
            Copy Markdown
          </Chip>
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