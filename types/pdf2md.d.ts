// pdf2md.d.ts
declare module '@opendocsg/pdf2md' {
    function pdf2md(pdfBuffer: Buffer): Promise<string>;
    export = pdf2md;
  }
