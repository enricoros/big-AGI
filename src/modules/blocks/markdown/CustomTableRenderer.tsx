import * as React from 'react';
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync';

import { Box, Chip } from '@mui/joy';

import { copyToClipboard } from '~/common/util/clipboardUtils';
import { downloadBlob } from '~/common/util/downloadUtils';


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
    border: '1px solid',
    borderColor: 'neutral.outlinedBorder', // .outlinedBorder
    // boxShadow: `1px 2px 4px -3px var(--joy-palette-neutral-solidBg)`,
  } as const,

};


interface TableRendererProps {
  node?: any; // an optional field we want to not pass to element
  children: React.JSX.Element;
}

/**
 * CustomTableRenderer adds a CSV Download Link and a Copy Markdown Button
 *
 * Optimized: table data extraction happens only on button click, not on every render.
 */
export function CustomTableRenderer({ children, node, ...props }: TableRendererProps) {

  const tableRef = React.useRef<HTMLTableElement>(null);

  // handlers - extract data from DOM only when needed

  const handleDownloadCsv = React.useCallback(() => {
    const tableData = extractTableDataFromDOM(tableRef.current);
    if (!tableData?.length) return;

    // take all rows except the first one (header)
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
  }, []);

  const handleCopyMarkdown = React.useCallback(() => {
    const tableData = extractTableDataFromDOM(tableRef.current);
    if (!tableData?.length) return;
    const markdownString = generateMarkdownTableFromData(tableData, true);
    copyToClipboard(markdownString, 'Markdown Table');
  }, []);


  return <>

    <table ref={tableRef} style={_styles.tableStyle} {...props}>
      {children}
    </table>

    {/* Download CSV link and Copy Markdown Button */}
    <Box data-agi-no-copy /* do not copy these buttons */ sx={_styles.buttons}>
      {/* Download button*/}
      <Chip
        size='sm'
        variant='soft'
        onClick={handleDownloadCsv}
        // endDecorator={<DownloadIcon />}
        sx={_styles.button}
      >
        Download CSV
      </Chip>

      {/* Button to copy markdown */}
      <Chip
        size='sm'
        variant='soft'
        onClick={handleCopyMarkdown}
        // endDecorator={<ContentCopyIcon />}
        sx={_styles.button}
      >
        Copy Markdown
      </Chip>
    </Box>

  </>;
}

/**
 * Extract table data from the actual DOM (only called on button click)
 */
function extractTableDataFromDOM(table: HTMLTableElement | null): string[][] | null {
  if (!table) return null;

  const rows = table.querySelectorAll('tr');
  if (!rows.length) return null;

  const tableData: string[][] = [];
  rows.forEach((row) => {
    const cells = row.querySelectorAll('th, td');
    const rowData: string[] = [];
    cells.forEach((cell) => {
      // textContent extracts all text, handling nested elements naturally
      rowData.push(cell.textContent?.trim() || '');
    });
    if (rowData.length > 0) {
      tableData.push(rowData);
    }
  });

  return tableData.length > 0 ? tableData : null;
}


function generateMarkdownTableFromData(tableData: string[][], hasHeader: boolean = true): string {
  if (tableData.length === 0)
    return '';

  // Escape cell content for markdown tables: newlines → <br>, pipe → \|
  const escapeCell = (cell: string) => cell.replace(/\n/g, '<br>').replace(/\|/g, '\\|');

  if (!hasHeader)
    return tableData.map(row => `| ${row.map(escapeCell).join(' | ')} |`).join('\n');

  // split markdown header, separator, and rows
  const [header, ...rows] = tableData;
  const headerMarkdown = `| ${header.map(escapeCell).join(' | ')} |`;
  const separator = `| ${header.map(() => '---').join(' | ')} |`;
  const rowsMarkdown = rows.map(row => `| ${row.map(escapeCell).join(' | ')} |`).join('\n');

  // combine all parts
  return [headerMarkdown, separator, rowsMarkdown].join('\n');
}
