// Local declaration for pdf-parse — the package ships no types, and we
// specifically import the /lib/ subpath to bypass the module's debug
// test-file side effect. See src/app/api/scout/voice/brain/upload/route.ts.

declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string
    numpages: number
    numrender: number
    info: any
    metadata: any
    version: string
  }
  function pdfParse(buffer: Buffer, options?: any): Promise<PdfParseResult>
  export default pdfParse
}

declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string
    numpages: number
    numrender: number
    info: any
    metadata: any
    version: string
  }
  function pdfParse(buffer: Buffer, options?: any): Promise<PdfParseResult>
  export default pdfParse
}
