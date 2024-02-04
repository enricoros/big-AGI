import * as React from 'react';

import { Box, Button, styled } from '@mui/joy';

import { lineHeightChatText } from '~/common/app.theme';

import type { TextBlock } from './blocks';

import DownloadIcon from '@mui/icons-material/Download';

const extractMarkdownTables = (input: string): string[][][] => {
  // Split the input into sections based on lines that start and end with pipes, which might indicate tables
  const potentialTables = input.split('\n\n').filter((section) => section.includes('|'));
  const tables: string[][][] = [];

  potentialTables.forEach((section) => {
    // Split the section into rows and filter out non-table rows and header separators
    const rows = section.split('\n').filter((row) => {
      return row.trim().startsWith('|') && row.trim().endsWith('|') && !row.trim().match(/^\|[-:| ]+\|$/);
    });

    if (rows.length > 0) {
      // Process each row to split into cells, trimming whitespace
      const tableData = rows.map(
        (row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim()), // Remove the first and last empty cells resulting from split
      );

      tables.push(tableData);
    }
  });

  return tables;
};

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

  interface TableRendererProps {
    children: React.JSX.Element;
  }
  // Define a custom table renderer
  const TableRenderer = ({ children, ...props }: TableRendererProps) => {
    // Apply custom styles or modifications here
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }} {...props}>
        {children}
        <Button variant="outlined">
          <DownloadIcon />
          {'Download table as .csv '}
        </Button>
      </table>
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

export const RenderMarkdown = (props: { textBlock: TextBlock }) => {
  extractMarkdownTables(props.textBlock.content);
  return (
    <RenderMarkdownBox className='markdown-body' /* NODE: see GithubMarkdown.css for the dark/light switch, synced with Joy's */ >
      <React.Suspense fallback={<div>Loading...</div>}>
        <DynamicReactGFM>
          {props.textBlock.content}
        </DynamicReactGFM>
      </React.Suspense>
    </RenderMarkdownBox>
  );
};