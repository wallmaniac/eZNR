import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const pdfPath = 'C:/Users/zzida/Desktop/znrba/ZOS - Emina Begović.pdf';
    const buffer = Buffer.from(fs.readFileSync(pdfPath));
    const mupdf = (await import('mupdf')).default;
    const pdf = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
    const numPages = pdf.countPages();
    const result = [];
    for (let pi = 0; pi < Math.min(numPages, 2); pi++) {
      const page = pdf.loadPage(pi);
      const bounds = page.getBounds();
      const stext = page.toStructuredText('preserve-whitespace');
      const parsed = JSON.parse(stext.asJSON());
      // Extract just the text for quick inspection
      const textLines = [];
      for (const block of parsed.blocks || []) {
        if (block.type === 'text') {
          for (const line of block.lines || []) {
            const text = line.text || (line.spans || []).map(s => s.text).join('');
            if (text.trim()) textLines.push({ y: Math.round(block.bbox.y), x: Math.round(block.bbox.x), text: text.trim().slice(0, 120), font: line.font?.name, size: line.font?.size, bold: line.font?.weight });
          }
        }
      }
      result.push({ page: pi + 1, pageWidth: bounds.w, pageHeight: bounds.h, lines: textLines });
    }
    return NextResponse.json({ success: true, pages: result });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
