import * as React from 'react';

import { CSVLink } from 'react-csv';
import { default as ReactMarkdown } from 'react-markdown';
import { default as remarkGfm } from 'remark-gfm';

import { Button } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';


// Extracts table data from jsx element in table renderer
function extractTableData(children: React.JSX.Element) {

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
  function traverseAndExtract(elements: any, tableData: any[] = []) {
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


// TableRenderer adds a CSV Download Link

interface TableRendererProps {
  node?: any; // an optional field we want to not pass to element
  children: React.JSX.Element;
}

function TableRenderer({ children, node, ...props }: TableRendererProps) {

  // Apply custom styles or modifications here
  const tableData = extractTableData(children);

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


const reactMarkdownComponents = {
  a: LinkRenderer, // override the link renderer to add target="_blank"
  table: TableRenderer, // override the table renderer to show the download CSV links
};


// Custom plugins: GFM (GitHub Flavored Markdown)

const remarkPlugins = [
  remarkGfm,
];


export default function CustomMarkdownRenderer(props: any) {
  return <ReactMarkdown components={reactMarkdownComponents} remarkPlugins={remarkPlugins} {...props} />;
}