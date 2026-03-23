import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';

export async function POST(request) {
  let buffer, filename;
  try {
    const form = await request.formData();
    const file = form.get('file');
    filename = form.get('filename') || 'document.pdf';
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Could not read uploaded file' }, { status: 400 });
  }

  try {
    // mupdf is an ES module with top-level await — works fine in Node.js API routes
    const mupdf = (await import('mupdf')).default;

    const pdf = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
    const numPages = pdf.countPages();

    // Extract structured text from all pages
    const pageData = [];
    for (let pi = 0; pi < numPages; pi++) {
      const page = pdf.loadPage(pi);
      const stext = page.toStructuredText('preserve-whitespace');
      pageData.push(JSON.parse(stext.asJSON()));
    }

    return NextResponse.json({ pages: pageData, numPages });
  } catch (e) {
    console.error('[mupdf-parse]', e);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
