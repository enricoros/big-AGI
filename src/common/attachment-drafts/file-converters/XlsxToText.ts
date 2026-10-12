import { loadXlsx } from './XlsxLoader';


/** Extract every worksheet locally, retaining displayed number/date formats and CSV escaping. */
export async function convertXlsxToText(input: ArrayBuffer): Promise<{ text: string, sheetCount: number }> {
  if (!input.byteLength)
    throw new Error('The spreadsheet file is empty.');

  const xlsx = await loadXlsx();
  // Keep loader failures distinct from unreadable workbook errors.
  try {
    const workbook = xlsx.read(input, { type: 'array', cellHTML: false });
    if (!workbook.SheetNames.length)
      throw new Error('No worksheets found');

    const sheets = workbook.SheetNames.map(name => {
      // Uses saved formula results; ordinary formulas without a saved result are emitted as =formula.
      const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false });
      return `Worksheet: ${name}\n${csv || '(Empty worksheet)'}`;
    });
    return { text: sheets.join('\n\n'), sheetCount: sheets.length };
  } catch {
    throw new Error('Could not read this XLSX file. It may be damaged or password-protected.');
  }
}
