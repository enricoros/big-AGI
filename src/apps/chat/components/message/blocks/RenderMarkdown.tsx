import * as React from 'react';
import { CSVLink } from 'react-csv';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, styled } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';

import { lineHeightChatText } from '~/common/app.theme';

import type { TextBlock } from './blocks';


/*
 * For performance reasons, we style this component here and copy the equivalent of 'props.sx' (the lineHeight) locally.
 */
const RenderMarkdownBox = styled(Box)({
  // same look as the other RenderComponents
  marginInline: '0.75rem !important',                             // margin: 1.5 like other blocks
  lineHeight: lineHeightChatText,

  // patch the CSS
  // fontFamily: `inherit !important`,                    // (not needed anymore, as CSS is under our control) use the default font family
  // '--color-canvas-default': 'transparent !important',  // (not needed anymore) remove the default background color
  '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
});


// Dynamically import ReactMarkdown using React.lazy
const DynamicReactGFM = React.lazy(async () => {
  const [markdownModule, remarkGfmModule] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);

  // NOTE: extracted here instead of inline as a large performance optimization
  const remarkPlugins = [remarkGfmModule.default];

  //Extracts table data from jsx element in table renderer
  const extractTableData = (children: React.JSX.Element) => {
    // Function to extract text from a React element or component
    const extractText = (element: any): String => {
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
    };

    // Function to traverse and extract data from table rows and cells
    const traverseAndExtract = (elements: any, tableData: any[] = []) => {
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
    };

    return traverseAndExtract(children);
  };

  interface TableRendererProps {
    children: React.JSX.Element;
    node?: any; // an optional field we want to not pass to the <table/> element
  }

  // Define a custom table renderer
  const TableRenderer = ({ children, node, ...props }: TableRendererProps) => {
    // Apply custom styles or modifications here
    const tableData = extractTableData(children);

    return (
      <>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.5rem' }} {...props}>
          {children}
        </table>
        <CSVLink filename='big-agi-export' data={tableData}>
          <Button variant='outlined' color='neutral' size='md' endDecorator={<DownloadIcon />} sx={{
            mb: '1rem',
            backgroundColor: 'background.popup', // make this button 'pop' a bit from the page
          }}>
            Download table as .csv
          </Button>
        </CSVLink>
      </>
    );
  };

  // Use the custom renderer for tables
  const components = {
    table: TableRenderer,
    // Add custom renderers for other elements if needed
  };

  // Pass the dynamically imported remarkGfm as children
  const ReactMarkdownWithRemarkGfm = (props: any) =>
    <markdownModule.default
      remarkPlugins={remarkPlugins}
      {...props}
      components={components}
    />;

  return { default: ReactMarkdownWithRemarkGfm };
});

function RenderMarkdown(props: { textBlock: TextBlock; sx?: SxProps; }) {
  return (
    <RenderMarkdownBox
      className='markdown-body' /* NODE: see GithubMarkdown.css for the dark/light switch, synced with Joy's */
      sx={props.sx}
    >
      <React.Suspense fallback={<div>Loading...</div>}>
        <DynamicReactGFM>
          {props.textBlock.content}
        </DynamicReactGFM>
      </React.Suspense>
    </RenderMarkdownBox>
  );
}

export const RenderMarkdownMemo = React.memo(RenderMarkdown);